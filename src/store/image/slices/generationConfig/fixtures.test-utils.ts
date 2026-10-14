import type { ModelParamsSchema } from 'model-bank';

/** Independent fixture for size/ratio controls, unrelated to provider availability. */
export const pixelModelSchema: ModelParamsSchema = {
  height: { default: 1024, max: 1536, min: 512, step: 1 },
  prompt: { default: '' },
  seed: { default: null },
  steps: { default: 4, max: 12, min: 1, step: 1 },
  width: { default: 1024, max: 1536, min: 512, step: 1 },
};
