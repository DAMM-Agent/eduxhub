import { type EnabledAiModel, ModelProvider } from 'model-bank';
import { afterEach, describe, expect, it } from 'vitest';

import { useAiInfraStore } from '@/store/aiInfra';

import {
  getRuntimeModelKnowledgeCutoff,
  isCanUseAudio,
  isCanUseVideo,
  isCanUseVision,
} from './helper';

describe('chat helper', () => {
  afterEach(() => {
    useAiInfraStore.setState({ enabledAiModels: [] });
  });

  it('does not restore removed provider abilities from another provider', () => {
    useAiInfraStore.setState({
      enabledAiModels: [
        {
          abilities: { audio: true, video: true, vision: true },
          id: 'gemini-3.1-flash-lite-preview',
          providerId: 'google',
          type: 'chat',
        } as EnabledAiModel,
      ],
    });

    expect(isCanUseVision('gemini-3.1-flash-lite-preview', 'lobehub')).toBe(false);
    expect(isCanUseVideo('gemini-3.1-flash-lite-preview', 'lobehub')).toBe(false);
    expect(isCanUseAudio('gemini-3.1-flash-lite-preview', 'lobehub')).toBe(false);
  });

  it('should not fallback across non-LobeHub providers', () => {
    useAiInfraStore.setState({
      enabledAiModels: [
        {
          abilities: { audio: true, video: true, vision: true },
          id: 'gemini-3.1-flash-lite-preview',
          providerId: 'google',
          type: 'chat',
        } as EnabledAiModel,
      ],
    });

    expect(isCanUseVision('gemini-3.1-flash-lite-preview', ModelProvider.OpenAI)).toBe(false);
    expect(isCanUseVideo('gemini-3.1-flash-lite-preview', ModelProvider.OpenAI)).toBe(false);
    expect(isCanUseAudio('gemini-3.1-flash-lite-preview', ModelProvider.OpenAI)).toBe(false);
  });

  it('should resolve exact model knowledge cutoff', () => {
    useAiInfraStore.setState({
      enabledAiModels: [
        {
          id: 'gpt-4o',
          knowledgeCutoff: '2023-10',
          providerId: ModelProvider.OpenAI,
          type: 'chat',
        } as EnabledAiModel,
      ],
    });

    expect(getRuntimeModelKnowledgeCutoff('gpt-4o', ModelProvider.OpenAI)).toBe('2023-10');
  });

  it('does not restore removed provider metadata from another provider', () => {
    useAiInfraStore.setState({
      enabledAiModels: [
        {
          id: 'gemini-3.1-flash-lite-preview',
          knowledgeCutoff: '2025-01',
          providerId: 'google',
          type: 'chat',
        } as EnabledAiModel,
      ],
    });

    expect(
      getRuntimeModelKnowledgeCutoff('gemini-3.1-flash-lite-preview', 'lobehub'),
    ).toBeUndefined();
  });

  it('should not fallback model knowledge cutoff across non-LobeHub providers', () => {
    useAiInfraStore.setState({
      enabledAiModels: [
        {
          id: 'gemini-3.1-flash-lite-preview',
          knowledgeCutoff: '2025-01',
          providerId: 'google',
          type: 'chat',
        } as EnabledAiModel,
      ],
    });

    expect(
      getRuntimeModelKnowledgeCutoff('gemini-3.1-flash-lite-preview', ModelProvider.OpenAI),
    ).toBeUndefined();
  });
});
