import { isModelProvider } from '../const/modelProvider';
import type { ChatModelCard, ModelProviderCard } from '../types';
import DeepSeekProvider from './deepseek';
import MinimaxProvider from './minimax';
import MoonshotProvider from './moonshot';
import OpenAIProvider from './openai';
import QwenProvider from './qwen';
import VolcengineProvider from './volcengine';
import ZhiPuProvider from './zhipu';

export const DEFAULT_MODEL_PROVIDER_LIST: ModelProviderCard[] = [
  DeepSeekProvider,
  MinimaxProvider,
  MoonshotProvider,
  OpenAIProvider,
  QwenProvider,
  VolcengineProvider,
  ZhiPuProvider,
];

/** @deprecated Use the model catalog in aiModels. */
export const LOBE_DEFAULT_MODEL_LIST: ChatModelCard[] = DEFAULT_MODEL_PROVIDER_LIST.flatMap(
  (provider) => provider.chatModels,
);

export const filterEnabledModels = (provider: ModelProviderCard) => {
  return provider.chatModels.filter((v) => v.enabled).map((m) => m.id);
};

export const isProviderDisableBrowserRequest = (id: string) => {
  const provider = DEFAULT_MODEL_PROVIDER_LIST.find(
    (v) => v.id === id && (v.disableBrowserRequest || v.settings?.disableBrowserRequest),
  );
  return !!provider;
};

export interface ProviderFetchOnClientConfig {
  /** The user's choice, else the deployment's override for the provider. */
  fetchOnClient?: boolean;
  keyVaults?: { apiKey?: string; baseURL?: string };
}

/**
 * Whether requests to `provider` must leave from the user's device rather than
 * the server — the single rule the client and the server both apply, so the
 * server never relays a call the client did not prepare for (or the reverse).
 *
 * 1. A provider that disables browser requests always runs on the server.
 * 3. Neither a base URL nor an API key: the server's own configuration.
 * 4. Only a base URL: an endpoint the server may not reach, so the device.
 * 5. Otherwise `fetchOnClient`, default the server.
 */
export const isProviderFetchOnClient = (
  provider: string,
  config: ProviderFetchOnClientConfig | undefined,
): boolean => {
  if (!isModelProvider(provider) || isProviderDisableBrowserRequest(provider)) return false;

  const hasEndpoint = !!config?.keyVaults?.baseURL;
  const hasApiKey = !!config?.keyVaults?.apiKey;
  if (!hasEndpoint && !hasApiKey) return false;
  if (hasEndpoint && !hasApiKey) return true;

  return config?.fetchOnClient ?? false;
};

/**
 * Human-readable provider name for a provider id (`openai` → `OpenAI`). Unknown ids
 * (custom providers, typos) fall back to the id itself so callers always get a
 * non-empty label.
 */
export const getProviderDisplayName = (id: string) =>
  DEFAULT_MODEL_PROVIDER_LIST.find((provider) => provider.id === id)?.name || id;

export const isProviderOAuthDeviceFlow = (id?: string) =>
  DEFAULT_MODEL_PROVIDER_LIST.some(
    (provider) => provider.id === id && provider.settings?.authType === 'oauthDeviceFlow',
  );

export { default as DeepSeekProviderCard } from './deepseek';
export { default as MinimaxProviderCard } from './minimax';
export { default as MoonshotProviderCard } from './moonshot';
export { default as OpenAIProviderCard } from './openai';
export { default as QwenProviderCard } from './qwen';
export { default as VolcengineProviderCard } from './volcengine';
export { default as ZhiPuProviderCard } from './zhipu';
