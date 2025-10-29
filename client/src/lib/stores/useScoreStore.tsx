import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { gameValidation, ValidationError } from '../utils/validation';
import { antiCheat, rateLimiters, SecurityError } from '../utils/security';

interface ScoreStore {
  scores: Record<number, number>;
  highScores: Record<number, number>;
  
  // Actions
  updateScore: (stage: number, score: number) => void;
  resetScores: () => void;
  getHighScore: (stage: number) => number;
}

export const useScoreStore = create<ScoreStore>()(
  persist(
    (set, get) => ({
      scores: {},
      highScores: {},
      
      updateScore: (stage, score) => {
        try {
          // Validate inputs
          const validatedStage = gameValidation.stage(stage);
          const validatedScore = gameValidation.score(score);
          
          // Rate limiting - use a more permissive rate for score updates
          // Allow up to 60 updates per minute (1 per second) instead of 5
          if (!rateLimiters.scoreSubmissions.isAllowed(`score-update-${validatedStage}`)) {
            // Silently skip rate-limited updates instead of logging warnings
            return;
          }
          
          // Anti-cheat: detect impossible scores
          const timeElapsed = Date.now(); // This would be passed from the game
          if (antiCheat.detectImpossibleScore(validatedScore, validatedStage, timeElapsed)) {
            console.warn('Suspicious score detected:', { stage: validatedStage, score: validatedScore });
            // In production, you might want to flag this for review
            return;
          }
          
          set((state) => {
            const newScores = { ...state.scores, [validatedStage]: validatedScore };
            const newHighScores = { ...state.highScores };
            
            if (!newHighScores[validatedStage] || validatedScore > newHighScores[validatedStage]) {
              newHighScores[validatedStage] = validatedScore;
            }
            
            return {
              scores: newScores,
              highScores: newHighScores
            };
          });
        } catch (error) {
          console.error('Invalid score update:', error);
        }
      },
      
      resetScores: () => set({
        scores: {},
        highScores: {}
      }),
      
      getHighScore: (stage) => {
        return get().highScores[stage] || 0;
      }
    }),
    {
      name: 'cultural-arcade-scores',
      partialize: (state) => ({
        highScores: state.highScores
      })
    }
  )
);
