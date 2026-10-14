import { LobeDeepSeekAI } from './providers/deepseek';
import { LobeMinimaxAI } from './providers/minimax';
import { LobeMoonshotAI } from './providers/moonshot';
import { LobeOpenAI } from './providers/openai';
import { LobeQwenAI } from './providers/qwen';
import { LobeVolcengineAI } from './providers/volcengine';
import { LobeZhipuAI } from './providers/zhipu';

export const providerRuntimeMap = {
  deepseek: LobeDeepSeekAI,
  minimax: LobeMinimaxAI,
  moonshot: LobeMoonshotAI,
  openai: LobeOpenAI,
  qwen: LobeQwenAI,
  volcengine: LobeVolcengineAI,
  zhipu: LobeZhipuAI,
};
