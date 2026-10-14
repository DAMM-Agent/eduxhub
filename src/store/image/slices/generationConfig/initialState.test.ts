import { describe, expect, it } from 'vitest';

import { DEFAULT_IMAGE_GENERATION_PARAMETERS, initialGenerationConfigState } from './initialState';

describe('initialGenerationConfigState', () => {
  it('starts with a retained image provider and its supported parameters', () => {
    expect(initialGenerationConfigState.provider).toBe('openai');
    expect(initialGenerationConfigState.model).toBe('gpt-image-2');
    expect(initialGenerationConfigState.parametersSchema.size?.enum).toContain('auto');
    expect(DEFAULT_IMAGE_GENERATION_PARAMETERS.size).toBe('auto');
    expect(DEFAULT_IMAGE_GENERATION_PARAMETERS).not.toHaveProperty('resolution');
  });
});
