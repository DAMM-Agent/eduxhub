import type { UserModelProviderConfig } from '@lobechat/types';
import { ModelProvider } from 'model-bank/modelProvider';

const providerDefaults: Partial<
  Record<ModelProvider, { enabled?: boolean; enabledModels?: string[]; fetchOnClient?: boolean }>
> = {
  [ModelProvider.DeepSeek]: { enabled: true },
  [ModelProvider.OpenAI]: { enabled: true },
};

const genUserLLMConfig = (): UserModelProviderConfig => {
  return Object.values(ModelProvider).reduce((config, provider) => {
    const providerConfig = providerDefaults[provider];

    config[provider] = {
      enabled: providerConfig?.enabled ?? false,
      enabledModels: providerConfig?.enabledModels ?? [],
      ...(providerConfig?.fetchOnClient !== undefined && {
        fetchOnClient: providerConfig.fetchOnClient,
      }),
    };

    return config;
  }, {} as UserModelProviderConfig);
};

export const DEFAULT_LLM_CONFIG = genUserLLMConfig();
