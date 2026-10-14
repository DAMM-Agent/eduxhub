// @vitest-environment node
import type { AgentState } from '@lobechat/agent-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';
import { getServerFeatureFlagsStateFromRuntimeConfig } from '@/server/featureFlags';

import { resolveLlmExecutionSite } from '../resolveLlmExecutionSite';

const getAiProviderById = vi.hoisted(() => vi.fn());

vi.mock('@/database/models/aiProvider', () => ({
  AiProviderModel: class {
    getAiProviderById = getAiProviderById;
  },
}));
vi.mock('@/server/featureFlags', () => ({
  getServerFeatureFlagsStateFromRuntimeConfig: vi.fn(),
}));
vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: { getUserKeyVaults: vi.fn() },
}));
vi.mock('@/server/modules/ModelRuntime', () => ({
  resolveRuntimeProvider: (provider: string) => provider,
}));

const executor = (providers: string[]) => ({
  host: {
    llmExecutor: { capabilities: ['llm_relay@1'], clientId: 'tab-a', providers },
  },
});
const resolve = (provider: string, state?: Pick<AgentState, 'host' | 'principal'>) =>
  resolveLlmExecutionSite({ db: {} as LobeChatDatabase, provider, state, userId: 'user-1' });

const clientConfig = {
  fetchOnClient: true,
  keyVaults: { apiKey: 'test-key', baseURL: 'http://127.0.0.1:1234/v1' },
};

describe('resolveLlmExecutionSite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiProviderById.mockResolvedValue(clientConfig);
    vi.mocked(getServerFeatureFlagsStateFromRuntimeConfig).mockResolvedValue({
      enableLlmRelay: true,
    } as Awaited<ReturnType<typeof getServerFeatureFlagsStateFromRuntimeConfig>>);
  });

  it('keeps a retained provider on the server while relay is disabled', async () => {
    vi.mocked(getServerFeatureFlagsStateFromRuntimeConfig).mockResolvedValue({
      enableLlmRelay: false,
    } as Awaited<ReturnType<typeof getServerFeatureFlagsStateFromRuntimeConfig>>);

    expect(await resolve('openai', executor(['openai']))).toEqual({ site: 'server' });
    expect(getAiProviderById).not.toHaveBeenCalled();
  });

  it.each(['ollama', 'lobehub', 'my-local-llm', 'volcenginecodingplan'])(
    'rejects %s before reading its saved credentials',
    async (provider) => {
      await expect(resolve(provider, executor([provider]))).rejects.toMatchObject({
        errorType: 'UnsupportedProvider',
      });
      expect(getAiProviderById).not.toHaveBeenCalled();
    },
  );

  it('also rejects removed providers when relay is disabled or the actor is a share visitor', async () => {
    vi.mocked(getServerFeatureFlagsStateFromRuntimeConfig).mockResolvedValue({
      enableLlmRelay: false,
    } as Awaited<ReturnType<typeof getServerFeatureFlagsStateFromRuntimeConfig>>);
    await expect(resolve('ollama')).rejects.toMatchObject({ errorType: 'UnsupportedProvider' });
    const state = { principal: { actor: { shareVisitor: { visitorUserId: 'v' } } } } as Pick<
      AgentState,
      'principal'
    >;
    await expect(resolve('ollama', state)).rejects.toMatchObject({
      errorType: 'UnsupportedProvider',
    });
    expect(await resolve('openai', state)).toEqual({ site: 'server' });
  });

  it('relays a retained provider with the same provider identity', async () => {
    getAiProviderById.mockResolvedValue({ ...clientConfig, settings: { sdkType: 'openai' } });
    expect(await resolve('deepseek', executor(['deepseek']))).toEqual({
      preferredClientId: 'tab-a',
      runtimeProvider: 'deepseek',
      site: 'client',
    });
  });

  it('reports unavailable when the client lacks the provider or relay capability', async () => {
    expect(await resolve('openai')).toEqual({ reason: 'no_executor', site: 'unavailable' });
    expect(await resolve('openai', executor(['deepseek']))).toEqual({
      reason: 'no_executor',
      site: 'unavailable',
    });
    expect(
      await resolve('openai', {
        host: {
          llmExecutor: {
            capabilities: ['llm_relay@9'],
            clientId: 'tab-a',
            providers: ['openai'],
          },
        },
      }),
    ).toEqual({ reason: 'no_executor', site: 'unavailable' });
  });

  it('keeps configured server requests on the server', async () => {
    getAiProviderById.mockResolvedValue({ ...clientConfig, fetchOnClient: false });
    expect(await resolve('openai', executor(['openai']))).toEqual({ site: 'server' });
  });

  it('relays a retained provider with only a base URL, matching the browser rule', async () => {
    getAiProviderById.mockResolvedValue({
      fetchOnClient: false,
      keyVaults: { baseURL: 'http://127.0.0.1:1234/v1' },
    });
    expect(await resolve('openai', executor(['openai']))).toMatchObject({ site: 'client' });
  });

  it('keeps providers that disallow browser requests on the server', async () => {
    expect(await resolve('volcengine', executor(['volcengine']))).toEqual({ site: 'server' });
  });
});
