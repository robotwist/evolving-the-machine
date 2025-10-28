import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { 
  stateManager, 
  createAction, 
  ActionTypes, 
  gameSelectors,
  stateSynchronizer,
  statePersistenceManager,
  stateDebugger,
  StateAction
} from './stateManagement';
import { gameValidation } from '../utils/validation';
import { gameValidators } from '../utils/security';

const MAX_STAGE = 8;

export type GameScreen = 'menu' | 'stage-select' | 'game' | 'transition';
export type GameState = 'playing' | 'paused' | 'ended' | 'stage-complete';

// Enhanced Game Store Interface
interface GameStore {
  // State
  currentScreen: GameScreen;
  currentStage: number;
  gameState: GameState;
  unlockedStages: number;
  showDemo: boolean;
  productionMode: boolean;
  stageAttempts: Record<number, number>;
  
  // Enhanced state
  gameHistory: Array<{
    stage: number;
    score: number;
    duration: number;
    timestamp: number;
    completed: boolean;
  }>;
  
  // Performance tracking
  performanceMetrics: {
    averagePlayTime: number;
    totalPlayTime: number;
    sessionsCount: number;
    lastSessionStart: number;
  };
  
  // User preferences
  preferences: {
    autoSave: boolean;
    showTutorials: boolean;
    difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
    theme: 'classic' | 'modern' | 'retro';
  };
  
  // Actions
  setCurrentScreen: (screen: GameScreen) => void;
  setCurrentStage: (stage: number) => void;
  setGameState: (state: GameState) => void;
  setShowDemo: (show: boolean) => void;
  setProductionMode: (enabled: boolean) => void;
  unlockNextStage: () => void;
  goToNextStage: () => void;
  resetProgress: () => void;
  incrementAttempt: (stage: number) => void;
  
  // Enhanced actions
  startGameSession: () => void;
  endGameSession: (completed: boolean, score: number, duration: number) => void;
  updatePreferences: (preferences: Partial<GameStore['preferences']>) => void;
  clearGameHistory: () => void;
  
  // State management actions
  dispatch: (action: StateAction) => void;
  getStateSnapshot: () => GameStore;
  restoreStateSnapshot: (snapshot: Partial<GameStore>) => void;
}

