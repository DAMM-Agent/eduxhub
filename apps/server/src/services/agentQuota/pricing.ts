import type { QuotaModelPrice } from '@lobechat/heterogeneous-agents/quota';
import openaiModels from 'model-bank/openai';

import { CLAUDE_CODE_MODEL_PRICES } from './claudeCodeModelPrices';

/**
 * $ per million tokens for a model, from the model bank. The bank lists the
 * base input/output rates plus the cache-read and 5-minute cache-write rates
 * when the provider has them (OpenAI has no cache-write tier, so it stays
 * undefined); the 1-hour write rate is derived inside `computeTurnCostUsd`
 * (2x base input) when not provided. Returns null for models the bank doesn't
 * know — the caller should then store the tokens without a computed cost
 * rather than guess a price.
 */
interface BankModelCard {
  id: string;
  pricing?: { units?: { name: string; rate?: number; unit: string }[] };
}

const bankModelPrice = (
  models: readonly BankModelCard[],
  modelId: string,
): QuotaModelPrice | null => {
  const model = models.find((m) => m.id === modelId);
  const units = model?.pricing?.units;
  if (!units) return null;

  const rate = (name: string) => {
    const unit = units.find((u) => u.name === name && u.unit === 'millionTokens');
    return unit && 'rate' in unit ? unit.rate : undefined;
  };

  const input = rate('textInput');
  const output = rate('textOutput');
  if (input === undefined || output === undefined) return null;

  return {
    cacheRead: rate('textInput_cacheRead'),
    cacheWrite5m: rate('textInput_cacheWrite'),
    input,
    output,
  };
};

export const claudeModelPrice = (modelId: string): QuotaModelPrice | null =>
  CLAUDE_CODE_MODEL_PRICES[modelId] ?? null;

/** Codex turns run OpenAI models, priced out of the bank's openai table. */
export const codexModelPrice = (modelId: string): QuotaModelPrice | null =>
  bankModelPrice(openaiModels, modelId);
