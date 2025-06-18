import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GameScreen = 'menu' | 'stage-select' | 'game';
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
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      currentScreen: 'menu',
      currentStage: 1,
      gameState: 'playing',
      unlockedStages: 1,
      
      setCurrentScreen: (screen) => set({ currentScreen: screen }),
      
      setCurrentStage: (stage) => set({ 
        currentStage: stage,
        gameState: 'playing'
      }),
      
      setGameState: (state) => set({ gameState: state }),
      
      unlockNextStage: () => set((state) => ({
        unlockedStages: Math.max(state.unlockedStages, state.currentStage + 1)
      })),
      
      goToNextStage: () => {
        const { currentStage, unlockedStages } = get();
        if (currentStage < 5 && currentStage < unlockedStages) {
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
      })
    }),
    {
      name: 'cultural-arcade-game-store',
      partialize: (state) => ({
        unlockedStages: state.unlockedStages
      })
    }
  )
);
