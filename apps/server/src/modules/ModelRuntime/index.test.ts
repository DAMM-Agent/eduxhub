// @vitest-environment node
import { ModelRuntime } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { SUPPORTED_MODEL_PROVIDERS, UnsupportedModelProviderError } from 'model-bank';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

import {
  buildPayloadFromKeyVaults,
  describeServerDefaultHeterogeneousModel,
  getServerDefaultHeterogeneousModels,
  initModelRuntimeFromDB,
  initModelRuntimeFromServerConfig,
  initModelRuntimeWithUserPayload,
  resolveRuntimeProvider,
  resolveServerDefaultHeterogeneousModel,
  resolveServerModel,
} from './index';

const { getServerGlobalConfig, loadModels, getLLMConfig } = vi.hoisted(() => ({
  getServerGlobalConfig: vi.fn(),
  loadModels: vi.fn(),
  getLLMConfig: vi.fn(() =>
    Object.fromEntries(
      ['openai', 'deepseek', 'moonshot', 'minimax', 'qwen', 'volcengine', 'zhipu'].map((id) => [
        `${id.toUpperCase()}_API_KEY`,
        `server-${id}-key`,
      ]),
    ),
  ),
}));
vi.mock('@/business/client/model-bank/loadModels', () => ({ loadModels }));
vi.mock('@/server/globalConfig', () => ({ getServerGlobalConfig }));
vi.mock('@/envs/llm', () => ({ getLLMConfig }));
vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: { getUserKeyVaults: vi.fn() },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('resolveServerModel', () => {
  it('accepts only an enabled deployment-owned chat model', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        openai: {
          enabled: true,
          serverModelLists: [
            { enabled: true, id: 'gpt-server', type: 'chat' },
            { enabled: false, id: 'gpt-disabled', type: 'chat' },
          ],
        },
      },
    });

    await expect(resolveServerModel('openai', 'gpt-server')).resolves.toEqual({
      model: 'gpt-server',
      provider: 'openai',
    });
    await expect(resolveServerModel('openai', 'gpt-disabled')).rejects.toThrow(
      'selected server model is not available',
    );
  });

  it('preserves a deployment-owned model mapping', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        volcengine: {
          enabled: true,
          serverModelLists: [
            {
              config: { deploymentName: 'prod-gpt' },
              enabled: true,
              id: 'gpt-4o',
              type: 'chat',
            },
          ],
        },
      },
    });

    await expect(resolveServerModel('volcengine', 'gpt-4o')).resolves.toEqual({
      deploymentName: 'prod-gpt',
      model: 'gpt-4o',
      provider: 'volcengine',
    });
  });
});

