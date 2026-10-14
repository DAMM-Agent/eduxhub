import { type LobeDefaultAiModelListItem } from 'model-bank';
import { describe, expect, it } from 'vitest';

import { type EnabledProviderWithModels } from '@/types/aiProvider';

import { resolveEnableTargetProviderId, resolveStaleModelState } from './resolveStaleModelState';

const enabledList = [
  {
    children: [{ abilities: {}, displayName: 'Claude Opus 4.6', id: 'claude-opus-4-6' }],
    id: 'minimax',
    name: 'MiniMax',
    source: 'builtin',
  },
] as unknown as EnabledProviderWithModels[];

const builtinAiModelList = [
  {
    abilities: {},
    displayName: 'GPT-5.4 nano',
    enabled: false,
    id: 'gpt-5.4-nano',
    providerId: 'minimax',
    type: 'chat',
  },
] as unknown as LobeDefaultAiModelListItem[];

const context = { builtinAiModelList, enabledList, modelType: 'chat' as const };

describe('resolveStaleModelState', () => {
  it('returns undefined for a value present in the enabled list', () => {
    expect(
      resolveStaleModelState({ model: 'claude-opus-4-6', provider: 'minimax' }, context),
    ).toBeUndefined();
  });

  it.each(['google', 'lobehub', 'anthropic', 'volcenginecodingplan', 'custom-provider'])(
    'keeps %s unavailable despite stale caches, identical model IDs, or redirects',
    (provider) => {
      const value = { model: 'gpt-5.4-nano', provider };
      const staleContext = {
        ...context,
        enabledList: [
          {
            ...enabledList[0],
            id: provider,
            children: [{ ...enabledList[0].children[0], id: value.model }],
          },
        ],
        builtinAiModelList: [
          ...builtinAiModelList,
          { ...builtinAiModelList[0], providerId: provider },
        ],
        modelRedirects: { [`${provider}/${value.model}`]: 'gpt-successor' },
      };
      expect(resolveStaleModelState(value, staleContext)).toEqual({ status: 'removed' });
      expect(
        resolveEnableTargetProviderId(value, {
          enabledAiProviders: [{ id: provider }],
          enabledList: staleContext.enabledList,
          metaProviderId: 'openai',
        }),
      ).toBeUndefined();
      expect(value).toEqual({ model: 'gpt-5.4-nano', provider });
    },
  );

  it('returns undefined when there is no value', () => {
    expect(resolveStaleModelState(undefined, context)).toBeUndefined();
  });

  it('resolves a disabled builtin model as notEnabled with its metadata', () => {
    const state = resolveStaleModelState({ model: 'gpt-5.4-nano', provider: 'minimax' }, context);

    expect(state?.status).toBe('notEnabled');
    expect(state?.meta?.displayName).toBe('GPT-5.4 nano');
  });

  it('falls back to an id-only match when the provider does not match', () => {
    const state = resolveStaleModelState({ model: 'gpt-5.4-nano', provider: 'openai' }, context);

    expect(state?.status).toBe('notEnabled');
    expect(state?.meta?.displayName).toBe('GPT-5.4 nano');
  });

  it('resolves an unknown model id as removed', () => {
    const state = resolveStaleModelState({ model: 'gpt-4o-mini', provider: 'openai' }, context);

    expect(state?.status).toBe('removed');
    expect(state?.meta).toBeUndefined();
  });

  it('does not treat a same-id model under another enabled provider as enabled', () => {
    const state = resolveStaleModelState(
      { model: 'claude-opus-4-6', provider: 'bedrock' },
      context,
    );

    expect(state?.status).toBe('removed');
  });

  it('ignores builtin models of a different type', () => {
    const state = resolveStaleModelState(
      { model: 'gpt-5.4-nano', provider: 'minimax' },
      { ...context, modelType: 'embedding' },
    );

    expect(state?.status).toBe('removed');
  });

  describe('resolveEnableTargetProviderId', () => {
    it('prefers the persisted provider when it has enabled models of this type', () => {
      expect(
        resolveEnableTargetProviderId(
          { model: 'gpt-5.4-nano', provider: 'minimax' },
          { enabledList, metaProviderId: 'openai' },
        ),
      ).toBe('minimax');
    });

    it('prefers the persisted provider when it is enabled without models of this type', () => {
      expect(
        resolveEnableTargetProviderId(
          { model: 'gpt-5.4-nano', provider: 'minimax' },
          {
            enabledAiProviders: [{ id: 'minimax' }],
            enabledList: [],
            metaProviderId: 'openai',
          },
        ),
      ).toBe('minimax');
    });

    it('does not revive a removed provider through a same-name builtin model', () => {
      expect(
        resolveEnableTargetProviderId(
          { model: 'gpt-5.4-nano', provider: 'legacy-provider' },
          { enabledAiProviders: [{ id: 'minimax' }], enabledList, metaProviderId: 'openai' },
        ),
      ).toBeUndefined();
    });

    it('falls back to the builtin provider when the value has no provider', () => {
      expect(
        resolveEnableTargetProviderId(
          { model: 'gpt-5.4-nano' },
          { enabledList, metaProviderId: 'openai' },
        ),
      ).toBe('openai');
    });
  });

  describe('redirected', () => {
    const modelRedirects = { 'minimax/gemini-3.1-flash-lite-preview': 'gemini-3.1-flash-lite' };
    const withSuccessorMeta = [
      ...builtinAiModelList,
      {
        abilities: {},
        displayName: 'Gemini 3.1 Flash Lite',
        id: 'gemini-3.1-flash-lite',
        providerId: 'minimax',
        type: 'chat',
      },
    ] as unknown as LobeDefaultAiModelListItem[];

    it('resolves a redirect-mapped id as redirected with successor metadata', () => {
      const state = resolveStaleModelState(
        { model: 'gemini-3.1-flash-lite-preview', provider: 'minimax' },
        { ...context, builtinAiModelList: withSuccessorMeta, modelRedirects },
      );

      expect(state?.status).toBe('redirected');
      expect(state?.successorId).toBe('gemini-3.1-flash-lite');
      expect(state?.successor?.displayName).toBe('Gemini 3.1 Flash Lite');
    });

    it('keeps successorId even when the successor has no builtin metadata', () => {
      const state = resolveStaleModelState(
        { model: 'gemini-3.1-flash-lite-preview', provider: 'minimax' },
        { ...context, modelRedirects },
      );

      expect(state?.status).toBe('redirected');
      expect(state?.successorId).toBe('gemini-3.1-flash-lite');
      expect(state?.successor).toBeUndefined();
    });

    it('prefers the notEnabled state when the id still exists in the builtin bank', () => {
      const state = resolveStaleModelState(
        { model: 'gpt-5.4-nano', provider: 'minimax' },
        { ...context, modelRedirects: { 'minimax/gpt-5.4-nano': 'gpt-5.5-nano' } },
      );

      expect(state?.status).toBe('notEnabled');
    });

    it('does not treat a same-named model under an unrelated provider as redirected', () => {
      const state = resolveStaleModelState(
        { model: 'gemini-3.1-flash-lite-preview', provider: 'openai' },
        { ...context, modelRedirects },
      );

      expect(state?.status).toBe('removed');
    });

    it('falls through to removed when the id is not in the redirect map', () => {
      const state = resolveStaleModelState(
        { model: 'gpt-4o-mini', provider: 'openai' },
        { ...context, modelRedirects },
      );

      expect(state?.status).toBe('removed');
    });
  });
});
