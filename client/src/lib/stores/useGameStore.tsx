import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { gameValidation, ValidationError } from '../utils/validation';
import { gameValidators, SecurityError } from '../utils/security';

const MAX_STAGE = 8;

export type GameScreen = 'menu' | 'stage-select' | 'game' | 'transition';
export type GameState = 'playing' | 'paused' | 'ended' | 'stage-complete';

interface GameStore {
  currentScreen: GameScreen;
  currentStage: number;
  gameState: GameState;
  unlockedStages: number;
  showDemo: boolean;
  // Production mode settings
  productionMode: boolean;

  // Actions
  setCurrentScreen: (screen: GameScreen) => void;
  setCurrentStage: (stage: number) => void;
  setGameState: (state: GameState) => void;
  setShowDemo: (show: boolean) => void;
  setProductionMode: (enabled: boolean) => void;
  unlockNextStage: () => void;
  goToNextStage: () => void;
  resetProgress: () => void;
  unlockAllLevels: () => void;
  stageAttempts: Record<number, number>;
  incrementAttempt: (stage: number) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      currentScreen: 'menu',
      currentStage: 1,
      gameState: 'playing',
      unlockedStages: (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === undefined || window.location.hostname !== 'localhost') ? MAX_STAGE : 1, // Unlock all stages in production
      showDemo: process.env.NODE_ENV === 'production', // Show demo only in development
      productionMode: (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === undefined || window.location.hostname !== 'localhost'),
      
      setCurrentScreen: (screen) => {
        // Validate screen transition
        const currentScreen = get().currentScreen;
        if (!gameValidators.gameStateTransition(currentScreen, screen)) {
          console.warn(`Invalid screen transition from ${currentScreen} to ${screen}`);
          return;
        }
        set({ currentScreen: screen });
      },

      // Sets the current stage and resets game state to 'playing'
      setCurrentStage: (stage) => {
        try {
          const validatedStage = gameValidation.stage(stage);
          const currentStage = get().currentStage;
          const { unlockedStages } = get();
          
          // Debug environment and stage info
          const isProduction = process.env.NODE_ENV === 'production' || 
                              process.env.NODE_ENV === undefined || 
                              window.location.hostname !== 'localhost';
          console.log('Environment:', process.env.NODE_ENV, 'Is Production:', isProduction);
          console.log('Current stage:', currentStage, 'Requested stage:', validatedStage, 'Unlocked stages:', unlockedStages);
          
          // In production mode or if stage is unlocked, allow any stage
          if (isProduction || validatedStage <= unlockedStages) {
            console.log('✅ Stage access allowed - production mode or stage unlocked');
            set({
              currentStage: validatedStage,
              gameState: 'playing'
            });
            return;
          }
          
          // Check if stage unlock is valid (development mode only)
          if (!gameValidators.stageUnlock(currentStage, validatedStage)) {
            console.warn(`Invalid stage unlock request: ${currentStage} -> ${validatedStage}`);
            return;
          }
          
          set({
            currentStage: validatedStage,
            gameState: 'playing'
          });
        } catch (error) {
          console.error('Invalid stage:', error);
        }
      },

      setGameState: (state) => {
        try {
          const validatedState = gameValidation.gameState(state);
          const currentState = get().gameState;
          
          // Validate state transition
          if (!gameValidators.gameStateTransition(currentState, validatedState)) {
            console.warn(`Invalid state transition from ${currentState} to ${validatedState}`);
            return;
          }
          
          set({ gameState: validatedState });
        } catch (error) {
          console.error('Invalid game state:', error);
        }
      },

      setShowDemo: (show) => set({ showDemo: show }),

      setProductionMode: (enabled) => set({ productionMode: enabled }),

      unlockNextStage: () => set((state) => ({
        unlockedStages: Math.max(state.unlockedStages, state.currentStage + 1)
      })),
      
      goToNextStage: () => {
        const { currentStage } = get();
        if (currentStage < MAX_STAGE) {
          set((state) => ({
            currentStage: currentStage + 1,
            gameState: 'playing',
            currentScreen: 'game',
            unlockedStages: Math.max(state.unlockedStages, currentStage + 1)
          }));
        } else {
          set({ currentScreen: 'stage-select' });
        }
      },
      
      resetProgress: () => set({
        unlockedStages: 1,
        currentStage: 1,
        gameState: 'playing',
        currentScreen: 'menu',
        stageAttempts: {}
      }),
      
      unlockAllLevels: () => set({
        unlockedStages: MAX_STAGE,
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
      }),
      // Version the storage to allow breaking changes
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Force unlock all stages in production for version 2
          if (process.env.NODE_ENV === 'production') {
            return {
              ...persistedState,
              unlockedStages: MAX_STAGE
            };
          }
        }
        return persistedState;
      },
    }
  )
);
