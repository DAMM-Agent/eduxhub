import { CLIENT_VERSION_HEADER, CURRENT_VERSION } from '@lobechat/const';
import type { OpenAICompatibleKeyVault } from '@lobechat/types';
import { clientApiKeyManager } from '@lobechat/utils/client/apiKeyManager';
import { assertModelProvider } from 'model-bank/modelProvider';

import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';

import { resolveRuntimeProvider } from './chat/helper';

export const getProviderAuthPayload = (provider: string, keyVaults: OpenAICompatibleKeyVault) => {
  assertModelProvider(provider);
  return { apiKey: clientApiKeyManager.pick(keyVaults.apiKey), baseURL: keyVaults.baseURL };
};

interface AuthParams {
  headers?: HeadersInit;
  provider?: string;
}

export const createPayloadWithKeyVaults = (provider: string) => {
  const keyVaults =
    aiProviderSelectors.providerKeyVaults(provider)(useAiInfraStore.getState()) || {};

  const runtimeProvider = resolveRuntimeProvider(provider);

  return {
    ...getProviderAuthPayload(runtimeProvider, keyVaults as any),
    runtimeProvider,
  };
};

export const createHeaderWithAuth = async (params?: AuthParams): Promise<HeadersInit> => {
  const headers = new Headers(params?.headers);
  headers.set(CLIENT_VERSION_HEADER, CURRENT_VERSION);

  return Object.fromEntries(headers.entries());
};
