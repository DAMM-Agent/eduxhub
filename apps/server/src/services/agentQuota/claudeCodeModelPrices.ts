import type { QuotaModelPrice } from '@lobechat/heterogeneous-agents/quota';

/** Native Claude Code quota accounting only; never registered as product model providers.
 * Fixed rates preserved from the pre-crop catalog. Unknown/tiered prices stay unestimated.
 */
export const CLAUDE_CODE_MODEL_PRICES: Partial<Record<string, QuotaModelPrice>> = {
  'claude-opus-5-5': {
    cacheRead: 0.2,
    cacheWrite5m: 5,
    input: 4,
    output: 20,
  },
  'claude-fable-5-1': {
    cacheRead: 0.25,
    cacheWrite5m: 12.5,
    input: 10,
    output: 50,
  },
  'claude-fable-5': {
    cacheRead: 1,
    cacheWrite5m: 12.5,
    input: 10,
    output: 50,
  },
  'claude-opus-5': {
    cacheRead: 0.5,
    cacheWrite5m: 6.25,
    input: 5,
    output: 25,
  },
  'claude-sonnet-5': {
    cacheRead: 0.2,
    cacheWrite5m: 2.5,
    input: 2,
    output: 10,
  },
  'claude-opus-4-8': {
    cacheRead: 0.5,
    cacheWrite5m: 6.25,
    input: 5,
    output: 25,
  },
  'claude-opus-4-7': {
    cacheRead: 0.5,
    cacheWrite5m: 6.25,
    input: 5,
    output: 25,
  },
  'claude-opus-4-6': {
    cacheRead: 0.5,
    input: 5,
    output: 25,
  },
  'claude-sonnet-4-6': {
    cacheRead: 0.3,
    input: 3,
    output: 15,
  },
  'claude-opus-4-5-20251101': {
    cacheRead: 0.5,
    input: 5,
    output: 25,
  },
  'claude-sonnet-4-5-20250929': {
    cacheRead: 0.3,
    cacheWrite5m: 3.75,
    input: 3,
    output: 15,
  },
  'claude-haiku-4-5-20251001': {
    cacheRead: 0.1,
    input: 1,
    output: 5,
  },
};
