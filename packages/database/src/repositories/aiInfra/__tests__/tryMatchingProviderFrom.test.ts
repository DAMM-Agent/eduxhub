import type { AiProviderRuntimeState } from '@lobechat/types';
import type { EnabledAiModel } from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiInfraRepos } from '../index';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AiInfraRepos', () => {
  describe('AiInfraRepos.tryMatchingProviderFrom', () => {
    const createRuntimeState = (models: EnabledAiModel[]): AiProviderRuntimeState => ({
      enabledAiModels: models,
      enabledAiProviders: [],
      enabledChatAiProviders: [],
      enabledImageAiProviders: [],
      enabledVideoAiProviders: [],
      runtimeConfig: {},
    });

    it('prefers provider order when multiple providers have model', async () => {
      const runtimeState = createRuntimeState([
        { abilities: {}, enabled: true, id: 'm-1', type: 'chat', providerId: 'minimax' },
        { abilities: {}, enabled: true, id: 'm-1', type: 'chat', providerId: 'openai' },
      ]);

      const providerId = await AiInfraRepos.tryMatchingProviderFrom(runtimeState, {
        modelId: 'm-1',
        preferredProviders: ['minimax', 'openai'],
      });

      expect(providerId).toBe('minimax');
    });

    it('ignores disabled models when matching', async () => {
      const runtimeState = createRuntimeState([
        { abilities: {}, enabled: false, id: 'm-1', type: 'chat', providerId: 'moonshot' },
        { abilities: {}, enabled: true, id: 'm-1', type: 'chat', providerId: 'openai' },
      ]);

      const providerId = await AiInfraRepos.tryMatchingProviderFrom(runtimeState, {
        modelId: 'm-1',
        preferredProviders: ['moonshot', 'openai'],
      });

      expect(providerId).toBe('openai');
    });

    it('falls back to provided fallback provider when no match', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runtimeState = createRuntimeState([]);

      const providerId = await AiInfraRepos.tryMatchingProviderFrom(runtimeState, {
        modelId: 'm-1',
        fallbackProvider: 'deepseek',
      });

      expect(providerId).toBe('deepseek');
      warnSpy.mockRestore();
    });
  });
});