describe('getServerDefaultHeterogeneousModels', () => {
  it('discovers and resolves new tool-capable models without a deployment opt-in', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: {
          enabled: true,
          serverModelLists: [
            {
              abilities: { functionCall: true },
              enabled: true,
              id: 'deployment-new-model',
              type: 'chat',
            },
            { abilities: { functionCall: true }, enabled: true, id: 'kimi-k3', type: 'chat' },
          ],
        },
      },
    });
    expect(
      (await getServerDefaultHeterogeneousModels())['kimi-code'].map(({ model }) => model),
    ).toEqual(['deployment-new-model', 'kimi-k3']);
    await expect(
      resolveServerDefaultHeterogeneousModel('kimi-code', 'deployment-new-model'),
    ).resolves.toMatchObject({ model: 'deployment-new-model' });
  });

  it('offers newly enabled tool-capable catalog aliases to Kimi without an ID allowlist', async () => {
    const ids = ['minimax-m3', 'zai-org/GLM-5.2', 'doubao-seed-2-1-pro', 'qwen3.7-plus'];
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: {
          enabled: true,
          serverModelLists: ids.map((id) => ({
            abilities: { functionCall: true },
            enabled: true,
            id,
            type: 'chat',
          })),
        },
      },
    });
    const models = await getServerDefaultHeterogeneousModels();
    expect(models['kimi-code'].map(({ model }) => model)).toEqual(ids);
    await expect(
      resolveServerDefaultHeterogeneousModel('kimi-code', ids[0]),
    ).resolves.toMatchObject({ model: ids[0] });
  });

  it('returns only compatible V1 models from the retained deployment provider', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        anthropic: {
          enabled: true,
          serverModelLists: [{ enabled: true, id: 'claude-opus-4-8', type: 'chat' }],
        },
        google: {
          enabled: true,
          serverModelLists: [{ enabled: true, id: 'gemini-server', type: 'chat' }],
        },
        deepseek: {
          enabled: true,
          serverModelLists: [
            { enabled: true, id: 'claude-sonnet-4-6', type: 'chat' },
            { enabled: false, id: 'claude-haiku-4-5', type: 'chat' },
            { enabled: true, id: 'gpt-5.4', type: 'chat' },
            { enabled: true, id: 'gpt-4o', type: 'chat' },
            { enabled: true, id: 'gemini-3.1-pro-preview', type: 'chat' },
            { enabled: true, id: 'claude-image', type: 'image' },
          ],
        },
        openai: {
          enabled: true,
          serverModelLists: [{ enabled: true, id: 'gpt-5.4', type: 'chat' }],
        },
      },
    });

    await expect(getServerDefaultHeterogeneousModels()).resolves.toEqual({
      'claude-code': [{ model: 'claude-sonnet-4-6' }],
      'codex': [{ model: 'claude-sonnet-4-6' }, { model: 'gpt-5.4' }],
      'grok-build': [{ model: 'claude-sonnet-4-6' }],
      'kimi-code': [{ model: 'claude-sonnet-4-6' }],
      'pi': [{ model: 'claude-sonnet-4-6' }],
      'trae': [{ model: 'claude-sonnet-4-6' }],
    });
  });

  it('uses the model bank when the deployment has no explicit server model list', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: { enabled: true, serverModelLists: undefined },
      },
    });
    loadModels.mockResolvedValue([
      {
        enabled: true,
        id: 'claude-sonnet-4-6',
        providerId: 'deepseek',
        source: 'builtin',
        type: 'chat',
      },
      {
        enabled: true,
        id: 'gpt-5.4',
        providerId: 'deepseek',
        source: 'builtin',
        type: 'chat',
      },
      {
        enabled: true,
        id: 'claude-opus-4-8',
        providerId: 'anthropic',
        source: 'builtin',
        type: 'chat',
      },
    ]);

    await expect(getServerDefaultHeterogeneousModels()).resolves.toEqual({
      'claude-code': [{ model: 'claude-sonnet-4-6' }],
      'codex': [{ model: 'claude-sonnet-4-6' }, { model: 'gpt-5.4' }],
      'grok-build': [{ model: 'claude-sonnet-4-6' }],
      'kimi-code': [{ model: 'claude-sonnet-4-6' }],
      'pi': [{ model: 'claude-sonnet-4-6' }],
      'trae': [{ model: 'claude-sonnet-4-6' }],
    });
  });

  it('offers every tool-capable relay model to every agent, Codex included', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: {
          enabled: true,
          serverModelLists: [
            { abilities: { functionCall: true }, enabled: true, id: 'kimi-k2.6', type: 'chat' },
            {
              abilities: { functionCall: true },
              enabled: true,
              id: 'deepseek-v4-flash',
              type: 'chat',
            },
            {
              abilities: { functionCall: true },
              enabled: true,
              id: 'deepseek-v4-pro',
              type: 'chat',
            },
            {
              abilities: { functionCall: true },
              enabled: true,
              id: 'glm-5.2',
              type: 'chat',
            },
            {
              abilities: { functionCall: true },
              enabled: true,
              id: 'gemini-3.1-pro-preview',
              type: 'chat',
            },
            { abilities: { reasoning: true }, enabled: true, id: 'no-tools-model', type: 'chat' },
            { abilities: { functionCall: true }, enabled: false, id: 'kimi-k3', type: 'chat' },
            { abilities: { functionCall: true }, enabled: true, id: 'kimi-image', type: 'image' },
          ],
        },
      },
    });

    await expect(getServerDefaultHeterogeneousModels()).resolves.toEqual({
      'claude-code': [
        { model: 'kimi-k2.6' },
        { model: 'deepseek-v4-flash' },
        { model: 'deepseek-v4-pro' },
        { model: 'glm-5.2' },
        { model: 'gemini-3.1-pro-preview' },
      ],
      'codex': [
        { model: 'kimi-k2.6' },
        { model: 'deepseek-v4-flash' },
        { model: 'deepseek-v4-pro' },
        { model: 'glm-5.2' },
        { model: 'gemini-3.1-pro-preview' },
      ],
      'grok-build': [
        { model: 'kimi-k2.6' },
        { model: 'deepseek-v4-flash' },
        { model: 'deepseek-v4-pro' },
        { model: 'glm-5.2' },
        { model: 'gemini-3.1-pro-preview' },
      ],
      'kimi-code': [
        { model: 'kimi-k2.6' },
        { model: 'deepseek-v4-flash' },
        { model: 'deepseek-v4-pro' },
        { model: 'glm-5.2' },
        { model: 'gemini-3.1-pro-preview' },
      ],
      'pi': [
        { model: 'kimi-k2.6' },
        { model: 'deepseek-v4-flash' },
        { model: 'deepseek-v4-pro' },
        { model: 'glm-5.2' },
        { model: 'gemini-3.1-pro-preview' },
      ],
      'trae': [
        { model: 'kimi-k2.6' },
        { model: 'deepseek-v4-flash' },
        { model: 'deepseek-v4-pro' },
        { model: 'glm-5.2' },
        { model: 'gemini-3.1-pro-preview' },
      ],
    });
  });

  it('offers tool-capable GPT and Gemini models to Kimi without a profile allowlist', async () => {
    const toolCapableModels = [
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5.5',
      'gpt-5.5-pro',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-pro-preview',
    ];
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: {
          enabled: true,
          serverModelLists: toolCapableModels.map((id) => ({
            abilities: { functionCall: true },
            enabled: true,
            id,
            type: 'chat',
          })),
        },
      },
    });

    const models = await getServerDefaultHeterogeneousModels();

    expect(models['kimi-code']).toEqual(toolCapableModels.map((model) => ({ model })));
    expect(models['claude-code']).toEqual(toolCapableModels.map((model) => ({ model })));
  });

  it('uses tool capabilities rather than legacy deployment profile metadata for Kimi', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: {
          enabled: true,
          serverModelLists: [
            {
              abilities: { functionCall: true },
              agentCompatibility: {
                serverDefaultHeterogeneousProfiles: ['kimi-code/anthropic-v1'],
              },
              enabled: true,
              id: 'private-kimi-model',
              type: 'chat',
            },
            {
              abilities: { functionCall: true },
              agentCompatibility: { serverDefaultHeterogeneousProfiles: [] },
              enabled: true,
              id: 'kimi-k3',
              type: 'chat',
            },
            {
              abilities: { functionCall: false },
              agentCompatibility: {
                serverDefaultHeterogeneousProfiles: ['kimi-code/anthropic-v1'],
              },
              enabled: true,
              id: 'no-tools-model',
              type: 'chat',
            },
          ],
        },
      },
    });

    await expect(getServerDefaultHeterogeneousModels()).resolves.toMatchObject({
      'kimi-code': [{ model: 'private-kimi-model' }, { model: 'kimi-k3' }],
    });
  });

  it('does not advertise hidden runtime-only models', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: {
          enabled: true,
          serverModelLists: [
            { abilities: { functionCall: true }, enabled: true, id: 'kimi-k3', type: 'chat' },
            {
              abilities: { functionCall: true },
              enabled: true,
              id: 'lobehub-onboarding-v1',
              type: 'chat',
              visible: false,
            },
          ],
        },
      },
    });

    await expect(getServerDefaultHeterogeneousModels()).resolves.toEqual({
      'claude-code': [{ model: 'kimi-k3' }],
      'codex': [{ model: 'kimi-k3' }],
      'grok-build': [{ model: 'kimi-k3' }],
      'kimi-code': [{ model: 'kimi-k3' }],
      'pi': [{ model: 'kimi-k3' }],
      'trae': [{ model: 'kimi-k3' }],
    });
  });

  it('keeps Claude ids eligible when the relay catalog declares no abilities', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: {
          enabled: true,
          serverModelLists: [
            { enabled: true, id: 'claude-sonnet-4-6', type: 'chat' },
            { enabled: true, id: 'kimi-k2.6', type: 'chat' },
          ],
        },
      },
    });

    await expect(getServerDefaultHeterogeneousModels()).resolves.toEqual({
      'claude-code': [{ model: 'claude-sonnet-4-6' }],
      'codex': [{ model: 'claude-sonnet-4-6' }],
      'grok-build': [{ model: 'claude-sonnet-4-6' }],
      'kimi-code': [{ model: 'claude-sonnet-4-6' }],
      'pi': [{ model: 'claude-sonnet-4-6' }],
      'trae': [{ model: 'claude-sonnet-4-6' }],
    });
  });
});

