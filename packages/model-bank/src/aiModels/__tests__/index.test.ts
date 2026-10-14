import { describe, expect, it, vi } from 'vitest';

import { ModelProvider } from '../../const/modelProvider';
import { loadModels, LOBE_DEFAULT_MODEL_LIST } from '../index';

describe('loadModels', () => {
  it('returns the static model list by default', async () => {
    await expect(loadModels()).resolves.toBe(LOBE_DEFAULT_MODEL_LIST);
  });

  it('overrides provider models with injected async loaders', async () => {
    const loader = vi.fn().mockResolvedValue([
      {
        enabled: true,
        id: 'injected-openai-model',
        type: 'chat',
      },
    ]);

    const models = await loadModels({
      providerLoaders: {
        [ModelProvider.OpenAI]: loader,
      },
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enabled: true,
          id: 'injected-openai-model',
          providerId: ModelProvider.OpenAI,
          source: 'builtin',
          type: 'chat',
        }),
      ]),
    );
  });

  it('ignores undefined provider loaders', async () => {
    await expect(
      loadModels({
        providerLoaders: {
          [ModelProvider.OpenAI]: undefined,
        },
      }),
    ).resolves.toBe(LOBE_DEFAULT_MODEL_LIST);
  });

  it('propagates injected loader errors without falling back to static models', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('model config missing'));

    await expect(
      loadModels({
        providerLoaders: {
          [ModelProvider.OpenAI]: loader,
        },
      }),
    ).rejects.toThrow('model config missing');
  });
});

describe('knowledgeCutoff backfill', () => {
  it('fills knowledgeCutoff from the canonical map for retained models', () => {
    const model = LOBE_DEFAULT_MODEL_LIST.find(
      (m) => m.providerId === 'openai' && m.id === 'gpt-5-mini',
    );
    expect(model?.knowledgeCutoff).toBe('2024-05');
  });

  it('keeps an explicit knowledgeCutoff over the map value', async () => {
    const loader = vi.fn().mockResolvedValue([
      { enabled: true, id: 'gpt-5', knowledgeCutoff: '2020-01', type: 'chat' },
      { enabled: true, id: 'gpt-5-mini', type: 'chat' },
    ]);

    const models = await loadModels({
      providerLoaders: { [ModelProvider.OpenAI]: loader },
    });

    const lobehubModels = models.filter((m) => m.providerId === ModelProvider.OpenAI);
    expect(lobehubModels.find((m) => m.id === 'gpt-5')?.knowledgeCutoff).toBe('2020-01');
    expect(lobehubModels.find((m) => m.id === 'gpt-5-mini')?.knowledgeCutoff).toBe('2024-05');
  });
});

describe('OpenAI audio models', () => {
  it('advertises native audio support for gpt-audio', () => {
    const gptAudio = LOBE_DEFAULT_MODEL_LIST.find(
      (model) => model.providerId === ModelProvider.OpenAI && model.id === 'gpt-audio',
    );

    expect(gptAudio?.abilities.audio).toBe(true);
  });
});

describe('Moonshot models', () => {
  it('advertises Kimi K3 reasoning effort controls', () => {
    const kimiK3 = LOBE_DEFAULT_MODEL_LIST.find(
      (model) => model.providerId === ModelProvider.Moonshot && model.id === 'kimi-k3',
    );

    expect(kimiK3?.settings?.extendParams).toContain('kimiK3ReasoningEffort');
  });
});

describe('MiniMax video models', () => {
  it('registers MiniMax-H3 with the official v2 parameter limits', () => {
    const h3 = LOBE_DEFAULT_MODEL_LIST.find(
      (model) => model.providerId === ModelProvider.Minimax && model.id === 'MiniMax-H3',
    );

    expect(h3).toEqual(
      expect.objectContaining({
        enabled: true,
        parameters: expect.objectContaining({
          aspectRatio: expect.objectContaining({ default: '16:9' }),
          duration: expect.objectContaining({ max: 15, min: 4 }),
          imageUrls: expect.objectContaining({ maxCount: 9 }),
          resolution: expect.objectContaining({ default: '768P', enum: ['768P', '2K'] }),
        }),
        releasedAt: '2026-07-31',
        type: 'video',
      }),
    );
  });

  it('lets References mode fill the whole MiniMax-H3 reference pool of 9', () => {
    const h3 = LOBE_DEFAULT_MODEL_LIST.find(
      (model) => model.providerId === ModelProvider.Minimax && model.id === 'MiniMax-H3',
    );

    // The UI's References mode clears the frame slots and submits only imageUrls, so the
    // reference slot alone must allow the full pool the v2 API accepts.
    expect((h3?.parameters as { imageUrls?: { maxCount?: number } })?.imageUrls?.maxCount).toBe(9);
  });
});

describe('vendor provider cards', () => {
  it('advertises native search, image and video input for GLM-5.3-Flash', () => {
    // Without `video: true` the chat pipeline falls back to media analysis instead of sending
    // video to the model natively, even though the official card lists video input.
    const glm53Flash = LOBE_DEFAULT_MODEL_LIST.find(
      (m) => m.providerId === 'zhipu' && m.id === 'glm-5.3-flash',
    );

    expect(glm53Flash?.abilities).toEqual(
      expect.objectContaining({ reasoning: true, search: true, video: true, vision: true }),
    );
    expect(glm53Flash?.settings?.searchImpl).toBe('params');
  });
});

describe('recent direct-provider models', () => {
  it('registers GPT-6.1 Sol with its published limits, pricing, and reasoning controls', () => {
    const model = LOBE_DEFAULT_MODEL_LIST.find(
      (entry) => entry.providerId === ModelProvider.OpenAI && entry.id === 'gpt-6.1-sol',
    );

    expect(model).toMatchObject({
      contextWindowTokens: 1_050_000,
      enabled: true,
      generation: 'gpt-6.1',
      knowledgeCutoff: '2026-04',
      maxOutput: 128_000,
      settings: { extendParams: ['gpt6ReasoningEffort', 'textVerbosity'] },
    });
    expect(model?.pricing?.units).toContainEqual({
      name: 'textInput_cacheRead',
      strategy: 'tiered',
      tiers: [
        { rate: 0.1, upTo: 272_000 },
        { rate: 0.2, upTo: 'infinity' },
      ],
      unit: 'millionTokens',
    });
  });

  it.each(['qwen3.8-max', 'qwen3.8-max-0902'])(
    'exposes exactly one %s card with effort and thinking preservation controls',
    (id) => {
      const models = LOBE_DEFAULT_MODEL_LIST.filter(
        (entry) => entry.providerId === 'qwen' && entry.id === id,
      );
      expect(models).toHaveLength(1);
      expect(models[0].settings?.extendParams).toEqual([
        'qwen38ReasoningEffort',
        'preserveThinking',
      ]);
    },
  );

  it.each([
    ['openai', 'gpt-6-astra', 'gpt6ReasoningEffort'],
    ['qwen', 'qwen3.8-max', 'qwen38ReasoningEffort'],
    ['qwen', 'qwen3.8-max-0902', 'qwen38ReasoningEffort'],
  ])('exposes %s/%s with its reasoning controls', (providerId, id, reasoningParam) => {
    const model = LOBE_DEFAULT_MODEL_LIST.find(
      (entry) => entry.providerId === providerId && entry.id === id,
    );

    expect(model).toMatchObject({
      abilities: { functionCall: true, reasoning: true, vision: true },
      enabled: true,
      type: 'chat',
    });
    expect(model?.settings?.extendParams).toContain(reasoningParam);
  });
});
