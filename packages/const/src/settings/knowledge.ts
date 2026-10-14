import { DEFAULT_EMBEDDING_PROVIDER } from '@lobechat/business-const';
import type { FilesConfig, FilesConfigItem } from '@lobechat/types';

import { DEFAULT_EMBEDDING_MODEL, DEFAULT_RERANK_QUERY_MODE } from './llm';

export const DEFAULT_FILE_EMBEDDING_MODEL_ITEM: FilesConfigItem = {
  model: DEFAULT_EMBEDDING_MODEL,
  provider: DEFAULT_EMBEDDING_PROVIDER,
};

export const DEFAULT_FILES_CONFIG: FilesConfig = {
  embeddingModel: DEFAULT_FILE_EMBEDDING_MODEL_ITEM,
  queryMode: DEFAULT_RERANK_QUERY_MODE,
};