describe('describeServerDefaultHeterogeneousModel', () => {
  it('describes a compatible model from its card and marks native Responses models', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: {
          enabled: true,
          serverModelLists: [
            {
              abilities: { functionCall: true, reasoning: true, vision: true },
              contextWindowTokens: 262_144,
              displayName: 'Kimi K3',
              enabled: true,
              id: 'kimi-k3',
              maxOutput: 32_768,
              type: 'chat',
            },
            { enabled: true, id: 'gpt-6-sol', type: 'chat' },
            { abilities: { reasoning: true }, enabled: true, id: 'no-tools-model', type: 'chat' },
          ],
        },
      },
    });

    await expect(describeServerDefaultHeterogeneousModel('codex', 'kimi-k3')).resolves.toEqual({
      abilities: { reasoning: true, vision: true },
      contextWindowTokens: 262_144,
      displayName: 'Kimi K3',
      maxOutput: 32_768,
      model: 'kimi-k3',
      nativeResponses: false,
    });
    await expect(describeServerDefaultHeterogeneousModel('codex', 'gpt-6-sol')).resolves.toEqual({
      abilities: { reasoning: false, vision: false },
      model: 'gpt-6-sol',
      nativeResponses: true,
    });
    await expect(
      describeServerDefaultHeterogeneousModel('codex', 'no-tools-model'),
    ).rejects.toThrow('not compatible with this heterogeneous agent');
  });
});

