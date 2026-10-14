import type { AiProviderRuntimeConfig } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import {
  getProviderInferenceProtocols,
  resolveHeterogeneousProviderBinding,
} from './resolveBinding';

const runtime = (
  sdkType: AiProviderRuntimeConfig['settings']['sdkType'],
  overrides: Partial<AiProviderRuntimeConfig> = {},
): AiProviderRuntimeConfig => ({
  config: {},
  keyVaults: {
    apiKey: 'test-key',
    ...(sdkType === 'anthropic' ? { baseURL: 'https://api.minimaxi.com/anthropic' } : {}),
  },
  settings: { sdkType },
  ...overrides,
});

describe('heterogeneous provider binding protocol resolver', () => {
  it.each(['anthropic', 'google', 'bedrock', 'lobehub', 'custom-openai', 'volcenginecodingplan'])(
    'rejects %s despite saved credentials and a supported wire protocol',
    (providerId) => {
      const runtimeConfig = runtime('openai', {
        config: { enableResponseApi: true },
        keyVaults: { apiKey: 'old-key', baseURL: 'https://proxy.example.com/v1' },
      });
      expect(getProviderInferenceProtocols(providerId, runtimeConfig)).toEqual([]);
      expect(
        resolveHeterogeneousProviderBinding({
          agentType: 'codex',
          apiConfig: { model: 'model', providerId },
          providerEnabled: true,
          runtimeConfig,
        }),
      ).toEqual({ error: { code: 'providerUnavailable', providerId } });
    },
  );

  it('preserves the Anthropic message protocol for a retained provider', () => {
    expect(getProviderInferenceProtocols('minimax', runtime('anthropic'))).toEqual([
      'anthropic-messages',
    ]);
  });

  it('keeps a retained OpenAI-compatible provider chat-only by default', () => {
    expect(
      getProviderInferenceProtocols(
        'qwen',
        runtime('openai', { settings: { sdkType: 'openai', supportResponsesApi: true } }),
      ),
    ).toEqual(['openai-chat-completions']);
  });

  it('enables Responses only when a capable provider actually opts in', () => {
    expect(
      getProviderInferenceProtocols(
        'qwen',
        runtime('openai', {
          config: { enableResponseApi: true },
          settings: { sdkType: 'openai', supportResponsesApi: true },
        }),
      ),
    ).toEqual(['openai-responses', 'openai-chat-completions']);
  });

  it('routes Claude, Codex, and Kimi Code only to their supported protocols', () => {
    const claude = resolveHeterogeneousProviderBinding({
      agentType: 'claude-code',
      apiConfig: { model: 'claude-test', providerId: 'minimax' },
      providerEnabled: true,
      runtimeConfig: runtime('anthropic'),
    });
    expect(claude.resolution?.protocol).toBe('anthropic-messages');

    const codexChatOnly = resolveHeterogeneousProviderBinding({
      agentType: 'codex',
      apiConfig: { model: 'gpt-test', providerId: 'qwen' },
      providerEnabled: true,
      runtimeConfig: runtime('openai', {
        keyVaults: { apiKey: 'test-key', baseURL: 'https://example.com/v1' },
        settings: { sdkType: 'openai', supportResponsesApi: true },
      }),
    });
    expect(codexChatOnly.error?.code).toBe('protocolMismatch');

    const codexResponses = resolveHeterogeneousProviderBinding({
      agentType: 'codex',
      apiConfig: { model: 'gpt-test', providerId: 'qwen' },
      providerEnabled: true,
      runtimeConfig: runtime('openai', {
        config: { enableResponseApi: true },
        keyVaults: { apiKey: 'test-key', baseURL: 'https://example.com/v1/' },
        settings: { sdkType: 'openai', supportResponsesApi: true },
      }),
    });
    expect(codexResponses.resolution).toMatchObject({
      endpoint: 'https://example.com/v1',
      protocol: 'openai-responses',
    });

    const kimiAnthropic = resolveHeterogeneousProviderBinding({
      agentType: 'kimi-code',
      apiConfig: { model: 'claude-test', providerId: 'minimax' },
      providerEnabled: true,
      runtimeConfig: runtime('anthropic'),
    });
    expect(kimiAnthropic.resolution?.protocol).toBe('anthropic-messages');

    const kimiOpenAI = resolveHeterogeneousProviderBinding({
      agentType: 'kimi-code',
      apiConfig: { model: 'gpt-test', providerId: 'openai' },
      providerEnabled: true,
      runtimeConfig: runtime('openai'),
    });
    expect(kimiOpenAI.resolution?.protocol).toBe('openai-chat-completions');

    const kimiCustomWithoutEndpoint = resolveHeterogeneousProviderBinding({
      agentType: 'kimi-code',
      apiConfig: { model: 'gpt-test', providerId: 'qwen' },
      providerEnabled: true,
      runtimeConfig: runtime('openai'),
    });
    expect(kimiCustomWithoutEndpoint.error?.code).toBe('endpointMissing');

    const kimiGoogle = resolveHeterogeneousProviderBinding({
      agentType: 'kimi-code',
      apiConfig: { model: 'gemini-test', providerId: 'google' },
      providerEnabled: true,
      runtimeConfig: runtime('openai'),
    });
    expect(kimiGoogle.error?.code).toBe('providerUnavailable');
  });

  it('routes TRAE only to Responses providers', () => {
    const chatOnly = resolveHeterogeneousProviderBinding({
      agentType: 'trae',
      apiConfig: { model: 'model-test', providerId: 'qwen' },
      providerEnabled: true,
      runtimeConfig: runtime('openai', {
        keyVaults: { apiKey: 'test-key', baseURL: 'https://example.com/v1' },
        settings: { sdkType: 'openai', supportResponsesApi: true },
      }),
    });
    expect(chatOnly.error?.code).toBe('protocolMismatch');

    const responses = resolveHeterogeneousProviderBinding({
      agentType: 'trae',
      apiConfig: { model: 'model-test', providerId: 'qwen' },
      providerEnabled: true,
      runtimeConfig: runtime('openai', {
        config: { enableResponseApi: true },
        keyVaults: { apiKey: 'test-key', baseURL: 'https://example.com/v1/' },
        settings: { sdkType: 'openai', supportResponsesApi: true },
      }),
    });
    expect(responses.resolution).toMatchObject({
      endpoint: 'https://example.com/v1',
      protocol: 'openai-responses',
    });
  });

  it.each([
    {
      endpoint: 'https://chat.example.com/v1',
      expectedEndpoint: 'https://chat.example.com/v1',
      expectedProtocol: 'openai-chat-completions',
      providerId: 'qwen',
      sdkType: 'openai',
    },
    {
      endpoint: 'https://responses.example.com/v1/',
      expectedEndpoint: 'https://responses.example.com/v1',
      expectedProtocol: 'openai-responses',
      providerId: 'volcengine',
      responses: true,
      sdkType: 'openai',
    },
    {
      endpoint: 'https://messages.example.com',
      expectedEndpoint: 'https://messages.example.com',
      expectedProtocol: 'anthropic-messages',
      providerId: 'minimax',
      sdkType: 'anthropic',
    },
  ] as const)(
    'binds Pi to $expectedProtocol',
    ({ endpoint, expectedEndpoint, expectedProtocol, providerId, responses, sdkType }) => {
      const result = resolveHeterogeneousProviderBinding({
        agentType: 'pi',
        apiConfig: { model: 'model-test', providerId },
        providerEnabled: true,
        runtimeConfig: runtime(sdkType, {
          config: responses ? { enableResponseApi: true } : {},
          keyVaults: { apiKey: 'test-key', baseURL: endpoint },
          settings: {
            sdkType,
            ...(responses ? { supportResponsesApi: true } : {}),
          },
        }),
      });

      expect(result.resolution).toMatchObject({
        endpoint: expectedEndpoint,
        protocol: expectedProtocol,
      });
    },
  );

  it.each([['openai', 'openai', 'openai-responses', 'https://api.openai.com/v1']] as const)(
    'uses the canonical %s endpoint when no provider base URL is configured',
    (providerId, sdkType, protocol, endpoint) => {
      const result = resolveHeterogeneousProviderBinding({
        agentType: 'pi',
        apiConfig: { model: 'model-test', providerId },
        providerEnabled: true,
        runtimeConfig: runtime(sdkType),
      });

      expect(result.resolution).toMatchObject({ endpoint, protocol });
    },
  );

  it('requires a concrete endpoint for retained third-party Pi providers', () => {
    const result = resolveHeterogeneousProviderBinding({
      agentType: 'pi',
      apiConfig: { model: 'model-test', providerId: 'qwen' },
      providerEnabled: true,
      runtimeConfig: runtime('openai'),
    });

    expect(result.error).toEqual({ code: 'endpointMissing', providerId: 'qwen' });
  });

  it('carries server-resolved model capabilities into the binding resolution', () => {
    const modelMetadata = {
      abilities: { reasoning: true, vision: true },
      contextWindowTokens: 200_000,
      displayName: 'Bound model',
      id: 'model-test',
      maxOutput: 32_000,
      providerId: 'qwen',
      type: 'chat',
    };
    const result = resolveHeterogeneousProviderBinding({
      agentType: 'pi',
      apiConfig: { model: 'model-test', providerId: 'qwen' },
      enabledModels: [modelMetadata],
      providerEnabled: true,
      runtimeConfig: runtime('openai', {
        keyVaults: { apiKey: 'test-key', baseURL: 'https://example.com/v1' },
      }),
    });

    expect(result.resolution?.modelMetadata).toEqual(modelMetadata);
  });

  it.each([
    [
      'anthropic-messages',
      'minimax',
      runtime('anthropic', {
        keyVaults: { apiKey: 'test-key', baseURL: 'https://anthropic.example.com' },
      }),
    ],
    [
      'openai-chat-completions',
      'qwen',
      runtime('openai', {
        keyVaults: { apiKey: 'test-key', baseURL: 'https://chat.example.com/v1' },
      }),
    ],
    [
      'openai-responses',
      'volcengine',
      runtime('openai', {
        config: { enableResponseApi: true },
        keyVaults: { apiKey: 'test-key', baseURL: 'https://responses.example.com/v1' },
        settings: { sdkType: 'openai', supportResponsesApi: true },
      }),
    ],
  ] as const)('allows Grok Build on %s', (protocol, providerId, runtimeConfig) => {
    const result = resolveHeterogeneousProviderBinding({
      agentType: 'grok-build',
      apiConfig: { model: 'bound-model', providerId },
      providerEnabled: true,
      runtimeConfig,
    });

    expect(result.resolution?.protocol).toBe(protocol);
  });

  it('uses official endpoints for Grok Build and rejects Google or missing third-party endpoints', () => {
    expect(
      resolveHeterogeneousProviderBinding({
        agentType: 'grok-build',
        apiConfig: { model: 'gpt-test', providerId: 'openai' },
        providerEnabled: true,
        runtimeConfig: runtime('openai'),
      }).resolution,
    ).toMatchObject({ endpoint: 'https://api.openai.com/v1', protocol: 'openai-responses' });
    expect(
      resolveHeterogeneousProviderBinding({
        agentType: 'grok-build',
        apiConfig: { model: 'claude-test', providerId: 'minimax' },
        providerEnabled: true,
        runtimeConfig: runtime('anthropic'),
      }).resolution,
    ).toMatchObject({
      endpoint: 'https://api.minimaxi.com/anthropic',
      protocol: 'anthropic-messages',
    });
    expect(
      resolveHeterogeneousProviderBinding({
        agentType: 'grok-build',
        apiConfig: { model: 'gemini-test', providerId: 'google' },
        providerEnabled: true,
        runtimeConfig: runtime('openai'),
      }).error?.code,
    ).toBe('providerUnavailable');
    expect(
      resolveHeterogeneousProviderBinding({
        agentType: 'grok-build',
        apiConfig: { model: 'chat-test', providerId: 'qwen' },
        providerEnabled: true,
        runtimeConfig: runtime('openai'),
      }).error?.code,
    ).toBe('endpointMissing');
  });

  it.each(['claude-code', 'kimi-code', 'pi', 'grok-build'])(
    'never falls back to the official Anthropic endpoint for %s',
    (agentType) => {
      expect(
        resolveHeterogeneousProviderBinding({
          agentType,
          apiConfig: { model: 'MiniMax-M2.7', providerId: 'minimax' },
          providerEnabled: true,
          runtimeConfig: runtime('anthropic', { keyVaults: { apiKey: 'minimax-key' } }),
        }),
      ).toEqual({ error: { code: 'endpointMissing', providerId: 'minimax' } });
    },
  );

  it('validates credentials only inside the trusted host boundary', () => {
    const input = {
      agentType: 'claude-code',
      apiConfig: { model: 'claude-test', providerId: 'minimax' },
      providerEnabled: true,
      runtimeConfig: runtime('anthropic', {
        keyVaults: { baseURL: 'https://api.minimaxi.com/anthropic' },
      }),
    };
    expect(resolveHeterogeneousProviderBinding(input).error).toBeUndefined();
    expect(
      resolveHeterogeneousProviderBinding({ ...input, checkCredentials: true }).error?.code,
    ).toBe('credentialsMissing');
  });

  it('rejects unsupported protocols and agents without an implemented driver capability', () => {
    expect(
      resolveHeterogeneousProviderBinding({
        agentType: 'pi',
        apiConfig: { model: 'model', providerId: 'bedrock' },
        providerEnabled: true,
        runtimeConfig: runtime('openai'),
      }).error?.code,
    ).toBe('providerUnavailable');

    expect(
      resolveHeterogeneousProviderBinding({
        agentType: 'amp',
        apiConfig: { model: 'model', providerId: 'minimax' },
        providerEnabled: true,
        runtimeConfig: runtime('anthropic'),
      }).error?.code,
    ).toBe('agentUnsupported');
  });
});
