import { describe, expect, it, vi } from 'vitest';

import { loadModels } from './aiModels';
import { ModelProvider } from './const/modelProvider';
import { DEFAULT_MODEL_PROVIDER_LIST } from './modelProviders';

const retainedProviders = [
  'deepseek',
  'minimax',
  'moonshot',
  'openai',
  'qwen',
  'volcengine',
  'zhipu',
];

describe('product provider availability', () => {
  it('exposes only the retained providers in the catalog and built-in models', async () => {
    expect(Object.values(ModelProvider).sort()).toEqual(retainedProviders);
    expect(DEFAULT_MODEL_PROVIDER_LIST.map(({ id }) => id).sort()).toEqual(retainedProviders);
    expect([...new Set((await loadModels()).map(({ providerId }) => providerId))].sort()).toEqual(
      retainedProviders,
    );
  });

  it('rejects removed providers supplied by an old model loader', async () => {
    const loader = vi.fn().mockResolvedValue([{ id: 'legacy-model', type: 'chat' }]);
    await expect(loadModels({ providerLoaders: { google: loader } } as never)).rejects.toThrow(
      'no longer supported',
    );
    expect(loader).not.toHaveBeenCalled();
  });
});