describe('resolveServerDefaultHeterogeneousModel', () => {
  it.each([
    { abilities: { functionCall: true }, id: 'new-tool-model', supported: true },
    { id: 'kimi-k3', supported: false },
    { abilities: { functionCall: false }, id: 'deepseek-v4-pro', supported: false },
    { abilities: { functionCall: true }, enabled: false, id: 'disabled-model', supported: false },
    { abilities: { functionCall: true }, id: 'hidden-model', supported: false, visible: false },
    { abilities: { functionCall: true }, id: 'image-model', supported: false, type: 'image' },
  ])(
    'uses the same tool-capable policy for Kimi discovery and resolution: $id',
    async ({ supported, ...model }) => {
      getServerGlobalConfig.mockResolvedValue({
        aiProvider: {
          deepseek: {
            enabled: true,
            serverModelLists: [{ enabled: true, type: 'chat', ...model }],
          },
        },
      });

      const models = await getServerDefaultHeterogeneousModels();
      expect(models['kimi-code']).toEqual(supported ? [{ model: model.id }] : []);

      const resolution = resolveServerDefaultHeterogeneousModel('kimi-code', model.id);
      if (supported) {
        await expect(resolution).resolves.toMatchObject({ model: model.id, provider: 'deepseek' });
      } else {
        await expect(resolution).rejects.toThrow(/not available|not compatible/);
      }
    },
  );

  it('accepts only protocol-compatible models from the retained deployment provider', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        anthropic: {
          enabled: true,
          serverModelLists: [{ enabled: true, id: 'claude-sonnet-4-6', type: 'chat' }],
        },
        deepseek: {
          enabled: true,
          serverModelLists: [
            { enabled: true, id: 'claude-sonnet-4-6', type: 'chat' },
            { enabled: true, id: 'gpt-5.4', type: 'chat' },
            { enabled: true, id: 'gpt-4o', type: 'chat' },
          ],
        },
        openai: {
          enabled: true,
          serverModelLists: [{ enabled: true, id: 'gpt-5.4', type: 'chat' }],
        },
      },
    });

    await expect(
      resolveServerDefaultHeterogeneousModel('claude-code', 'claude-sonnet-4-6'),
    ).resolves.toMatchObject({ model: 'claude-sonnet-4-6', provider: 'deepseek' });
    await expect(resolveServerDefaultHeterogeneousModel('codex', 'gpt-5.4')).resolves.toMatchObject(
      { model: 'gpt-5.4', provider: 'deepseek' },
    );
    await expect(
      resolveServerDefaultHeterogeneousModel('codex', 'claude-sonnet-4-6'),
    ).resolves.toMatchObject({ model: 'claude-sonnet-4-6', provider: 'deepseek' });

    await expect(resolveServerDefaultHeterogeneousModel('claude-code', 'gpt-5.4')).rejects.toThrow(
      'not compatible with this heterogeneous agent',
    );
    await expect(resolveServerDefaultHeterogeneousModel('kimi-code', 'gpt-5.4')).rejects.toThrow(
      'not compatible with this heterogeneous agent',
    );
    await expect(resolveServerDefaultHeterogeneousModel('codex', 'gpt-4o')).rejects.toThrow(
      'not compatible with this heterogeneous agent',
    );
  });

  it('resolves a model-bank model when no explicit server model list exists', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: { enabled: true, serverModelLists: undefined },
      },
    });
    loadModels.mockResolvedValue([
      {
        enabled: true,
        id: 'claude-sonnet-4-6',
        providerId: 'deepseek',
        settings: { extendParams: ['enableAdaptiveThinking'] },
        source: 'builtin',
        type: 'chat',
      },
    ]);

    await expect(
      resolveServerDefaultHeterogeneousModel('claude-code', 'claude-sonnet-4-6'),
    ).resolves.toEqual({
      model: 'claude-sonnet-4-6',
      provider: 'deepseek',
      supportsAdaptiveThinking: true,
    });
  });

  it('accepts a tool-capable third-party relay model for Kimi without attestation', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: {
          enabled: true,
          serverModelLists: [
            {
              abilities: { functionCall: true },
              enabled: true,
              id: 'kimi-k2.6',
              maxOutput: 65_536,
              type: 'chat',
            },
            { abilities: { reasoning: true }, enabled: true, id: 'no-tools-model', type: 'chat' },
          ],
        },
      },
    });

    await expect(
      resolveServerDefaultHeterogeneousModel('claude-code', 'kimi-k2.6'),
    ).resolves.toEqual({
      maxOutput: 65_536,
      model: 'kimi-k2.6',
      provider: 'deepseek',
      supportsAdaptiveThinking: false,
    });
    await expect(
      resolveServerDefaultHeterogeneousModel('kimi-code', 'kimi-k2.6'),
    ).resolves.toMatchObject({ maxOutput: 65_536, model: 'kimi-k2.6', provider: 'deepseek' });
    await expect(resolveServerDefaultHeterogeneousModel('pi', 'kimi-k2.6')).resolves.toMatchObject({
      model: 'kimi-k2.6',
      provider: 'deepseek',
    });
    await expect(
      resolveServerDefaultHeterogeneousModel('grok-build', 'kimi-k2.6'),
    ).resolves.toMatchObject({ model: 'kimi-k2.6', provider: 'deepseek' });
    await expect(
      resolveServerDefaultHeterogeneousModel('trae', 'kimi-k2.6'),
    ).resolves.toMatchObject({ model: 'kimi-k2.6', provider: 'deepseek' });

    await expect(
      resolveServerDefaultHeterogeneousModel('codex', 'kimi-k2.6'),
    ).resolves.toMatchObject({ model: 'kimi-k2.6', provider: 'deepseek' });
    await expect(resolveServerDefaultHeterogeneousModel('codex', 'no-tools-model')).rejects.toThrow(
      'not compatible with this heterogeneous agent',
    );
    await expect(
      resolveServerDefaultHeterogeneousModel('claude-code', 'no-tools-model'),
    ).rejects.toThrow('not compatible with this heterogeneous agent');
  });

  it('keeps hidden runtime aliases resolvable but rejects them for heterogeneous agents', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: {
          enabled: true,
          serverModelLists: [
            {
              abilities: { functionCall: true },
              enabled: true,
              id: 'lobehub-onboarding-v1',
              type: 'chat',
              visible: false,
            },
          ],
        },
      },
    });

    await expect(resolveServerModel('deepseek', 'lobehub-onboarding-v1')).resolves.toEqual({
      model: 'lobehub-onboarding-v1',
      provider: 'deepseek',
    });
    await expect(
      resolveServerDefaultHeterogeneousModel('claude-code', 'lobehub-onboarding-v1'),
    ).rejects.toThrow('not compatible with this heterogeneous agent');
  });

  it('preserves the deployment model mapping for a relay selection', async () => {
    getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        deepseek: {
          enabled: true,
          serverModelLists: [
            {
              abilities: { functionCall: true },
              config: { deploymentName: 'kimi-prod' },
              enabled: true,
              id: 'kimi-k2.6',
              type: 'chat',
            },
          ],
        },
      },
    });

    await expect(
      resolveServerDefaultHeterogeneousModel('claude-code', 'kimi-k2.6'),
    ).resolves.toEqual({
      deploymentName: 'kimi-prod',
      model: 'kimi-k2.6',
      provider: 'deepseek',
      supportsAdaptiveThinking: false,
    });
  });
});

