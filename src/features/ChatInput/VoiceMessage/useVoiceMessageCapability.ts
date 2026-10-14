import { isModelProvider, ModelProvider } from 'model-bank/modelProvider';

import { useEffectiveAgentModePreference } from '@/features/ChatInput/hooks/effectiveAgentModePreference';
import { getMultimodalUnderstandingMediaAbility } from '@/hooks/useMediaUploadAbility';
import { getAiInfraStoreState, useAiInfraStore } from '@/store/aiInfra';
import { aiModelSelectors } from '@/store/aiInfra/selectors';
import type { AiInfraStore } from '@/store/aiInfra/store';
import {
  getServerConfigStoreState,
  serverConfigSelectors,
  useServerConfigStore,
} from '@/store/serverConfig';

interface VoiceMessageIdleStateInput {
  canRecordVoiceMessage: boolean;
  hasSendHandler: boolean;
  isGenerating: boolean;
  isOtherAudioModeActive: boolean;
}

/**
 * How the idle (not recording) trigger presents itself.
 *
 * "Can't right now" and "can't at all" are different answers. A run in flight
 * or another audio mode ends, so the trigger stays put and its tooltip says
 * why. A model that cannot take audio — or a composer with no voice-message
 * handler — never will, so the trigger is dropped instead of sitting inert
 * beside Send where nobody can tell whether it works.
 */
export const getVoiceMessageIdleState = ({
  canRecordVoiceMessage,
  hasSendHandler,
  isGenerating,
  isOtherAudioModeActive,
}: VoiceMessageIdleStateInput) => {
  if (!canRecordVoiceMessage || !hasSendHandler) return { hidden: true, canStart: false } as const;

  return { hidden: false, canStart: !isGenerating && !isOtherAudioModeActive } as const;
};

interface VoiceMessageActionStateInput {
  canRecordVoiceMessage: boolean;
  canSendRecording: boolean;
  hasRecoverableError: boolean;
}

export const getVoiceMessageActionState = ({
  canRecordVoiceMessage,
  canSendRecording,
  hasRecoverableError,
}: VoiceMessageActionStateInput) => {
  const canSend = canRecordVoiceMessage && canSendRecording;
  const showRetry = canRecordVoiceMessage && hasRecoverableError;

  return {
    canSend,
    sendDisabled: !showRetry && !canSend,
    showRetry,
  };
};

interface RawAudioCapabilityInput {
  modelSupportsAudio: boolean;
  provider: string;
  runtimeProvider: string;
}

interface MultimodalUnderstandingConfig {
  enabled: boolean;
  model?: string;
  provider?: string;
}

interface VoiceMessageCapabilityInput {
  enableAgentMode: boolean;
  isAgentModePreferenceLoading?: boolean;
  model?: string;
  multimodalUnderstanding?: MultimodalUnderstandingConfig;
  provider?: string;
  state?: AiInfraStore;
}

const getMultimodalUnderstandingConfig = (): MultimodalUnderstandingConfig => {
  const state = getServerConfigStoreState();
  if (!state) return { enabled: false };

  const config = serverConfigSelectors.multimodalUnderstanding(state);

  return {
    enabled: serverConfigSelectors.enableMultimodalUnderstanding(state),
    model: config?.model,
    provider: config?.provider,
  };
};

export const supportsRawAudioMessage = ({
  modelSupportsAudio,
  provider,
  runtimeProvider,
}: RawAudioCapabilityInput) =>
  modelSupportsAudio &&
  isModelProvider(provider) &&
  provider === runtimeProvider &&
  runtimeProvider === ModelProvider.OpenAI;

export const getVoiceMessageCapability = ({
  enableAgentMode,
  isAgentModePreferenceLoading = false,
  model,
  multimodalUnderstanding = getMultimodalUnderstandingConfig(),
  provider,
  state = getAiInfraStoreState(),
}: VoiceMessageCapabilityInput) => {
  if (!model || !provider || !isModelProvider(provider)) return false;

  const modelSupportsAudio = aiModelSelectors.isModelSupportAudio(model, provider)(state);
  const supportsDirectAudio = supportsRawAudioMessage({
    modelSupportsAudio,
    provider,
    runtimeProvider: provider,
  });
  if (supportsDirectAudio) return true;

  // The fallback runs through lobe-agent.analyzeMedia, which Chat mode does not expose.
  if (!enableAgentMode || isAgentModePreferenceLoading) return false;

  const fallbackModelId = multimodalUnderstanding.model;
  const fallbackProvider = multimodalUnderstanding.provider;
  const fallbackConfigured = !!(
    fallbackModelId &&
    fallbackProvider &&
    isModelProvider(fallbackProvider)
  );
  const fallbackModel = fallbackConfigured
    ? aiModelSelectors.getEnabledModelById(fallbackModelId, fallbackProvider)(state)
    : undefined;

  return getMultimodalUnderstandingMediaAbility({
    enableMultimodalUnderstanding: multimodalUnderstanding.enabled,
    fallbackConfigured,
    fallbackModelAbilities: fallbackModel?.abilities,
    supportToolUse: aiModelSelectors.isModelSupportToolUse(model, provider)(state),
  }).audio;
};

export const useVoiceMessageCapability = (model?: string, provider?: string, agentId?: string) => {
  const { enableAgentMode, isPreferenceLoading } = useEffectiveAgentModePreference(agentId || '');
  const enabled = useServerConfigStore(serverConfigSelectors.enableMultimodalUnderstanding);
  const config = useServerConfigStore(serverConfigSelectors.multimodalUnderstanding);

  return useAiInfraStore((state) =>
    getVoiceMessageCapability({
      enableAgentMode,
      isAgentModePreferenceLoading: isPreferenceLoading,
      model,
      multimodalUnderstanding: {
        enabled,
        model: config?.model,
        provider: config?.provider,
      },
      provider,
      state,
    }),
  );
};
