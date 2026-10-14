import { DEFAULT_MODEL_PROVIDER_LIST } from 'model-bank/modelProviders';

const locales: Record<`${string}.description`, string> = {};

const providers = DEFAULT_MODEL_PROVIDER_LIST;

providers.forEach((provider) => {
  if (!provider.description) return;
  locales[`${provider.id}.description`] = provider.description;
});

export default locales;
