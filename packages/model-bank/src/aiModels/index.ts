import { getModelKnowledgeCutoff } from '../const/knowledgeCutoff';
import { assertModelProvider, type ModelProvider } from '../const/modelProvider';
import { type AiFullModelCard, type LobeDefaultAiModelListItem } from '../types/aiModel';
import { default as deepseek } from './deepseek';
import { default as minimax } from './minimax';
import { default as moonshot } from './moonshot';
import { default as openai } from './openai';
import { default as qwen } from './qwen';
import { default as volcengine } from './volcengine';
import { default as zhipu } from './zhipu';

type ModelProviderLoader = () => Promise<AiFullModelCard[]>;
type ModelsMap = Record<string, AiFullModelCard[]>;

export interface LoadModelsOptions {
  providerLoaders?: Partial<Record<ModelProvider, ModelProviderLoader | undefined>>;
}

const buildDefaultModelList = (map: ModelsMap): LobeDefaultAiModelListItem[] => {
  let models: LobeDefaultAiModelListItem[] = [];

  Object.entries(map).forEach(([provider, providerModels]) => {
    const newModels = providerModels.map((model) => ({
      ...model,
      abilities: model.abilities ?? {},
      enabled: model.enabled || false,
      knowledgeCutoff: model.knowledgeCutoff ?? getModelKnowledgeCutoff(model.id),
      providerId: provider,
      source: 'builtin',
    }));
    models = models.concat(newModels);
  });

  return models;
};

const staticModelMap: ModelsMap = {
  deepseek,
  minimax,
  moonshot,
  openai,
  qwen,
  volcengine,
  zhipu,
};

export const LOBE_DEFAULT_MODEL_LIST = buildDefaultModelList(staticModelMap);

export const loadModels = async (
  options?: LoadModelsOptions,
): Promise<LobeDefaultAiModelListItem[]> => {
  const providerLoaders = options?.providerLoaders;
  for (const provider of Object.keys(providerLoaders || {})) assertModelProvider(provider);
  if (!providerLoaders || Object.keys(providerLoaders).length === 0) {
    return LOBE_DEFAULT_MODEL_LIST;
  }

  const validProviderLoaders = Object.entries(providerLoaders).flatMap(([provider, loader]) =>
    typeof loader === 'function' ? ([[provider as ModelProvider, loader]] as const) : [],
  );

  if (validProviderLoaders.length === 0) {
    return LOBE_DEFAULT_MODEL_LIST;
  }

  const modelMap = { ...staticModelMap };
  const entries = await Promise.all(
    validProviderLoaders.map(async ([provider, loader]) => [provider, await loader()] as const),
  );

  for (const [provider, models] of entries) {
    modelMap[provider] = models;
  }

  return buildDefaultModelList(modelMap);
};

export { gptImage1Schema, gptImage2Schema } from '../const/imageParameters';
export { default as deepseek } from './deepseek';
export { default as minimax } from './minimax';
export { default as moonshot } from './moonshot';
export { default as openai, openaiChatModels } from './openai';
export { default as qwen } from './qwen';
export { default as volcengine } from './volcengine';
export { default as zhipu } from './zhipu';
