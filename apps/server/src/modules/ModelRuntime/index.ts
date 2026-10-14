import { DEFAULT_PROVIDER } from '@lobechat/business-const';
import type { ServerDefaultHeterogeneousAgentType } from '@lobechat/heterogeneous-agents';
import {
  SERVER_DEFAULT_HETEROGENEOUS_AGENT_CONFIG,
  SERVER_DEFAULT_HETEROGENEOUS_AGENT_TYPES,
} from '@lobechat/heterogeneous-agents';
import {
  AgentRuntimeError,
  mergeModelRuntimeHooks,
  ModelRuntime,
  type ModelRuntimeHooks,
} from '@lobechat/model-runtime';
import { parseClaudeModelId } from '@lobechat/model-runtime/anthropicCompatible/modelId';
import { isResponsesAPIModel } from '@lobechat/model-runtime/providers/openai/modelId';
import {
  ChatErrorType,
  type ClientSecretPayload,
  type OpenAICompatibleKeyVault,
  type ServerDefaultHeterogeneousModelDescriptor,
} from '@lobechat/types';
import type { AiFullModelCard, ModelProvider } from 'model-bank';
import { assertModelProvider, isAiModelVisible } from 'model-bank';
import { AiProviderBaseURLSchema } from 'model-bank/aiProvider';

import { loadModels } from '@/business/client/model-bank/loadModels';
import { getBusinessModelRuntimeHooks } from '@/business/server/model-runtime';
import { AiProviderModel } from '@/database/models/aiProvider';
import type { LobeChatDatabase } from '@/database/type';
import { getLLMConfig } from '@/envs/llm';
import { getServerGlobalConfig } from '@/server/globalConfig';
import { createLLMGenerationTracingHook } from '@/server/services/llmGenerationTracing/hook';

import { KeyVaultsGateKeeper } from '../KeyVaultsEncrypt';
import apiKeyManager from './apiKeyManager';

export * from './trace';
export type { ServerDefaultHeterogeneousAgentType } from '@lobechat/heterogeneous-agents';
export { SERVER_DEFAULT_HETEROGENEOUS_AGENT_TYPES } from '@lobechat/heterogeneous-agents';

export const resolveRuntimeProvider = (provider: string, _sdkType?: string): ModelProvider => {
  assertModelProvider(provider);
  return provider;
};

export const buildPayloadFromKeyVaults = (
  keyVaults: OpenAICompatibleKeyVault,
  provider: string,
): ClientSecretPayload => {
  assertModelProvider(provider);
  return { apiKey: keyVaults.apiKey, baseURL: keyVaults.baseURL, runtimeProvider: provider };
};

export const initModelRuntimeWithUserPayload = (
  provider: string,
  payload: ClientSecretPayload,
  params: Record<string, unknown> = {},
  hooks?: ModelRuntimeHooks,
) => {
  assertModelProvider(provider);
  if (payload.runtimeProvider && payload.runtimeProvider !== provider) {
    throw AgentRuntimeError.createError(ChatErrorType.BadRequest, {
      message: 'Runtime provider must match the selected provider',
    });
  }
  if (payload.baseURL && !AiProviderBaseURLSchema.safeParse(payload.baseURL).success) {
    throw AgentRuntimeError.createError(ChatErrorType.BadRequest, {
      message: 'Invalid provider baseURL',
    });
  }

  const config = getLLMConfig() as Record<string, string | boolean | undefined>;
  const prefix = provider.toUpperCase();
  const apiKey = apiKeyManager.pick(
    payload.apiKey || (config[`${prefix}_API_KEY`] as string | undefined),
  );
  const baseURL = payload.baseURL || process.env[`${prefix}_PROXY_URL`];
  return ModelRuntime.initializeWithProvider(
    provider,
    { apiKey, ...(baseURL ? { baseURL } : {}), ...params },
    hooks,
  );
};

export const initModelRuntimeFromDB = async (
  db: LobeChatDatabase,
  userId: string,
  provider: string,
  workspaceId?: string,
): Promise<ModelRuntime> => {
  assertModelProvider(provider);
  const config = await new AiProviderModel(db, userId, workspaceId).getAiProviderById(
    provider,
    KeyVaultsGateKeeper.getUserKeyVaults,
  );
  const payload = buildPayloadFromKeyVaults(config?.keyVaults || {}, provider);
  const hooks = mergeModelRuntimeHooks(
    getBusinessModelRuntimeHooks(userId, provider, workspaceId),
    createLLMGenerationTracingHook(userId, provider, workspaceId),
  );
  return initModelRuntimeWithUserPayload(provider, payload, { userId, workspaceId }, hooks);
};

export interface ServerDefaultHeterogeneousModelReference {
  model: string;
}

export type ServerDefaultHeterogeneousModels = Record<
  ServerDefaultHeterogeneousAgentType,
  ServerDefaultHeterogeneousModelReference[]
>;

/** Resolve deployment defaults through the same retained-provider registry as user calls. */
const getDefaultRuntimeProvider = async () => {
  const config = await getServerGlobalConfig();
  const provider = config.defaultAgent?.config?.provider || DEFAULT_PROVIDER;
  assertModelProvider(provider);
  return provider;
};

