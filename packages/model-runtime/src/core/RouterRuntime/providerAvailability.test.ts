import { UnsupportedModelProviderError } from 'model-bank/modelProvider';
import { describe, expect, it, vi } from 'vitest';

import type { LobeRuntimeAI } from '../BaseAI';
import { ModelRuntime } from '../ModelRuntime';
import type { ApiType } from './apiTypes';
import { createRouterRuntime } from './createRuntime';

const removedProviders = [
  'anthropic',
  'google',
  'bedrock',
  'lobehub',
  'volcenginecodingplan',
  'custom-provider',
];

describe('removed provider runtime boundaries', () => {
  it.each(removedProviders)(
    'refuses to initialize %s as an OpenAI-compatible provider',
    (provider) => {
      expect(() =>
        ModelRuntime.initializeWithProvider(provider, {
          apiKey: 'saved-key',
          baseURL: 'https://proxy.example.test/v1',
        }),
      ).toThrow(UnsupportedModelProviderError);
    },
  );

  it.each(removedProviders)(
    'does not fall through a %s router option to a retained channel',
    async (provider) => {
      const chat = vi.fn();
      class RetainedRuntime implements LobeRuntimeAI {
        chat = chat;
      }
      const Runtime = createRouterRuntime({
        id: 'minimax',
        routers: [
          {
            apiType: 'openai',
            models: ['model'],
            runtime: RetainedRuntime,
            options: [
              { apiType: provider as ApiType, apiKey: 'removed-key' },
              { apiKey: 'retained-key' },
            ],
          },
        ],
      });

      await expect(new Runtime().chat({ messages: [], model: 'model' })).rejects.toBeInstanceOf(
        UnsupportedModelProviderError,
      );
      expect(chat).not.toHaveBeenCalled();
    },
  );

  it.each(['deepseek', 'minimax', 'moonshot'])(
    'keeps the explicit Anthropic wire adapter for %s',
    async (provider) => {
      const chat = vi.fn().mockResolvedValue(new Response('compatible reply'));
      class CompatibleRuntime implements LobeRuntimeAI {
        chat = chat;
      }
      const Runtime = createRouterRuntime({
        id: provider,
        routers: [{ apiType: 'anthropic', options: {}, runtime: CompatibleRuntime }],
      });

      expect(await (await new Runtime().chat({ messages: [], model: 'model' })).text()).toBe(
        'compatible reply',
      );
      expect(chat).toHaveBeenCalledOnce();
    },
  );
});
