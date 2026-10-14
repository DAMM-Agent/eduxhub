import { UnsupportedModelProviderError } from 'model-bank/modelProvider';

import { createErrorResponse } from '@/utils/errorResponse';

/** Keep old clients on the same unsupported-provider response as current APIs. */
export const POST = () => {
  const error = new UnsupportedModelProviderError('comfyui');
  return createErrorResponse(error.errorType, { error: error.error, provider: error.provider });
};