const supportsServerDefaultHeterogeneousAgent = (
  agentType: ServerDefaultHeterogeneousAgentType,
  model: Pick<AiFullModelCard, 'abilities' | 'id' | 'visible'>,
) => {
  if (!isAiModelVisible(model)) return false;
  if (parseClaudeModelId(model.id) !== undefined || model.abilities?.functionCall === true) {
    return true;
  }

  return (
    SERVER_DEFAULT_HETEROGENEOUS_AGENT_CONFIG[agentType].modelPolicy === 'codex' &&
    isResponsesAPIModel(model.id)
  );
};

const getEnabledServerChatModels = async (provider: ModelProvider) => {
  const providerConfig = (await getServerGlobalConfig()).aiProvider[provider];
  if (!providerConfig?.enabled) return [];

  const models =
    providerConfig.serverModelLists ??
    (await loadModels()).filter((model) => model.providerId === provider);

  return models.filter((model) => model.enabled && model.type === 'chat');
};

const findEnabledServerChatModel = async (provider: string, model: string) => {
  assertModelProvider(provider);
  const modelConfig = (await getEnabledServerChatModels(provider as ModelProvider)).find(
    (item) => item.id === model,
  );
  if (!modelConfig) {
    throw new Error('The selected server model is not available');
  }

  return modelConfig;
};

const toServerModelSelection = (provider: string, modelConfig: AiFullModelCard) => ({
  ...(modelConfig.config?.deploymentName && {
    deploymentName: modelConfig.config.deploymentName,
  }),
  model: modelConfig.id,
  provider,
});

/** Return compatible models from the single deployment-owned relay provider. */
export const getServerDefaultHeterogeneousModels = async () => {
  const models = {} as ServerDefaultHeterogeneousModels;
  for (const agentType of SERVER_DEFAULT_HETEROGENEOUS_AGENT_TYPES) {
    models[agentType] = [];
  }

  for (const model of await getEnabledServerChatModels(await getDefaultRuntimeProvider())) {
    for (const agentType of SERVER_DEFAULT_HETEROGENEOUS_AGENT_TYPES) {
      if (supportsServerDefaultHeterogeneousAgent(agentType, model)) {
        models[agentType].push({ model: model.id });
      }
    }
  }

  return models;
};

/** Resolve a user selection against the deployment-owned, enabled chat model catalog. */
export const resolveServerModel = async (provider: string, model: string) =>
  toServerModelSelection(provider, await findEnabledServerChatModel(provider, model));

const findServerDefaultHeterogeneousModel = async (
  agentType: ServerDefaultHeterogeneousAgentType,
  model: string,
) => {
  const modelConfig = await findEnabledServerChatModel(await getDefaultRuntimeProvider(), model);
  if (!supportsServerDefaultHeterogeneousAgent(agentType, modelConfig)) {
    throw new Error('The selected server model is not compatible with this heterogeneous agent');
  }
  return modelConfig;
};

/** Describe a compatible model so a CLI can be told about one it has no entry for. */
export const describeServerDefaultHeterogeneousModel = async (
  agentType: ServerDefaultHeterogeneousAgentType,
  model: string,
): Promise<ServerDefaultHeterogeneousModelDescriptor> => {
  const modelConfig = await findServerDefaultHeterogeneousModel(agentType, model);
  return {
    abilities: {
      reasoning: modelConfig.abilities?.reasoning === true,
      vision: modelConfig.abilities?.vision === true,
    },
    ...(modelConfig.contextWindowTokens && {
      contextWindowTokens: modelConfig.contextWindowTokens,
    }),
    ...(modelConfig.displayName && { displayName: modelConfig.displayName }),
    ...(modelConfig.maxOutput && { maxOutput: modelConfig.maxOutput }),
    model: modelConfig.id,
    nativeResponses: isResponsesAPIModel(modelConfig.id),
  };
};

/** Resolve a model only when it belongs to the selected CLI's relay runtime path. */
export const resolveServerDefaultHeterogeneousModel = async (
  agentType: ServerDefaultHeterogeneousAgentType,
  model: string,
) => {
  const modelConfig = await findServerDefaultHeterogeneousModel(agentType, model);

  return {
    ...toServerModelSelection(await getDefaultRuntimeProvider(), modelConfig),
    ...(modelConfig.maxOutput !== undefined && { maxOutput: modelConfig.maxOutput }),
    supportsAdaptiveThinking:
      modelConfig.settings?.extendParams?.includes('enableAdaptiveThinking') === true,
  };
};

/** Initialize the retained deployment default with its own credentials. */
export const initModelRuntimeFromServerConfig = async (params: {
  actorUserId: string;
  workspaceId?: string;
}): Promise<ModelRuntime> => {
  const provider = await getDefaultRuntimeProvider();
  const hooks = mergeModelRuntimeHooks(
    getBusinessModelRuntimeHooks(params.actorUserId, provider, params.workspaceId),
    createLLMGenerationTracingHook(params.actorUserId, provider, params.workspaceId),
  );
  return initModelRuntimeWithUserPayload(
    provider,
    { userId: params.actorUserId },
    { userId: params.actorUserId, workspaceId: params.workspaceId },
    hooks,
  );
};
