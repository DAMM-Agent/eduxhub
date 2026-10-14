import { ModelRuntime } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { SUPPORTED_MODEL_PROVIDERS, UnsupportedModelProviderError } from 'model-bank';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAiInfraStore } from '@/store/aiInfra';

import { initializeWithClientStore } from './clientModelRuntime';

afterEach(() => {
  useAiInfraStore.setState({ aiProviderRuntimeConfig: {} });
  vi.restoreAllMocks();
});

describe('browser model runtime', () => {
  it.each(SUPPORTED_MODEL_PROVIDERS)('uses %s and its saved key', async (provider) => {
    useAiInfraStore.setState({
      aiProviderRuntimeConfig: {
        [provider]: {
          config: {},
          keyVaults: { apiKey: 'user-key', baseURL: 'https://api.example.test/v1' },
          settings: {},
        },
      },
    });
    const initialize = vi.spyOn(ModelRuntime, 'initializeWithProvider');
    await initializeWithClientStore({ provider });
    expect(initialize).toHaveBeenCalledWith(
      provider,
      expect.objectContaining({
        apiKey: 'user-key',
        baseURL: 'https://api.example.test/v1',
        dangerouslyAllowBrowser: true,
      }),
    );
  });

  it.each(['google', 'anthropic', 'lobehub', 'volcenginecodingplan', 'custom-provider'])(
    'rejects %s before loading credentials or initializing a runtime',
    async (provider) => {
      useAiInfraStore.setState({
        aiProviderRuntimeConfig: {
          [provider]: {
            config: {},
            keyVaults: { apiKey: 'old-key' },
            settings: { sdkType: 'openai' },
          },
        },
      });
      const initialize = vi.spyOn(ModelRuntime, 'initializeWithProvider');
      await expect(
        initializeWithClientStore({ provider, runtimeProvider: 'openai' }),
      ).rejects.toThrow(UnsupportedModelProviderError);
      expect(initialize).not.toHaveBeenCalled();
    },
  );

  it('rejects a mismatched retained runtime identity', async () => {
    await expect(
      initializeWithClientStore({ provider: 'minimax', runtimeProvider: 'openai' }),
    ).rejects.toMatchObject({
      errorType: ChatErrorType.BadRequest,
      error: { message: expect.stringContaining('Runtime provider must match') },
    });
  });
});
