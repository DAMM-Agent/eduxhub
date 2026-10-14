import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const getLLMConfig = () =>
  createEnv({
    server: {
      API_KEY_SELECT_MODE: z.string().optional(),
      ENABLED_OPENAI: z.boolean(),
      OPENAI_API_KEY: z.string().optional(),
      ENABLED_ZHIPU: z.boolean(),
      ZHIPU_API_KEY: z.string().optional(),
      ENABLED_DEEPSEEK: z.boolean(),
      DEEPSEEK_API_KEY: z.string().optional(),
      ENABLED_MOONSHOT: z.boolean(),
      MOONSHOT_API_KEY: z.string().optional(),
      ENABLED_MINIMAX: z.boolean(),
      MINIMAX_API_KEY: z.string().optional(),
      ENABLED_QWEN: z.boolean(),
      QWEN_API_KEY: z.string().optional(),
      ENABLED_VOLCENGINE: z.boolean(),
      VOLCENGINE_API_KEY: z.string().optional(),
    },
    runtimeEnv: {
      API_KEY_SELECT_MODE: process.env.API_KEY_SELECT_MODE,
      ENABLED_OPENAI: process.env.ENABLED_OPENAI !== '0',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ENABLED_ZHIPU: !!process.env.ZHIPU_API_KEY,
      ZHIPU_API_KEY: process.env.ZHIPU_API_KEY,
      ENABLED_DEEPSEEK: !!process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      ENABLED_VOLCENGINE: !!process.env.VOLCENGINE_API_KEY,
      VOLCENGINE_API_KEY: process.env.VOLCENGINE_API_KEY,
      ENABLED_MINIMAX: !!process.env.MINIMAX_API_KEY,
      MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
      ENABLED_MOONSHOT: !!process.env.MOONSHOT_API_KEY,
      MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
      ENABLED_QWEN: !!process.env.QWEN_API_KEY,
      QWEN_API_KEY: process.env.QWEN_API_KEY,
    },
  });

export const llmEnv = getLLMConfig();
