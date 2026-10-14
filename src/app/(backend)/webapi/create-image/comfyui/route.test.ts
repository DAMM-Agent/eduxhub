// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { POST } from './route';

describe('retired ComfyUI endpoint', () => {
  it('rejects old callers with the shared unsupported-provider response', async () => {
    const response = POST();

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      body: { error: { provider: 'comfyui' }, provider: 'comfyui' },
      errorType: 'UnsupportedProvider',
    });
  });
});
