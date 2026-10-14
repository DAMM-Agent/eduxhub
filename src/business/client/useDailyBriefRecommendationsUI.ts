import type { DailyBriefRecommendationsUIState } from '@/features/RecommendTaskTemplates/useDailyBriefRecommendationsUI';

export type { DailyBriefRecommendationsUIState };

// Temporarily disable home task-template recommendations and their Market requests.
// export {
//   type DailyBriefRecommendationsUIState,
//   useDailyBriefRecommendationsUI,
// } from '@/features/RecommendTaskTemplates/useDailyBriefRecommendationsUI';

export const useDailyBriefRecommendationsUI = (): DailyBriefRecommendationsUIState => ({
  mode: 'hidden',
});