describe('provider initialization boundaries', () => {
  it.each(SUPPORTED_MODEL_PROVIDERS)('initializes %s with only its own server key', (provider) => {
    const initialize = vi.spyOn(ModelRuntime, 'initializeWithProvider');
    initModelRuntimeWithUserPayload(provider, {});
    expect(initialize).toHaveBeenCalledWith(
      provider,
      expect.objectContaining({ apiKey: `server-${provider}-key` }),
      undefined,
    );
  });

  it.each(SUPPORTED_MODEL_PROVIDERS)('keeps user endpoint and credentials for %s', (provider) => {
    const initialize = vi.spyOn(ModelRuntime, 'initializeWithProvider');
    initModelRuntimeWithUserPayload(provider, {
      apiKey: 'user-key',
      baseURL: 'https://api.example.test/v1',
    });
    expect(initialize).toHaveBeenCalledWith(
      provider,
      { apiKey: 'user-key', baseURL: 'https://api.example.test/v1' },
      undefined,
    );
  });

  it.each(['google', 'anthropic', 'bedrock', 'lobehub', 'volcenginecodingplan', 'custom-provider'])(
    'rejects %s before reading or decrypting stored credentials',
    async (provider) => {
      const select = vi.fn();
      const initialize = vi.spyOn(ModelRuntime, 'initializeWithProvider');
      await expect(
        initModelRuntimeFromDB({ select } as unknown as LobeChatDatabase, 'user', provider),
      ).rejects.toBeInstanceOf(UnsupportedModelProviderError);
      expect(select).not.toHaveBeenCalled();
      expect(KeyVaultsGateKeeper.getUserKeyVaults).not.toHaveBeenCalled();
      expect(initialize).not.toHaveBeenCalled();
      expect(() =>
        initModelRuntimeWithUserPayload(provider, { apiKey: 'old-key', runtimeProvider: 'openai' }),
      ).toThrow(UnsupportedModelProviderError);
      expect(() => resolveRuntimeProvider(provider, 'openai')).toThrow(
        UnsupportedModelProviderError,
      );
    },
  );

  it('rejects a mismatched runtime identity', () => {
    expect(() => initModelRuntimeWithUserPayload('qwen', { runtimeProvider: 'openai' })).toThrow(
      expect.objectContaining({ errorType: ChatErrorType.BadRequest }),
    );
  });

  it('validates endpoint syntax before SDK initialization', () => {
    expect(() =>
      initModelRuntimeWithUserPayload('openai', { baseURL: 'https://api.example.test /v1' }),
    ).toThrow(expect.objectContaining({ errorType: ChatErrorType.BadRequest }));
  });

  it('never borrows the OpenAI key for an unconfigured retained provider', () => {
    getLLMConfig.mockReturnValueOnce({ OPENAI_API_KEY: 'openai-only-key' });
    const initialize = vi.spyOn(ModelRuntime, 'initializeWithProvider').mockImplementation(() => {
      throw new Error('stop before SDK');
    });
    expect(() => initModelRuntimeWithUserPayload('zhipu', {})).toThrow('stop before SDK');
    expect(initialize).toHaveBeenCalledWith('zhipu', { apiKey: '' }, undefined);
  });

  it('builds retained provider payloads without legacy credentials', () => {
    expect(
      buildPayloadFromKeyVaults(
        { apiKey: 'key', baseURL: 'https://api.example.test' },
        'volcengine',
      ),
    ).toEqual({
      apiKey: 'key',
      baseURL: 'https://api.example.test',
      runtimeProvider: 'volcengine',
    });
    expect(() => buildPayloadFromKeyVaults({ apiKey: 'saved-key' }, 'google')).toThrow(
      UnsupportedModelProviderError,
    );
  });

  it('uses the supported deployment default and rejects a removed default', async () => {
    getServerGlobalConfig.mockResolvedValue({
      defaultAgent: { config: { provider: 'volcengine' } },
    });
    const initialize = vi.spyOn(ModelRuntime, 'initializeWithProvider');
    await initModelRuntimeFromServerConfig({ actorUserId: 'user-1', workspaceId: 'workspace-1' });
    expect(initialize).toHaveBeenCalledWith(
      'volcengine',
      expect.objectContaining({
        apiKey: 'server-volcengine-key',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      }),
      expect.anything(),
    );
    getServerGlobalConfig.mockResolvedValue({ defaultAgent: { config: { provider: 'google' } } });
    await expect(initModelRuntimeFromServerConfig({ actorUserId: 'user-1' })).rejects.toThrow(
      UnsupportedModelProviderError,
    );
  });
});
