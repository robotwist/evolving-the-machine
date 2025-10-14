import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_STAGE = 8;

export type GameScreen = 'menu' | 'stage-select' | 'game' | 'transition';
export type GameState = 'playing' | 'paused' | 'ended' | 'stage-complete';

interface GameStore {
  currentScreen: GameScreen;
  currentStage: number;
  gameState: GameState;
  unlockedStages: number;
  
  // Actions
  setCurrentScreen: (screen: GameScreen) => void;
  setCurrentStage: (stage: number) => void;
  setGameState: (state: GameState) => void;
  unlockNextStage: () => void;
  goToNextStage: () => void;
  resetProgress: () => void;
  stageAttempts: Record<number, number>;
  incrementAttempt: (stage: number) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      currentScreen: 'menu',
      currentStage: 1,
      gameState: 'playing',
      unlockedStages: 1,
      
      setCurrentScreen: (screen) => set({ currentScreen: screen }),
      
      // Sets the current stage and resets game state to 'playing'
      setCurrentStage: (stage) => set({ 
        currentStage: stage,
        gameState: 'playing'
      }),
      
      setGameState: (state) => set({ gameState: state }),
      
      unlockNextStage: () => set((state) => ({
        unlockedStages: Math.max(state.unlockedStages, state.currentStage + 1)
      })),
      
      goToNextStage: () => {
        const { currentStage } = get();
        if (currentStage < MAX_STAGE) {
          set({
            currentStage: currentStage + 1,
            gameState: 'playing',
            currentScreen: 'game'
          });
        } else {
          set({ currentScreen: 'stage-select' });
        }
      },
      
      resetProgress: () => set({
        unlockedStages: 1,
        currentStage: 1,
        gameState: 'playing',
        currentScreen: 'menu'
      }),
      stageAttempts: {},
      incrementAttempt: (stage: number) => set((s) => ({ stageAttempts: { ...s.stageAttempts, [stage]: (s.stageAttempts[stage] ?? 0) + 1 } })),
    }),
    {
      name: 'cultural-arcade-game-store',
      partialize: (state) => ({
        unlockedStages: state.unlockedStages,
        stageAttempts: state.stageAttempts
      })
    }
  )
);