// Create enhanced game store
export const useGameStore = create<GameStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          currentScreen: 'menu',
          currentStage: 1,
          gameState: 'playing',
          unlockedStages: process.env.NODE_ENV === 'production' ? MAX_STAGE : 1,
          showDemo: process.env.NODE_ENV === 'production',
          productionMode: process.env.NODE_ENV === 'production',
          stageAttempts: {},
          
          gameHistory: [],
          performanceMetrics: {
            averagePlayTime: 0,
            totalPlayTime: 0,
            sessionsCount: 0,
            lastSessionStart: 0
          },
          preferences: {
            autoSave: true,
            showTutorials: true,
            difficulty: 'adaptive',
            theme: 'classic'
          },
          
          // Enhanced actions with state management
          setCurrentScreen: (screen) => {
            const action = createAction(ActionTypes.SET_CURRENT_SCREEN, screen);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            try {
              const currentScreen = get().currentScreen;
              if (!gameValidators.gameStateTransition(currentScreen, screen)) {
                console.warn(`Invalid screen transition from ${currentScreen} to ${screen}`);
                return;
              }
              
              set((state) => {
                state.currentScreen = screen;
              });
              
              stateManager.handleActionComplete(processedAction, get());
              stateDebugger.logStateChange('gameStore', processedAction, { currentScreen }, get());
            } catch (error) {
              stateManager.handleActionError(error as Error, processedAction);
            }
          },
          
          setCurrentStage: (stage) => {
            const action = createAction(ActionTypes.SET_CURRENT_STAGE, stage);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            try {
              const validatedStage = gameValidation.stage(stage);
              const currentStage = get().currentStage;
              
              if (!gameValidators.stageUnlock(currentStage, validatedStage)) {
                console.warn(`Invalid stage unlock request: ${currentStage} -> ${validatedStage}`);
                return;
              }
              
              set((state) => {
                state.currentStage = validatedStage;
                state.gameState = 'playing';
              });
              
              stateManager.handleActionComplete(processedAction, get());
              stateDebugger.logStateChange('gameStore', processedAction, { currentStage }, get());
            } catch (error) {
              stateManager.handleActionError(error as Error, processedAction);
            }
          },
          
          setGameState: (state) => {
            const action = createAction(ActionTypes.SET_GAME_STATE, state);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            try {
              const validatedState = gameValidation.gameState(state);
              const currentState = get().gameState;
              
              if (!gameValidators.gameStateTransition(currentState, validatedState)) {
                console.warn(`Invalid state transition from ${currentState} to ${validatedState}`);
                return;
              }
              
              set((draft) => {
                draft.gameState = validatedState;
              });
              
              stateManager.handleActionComplete(processedAction, get());
              stateDebugger.logStateChange('gameStore', processedAction, { gameState: currentState }, get());
            } catch (error) {
              stateManager.handleActionError(error as Error, processedAction);
            }
          },
          
          setShowDemo: (show) => {
            const action = createAction('SET_SHOW_DEMO', show);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              draft.showDemo = show;
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          setProductionMode: (enabled) => {
            const action = createAction('SET_PRODUCTION_MODE', enabled);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              draft.productionMode = enabled;
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          unlockNextStage: () => {
            const action = createAction(ActionTypes.UNLOCK_NEXT_STAGE);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              draft.unlockedStages = Math.max(draft.unlockedStages, draft.currentStage + 1);
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          goToNextStage: () => {
            const action = createAction(ActionTypes.GO_TO_NEXT_STAGE);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              const { currentStage } = draft;
              if (currentStage < MAX_STAGE) {
                draft.currentStage = currentStage + 1;
                draft.gameState = 'playing';
                draft.currentScreen = 'game';
                draft.unlockedStages = Math.max(draft.unlockedStages, currentStage + 1);
              } else {
                draft.currentScreen = 'stage-select';
              }
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          resetProgress: () => {
            const action = createAction(ActionTypes.RESET_PROGRESS);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              draft.unlockedStages = 1;
              draft.currentStage = 1;
              draft.gameState = 'playing';
              draft.currentScreen = 'menu';
              draft.stageAttempts = {};
              draft.gameHistory = [];
              draft.performanceMetrics = {
                averagePlayTime: 0,
                totalPlayTime: 0,
                sessionsCount: 0,
                lastSessionStart: 0
              };
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          incrementAttempt: (stage) => {
            const action = createAction(ActionTypes.INCREMENT_ATTEMPT, stage);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              draft.stageAttempts[stage] = (draft.stageAttempts[stage] ?? 0) + 1;
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          // Enhanced actions
          startGameSession: () => {
            const action = createAction('START_GAME_SESSION');
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              draft.performanceMetrics.lastSessionStart = Date.now();
              draft.performanceMetrics.sessionsCount += 1;
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          endGameSession: (completed, score, duration) => {
            const action = createAction('END_GAME_SESSION', { completed, score, duration });
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              const { currentStage } = draft;
              draft.gameHistory.push({
                stage: currentStage,
                score,
                duration,
                timestamp: Date.now(),
                completed
              });
              
              // Update performance metrics
              const { performanceMetrics } = draft;
              performanceMetrics.totalPlayTime += duration;
              performanceMetrics.averagePlayTime = 
                performanceMetrics.totalPlayTime / performanceMetrics.sessionsCount;
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          updatePreferences: (preferences) => {
            const action = createAction('UPDATE_PREFERENCES', preferences);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              draft.preferences = { ...draft.preferences, ...preferences };
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          clearGameHistory: () => {
            const action = createAction('CLEAR_GAME_HISTORY');
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              draft.gameHistory = [];
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          // State management actions
          dispatch: (action) => {
            const processedAction = stateManager.processAction(action, get());
            if (!processedAction) return;
            
            // Handle action based on type
            switch (action.type) {
              case ActionTypes.SET_CURRENT_SCREEN:
                get().setCurrentScreen(action.payload);
                break;
              case ActionTypes.SET_CURRENT_STAGE:
                get().setCurrentStage(action.payload);
                break;
              case ActionTypes.SET_GAME_STATE:
                get().setGameState(action.payload);
                break;
              default:
                console.warn('Unknown action type:', action.type);
            }
          },
          
          getStateSnapshot: () => {
            return { ...get() };
          },
          
          restoreStateSnapshot: (snapshot) => {
            const action = createAction('RESTORE_STATE_SNAPSHOT', snapshot);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              Object.assign(draft, snapshot);
            });
            
            stateManager.handleActionComplete(processedAction, get());
          }
        })),
        {
          name: 'cultural-arcade-game-store',
          partialize: (state) => ({
            unlockedStages: state.unlockedStages,
            stageAttempts: state.stageAttempts,
            gameHistory: state.gameHistory,
            performanceMetrics: state.performanceMetrics,
            preferences: state.preferences
          }),
          version: 3,
          migrate: (persistedState: any, version: number) => {
            if (version < 3) {
              // Add new fields for version 3
              return {
                ...persistedState,
                gameHistory: [],
                performanceMetrics: {
                  averagePlayTime: 0,
                  totalPlayTime: 0,
                  sessionsCount: 0,
                  lastSessionStart: 0
                },
                preferences: {
                  autoSave: true,
                  showTutorials: true,
                  difficulty: 'adaptive',
                  theme: 'classic'
                }
              };
            }
            return persistedState;
          }
        }
      ),
      {
        name: 'game-store'
      }
    ),
    {
      name: 'GameStore'
    }
  )
);

// Register store with state manager
stateSynchronizer.registerStore('gameStore', useGameStore);

// Add persistence rules
statePersistenceManager.addPersistenceRule(
  'gameStore',
  (state) => ({
    unlockedStages: state.unlockedStages,
    stageAttempts: state.stageAttempts,
    gameHistory: state.gameHistory,
    performanceMetrics: state.performanceMetrics,
    preferences: state.preferences
  }),
  (data) => data,
  3
);

// Add synchronization rules
stateSynchronizer.addSyncRule(
  'gameStore',
  'scoreStore',
  (state) => {
    // Sync game state changes to score store
    if (state.gameState === 'stage-complete') {
      // Trigger score update if needed
      console.log('Game completed, syncing to score store');
    }
  }
);

// Export selectors
export { gameSelectors };

// Export enhanced store
export default useGameStore;
