import { z } from 'zod';

export enum ModelProvider {
  DeepSeek = 'deepseek',
  Minimax = 'minimax',
  Moonshot = 'moonshot',
  OpenAI = 'openai',
  Qwen = 'qwen',
  Volcengine = 'volcengine',
  ZhiPu = 'zhipu',
}

/** Stable product provider identities. SDK protocol names are separate from this registry. */
export const SUPPORTED_MODEL_PROVIDERS = Object.values(ModelProvider);
const supportedProviderSet = new Set<string>(SUPPORTED_MODEL_PROVIDERS);

export const isModelProvider = (provider: string): provider is ModelProvider =>
  supportedProviderSet.has(provider);

export class UnsupportedModelProviderError extends Error {
  readonly errorType = 'UnsupportedProvider';
  readonly error: { message: string; provider: string };

  constructor(readonly provider: string) {
    super(`Model provider "${provider}" is no longer supported. Select a supported provider.`);
    this.name = 'UnsupportedModelProviderError';
    this.error = { message: this.message, provider };
  }
}

export function assertModelProvider(provider: string): asserts provider is ModelProvider {
  if (!isModelProvider(provider)) throw new UnsupportedModelProviderError(provider);
}

export const ModelProviderSchema = z
  .string()
  .refine((provider): boolean => isModelProvider(provider), {
    message:
      'UnsupportedProvider: this model provider is no longer supported. Select a supported provider.',
  });

export type ModelProviderKey = Lowercase<keyof typeof ModelProvider>;
