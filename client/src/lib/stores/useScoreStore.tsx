import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
        set((state) => {
          const newScores = { ...state.scores, [stage]: score };
          const newHighScores = { ...state.highScores };
          
          if (!newHighScores[stage] || score > newHighScores[stage]) {
            newHighScores[stage] = score;
          }
          
          return {
            scores: newScores,
            highScores: newHighScores
          };
        });
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
