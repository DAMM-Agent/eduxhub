import type { LobeRuntimeAI } from '../BaseAI';

// Anthropic is an internal wire protocol, available only with an explicit retained-provider runtime.
export type ApiType =
  'anthropic' | 'deepseek' | 'minimax' | 'moonshot' | 'openai' | 'qwen' | 'volcengine' | 'zhipu';

export type RuntimeClass = new (options?: any) => LobeRuntimeAI;
