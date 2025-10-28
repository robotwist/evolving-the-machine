// State Management Patterns and Utilities
// Centralized state management with improved patterns

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { gameValidation } from '../utils/validation';
import { gameValidators, rateLimiters } from '../utils/security';

// State Management Types
export interface StateAction<T = any> {
  type: string;
  payload?: T;
  timestamp: number;
  userId?: string;
}

export interface StateMiddleware {
  name: string;
  beforeAction?: (action: StateAction) => StateAction | null;
  afterAction?: (action: StateAction, newState: any) => void;
  onError?: (error: Error, action: StateAction) => void;
}

export interface StateSubscription {
  id: string;
  selector: (state: any) => any;
  callback: (value: any, prevValue: any) => void;
  isActive: boolean;
}

// State Management Configuration
export interface StateConfig {
  enableDevtools: boolean;
  enableImmer: boolean;
  enableSubscriptions: boolean;
  enableMiddleware: boolean;
  enableValidation: boolean;
  enableRateLimiting: boolean;
  enableLogging: boolean;
}

// Default configuration
export const defaultStateConfig: StateConfig = {
  enableDevtools: process.env.NODE_ENV === 'development',
  enableImmer: true,
  enableSubscriptions: true,
  enableMiddleware: true,
  enableValidation: true,
  enableRateLimiting: true,
  enableLogging: process.env.NODE_ENV === 'development'
};

// State Management Middleware
export class StateManager {
  private middlewares: StateMiddleware[] = [];
  private subscriptions: Map<string, StateSubscription> = new Map();
  private config: StateConfig;
  private actionHistory: StateAction[] = [];
  private maxHistorySize = 100;

  constructor(config: StateConfig = defaultStateConfig) {
    this.config = config;
  }

  // Add middleware
  addMiddleware(middleware: StateMiddleware): void {
    this.middlewares.push(middleware);
  }

  // Remove middleware
  removeMiddleware(name: string): void {
    this.middlewares = this.middlewares.filter(m => m.name !== name);
  }

  // Process action through middleware
  processAction<T>(action: StateAction<T>, currentState: any): StateAction<T> | null {
    let processedAction = action;

    // Run before middleware
    for (const middleware of this.middlewares) {
      if (middleware.beforeAction) {
        const result = middleware.beforeAction(processedAction);
        if (result === null) {
          return null; // Middleware blocked the action
        }
        processedAction = result;
      }
    }

    return processedAction;
  }

  // Handle action completion
  handleActionComplete<T>(action: StateAction<T>, newState: any): void {
    // Add to history
    this.actionHistory.push(action);
    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory.shift();
    }

    // Run after middleware
    for (const middleware of this.middlewares) {
      if (middleware.afterAction) {
        try {
          middleware.afterAction(action, newState);
        } catch (error) {
          console.error(`Middleware ${middleware.name} error:`, error);
          if (middleware.onError) {
            middleware.onError(error as Error, action);
          }
        }
      }
    }

    // Notify subscriptions
    this.notifySubscriptions(newState);
  }

  // Handle action error
  handleActionError(error: Error, action: StateAction): void {
    for (const middleware of this.middlewares) {
      if (middleware.onError) {
        try {
          middleware.onError(error, action);
        } catch (middlewareError) {
          console.error(`Middleware ${middleware.name} error handler failed:`, middlewareError);
        }
      }
    }
  }

  // Subscribe to state changes
  subscribe<T>(
    id: string,
    selector: (state: any) => T,
    callback: (value: T, prevValue: T) => void
  ): () => void {
    const subscription: StateSubscription = {
      id,
      selector,
      callback: callback as any,
      isActive: true
    };

    this.subscriptions.set(id, subscription);

    // Return unsubscribe function
    return () => {
      const sub = this.subscriptions.get(id);
      if (sub) {
        sub.isActive = false;
        this.subscriptions.delete(id);
      }
    };
  }

  // Notify subscriptions
  private notifySubscriptions(newState: any): void {
    for (const [id, subscription] of this.subscriptions) {
      if (!subscription.isActive) continue;

      try {
        const newValue = subscription.selector(newState);
        subscription.callback(newValue, newValue); // TODO: Track previous values
      } catch (error) {
        console.error(`Subscription ${id} error:`, error);
      }
    }
  }

  // Get action history
  getActionHistory(): StateAction[] {
    return [...this.actionHistory];
  }

  // Clear action history
  clearActionHistory(): void {
    this.actionHistory = [];
  }

  // Get configuration
  getConfig(): StateConfig {
    return { ...this.config };
  }

  // Update configuration
  updateConfig(updates: Partial<StateConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Global state manager instance
export const stateManager = new StateManager();

// Validation Middleware
export const validationMiddleware: StateMiddleware = {
  name: 'validation',
  beforeAction: (action) => {
    // Validate action structure
    if (!action.type || typeof action.type !== 'string') {
      console.error('Invalid action type:', action);
      return null;
    }

    if (action.timestamp && typeof action.timestamp !== 'number') {
      console.error('Invalid action timestamp:', action);
      return null;
    }

    return action;
  }
};

// Rate Limiting Middleware
export const rateLimitingMiddleware: StateMiddleware = {
  name: 'rateLimiting',
  beforeAction: (action) => {
    const actionType = action.type;
    
    // Check rate limits based on action type
    if (actionType.includes('score') && !rateLimiters.scoreSubmissions.isAllowed('score-update')) {
      console.warn('Action rate limited:', actionType);
      return null;
    }

    if (actionType.includes('settings') && !rateLimiters.settingsChanges.isAllowed('settings-change')) {
      console.warn('Action rate limited:', actionType);
      return null;
    }

    return action;
  }
};

// Logging Middleware
export const loggingMiddleware: StateMiddleware = {
  name: 'logging',
  beforeAction: (action) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Action dispatched: ${action.type}`, action.payload);
    }
    return action;
  },
  afterAction: (action, newState) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Action completed: ${action.type}`, newState);
    }
  },
  onError: (error, action) => {
    console.error(`Action failed: ${action.type}`, error);
  }
};

// Persistence Middleware
export const persistenceMiddleware: StateMiddleware = {
  name: 'persistence',
  afterAction: (action, newState) => {
    // Handle persistence logic here
    if (action.type.includes('persist')) {
      // Trigger persistence
      console.log('Persistence triggered for action:', action.type);
    }
  }
};

// Add default middlewares
stateManager.addMiddleware(validationMiddleware);
stateManager.addMiddleware(rateLimitingMiddleware);
stateManager.addMiddleware(loggingMiddleware);
stateManager.addMiddleware(persistenceMiddleware);

// State Action Creators
export const createAction = <T = any>(
  type: string,
  payload?: T
): StateAction<T> => ({
  type,
  payload,
  timestamp: Date.now()
});

// Common action types
export const ActionTypes = {
  // Game actions
  SET_CURRENT_SCREEN: 'SET_CURRENT_SCREEN',
  SET_CURRENT_STAGE: 'SET_CURRENT_STAGE',
  SET_GAME_STATE: 'SET_GAME_STATE',
  UNLOCK_NEXT_STAGE: 'UNLOCK_NEXT_STAGE',
  GO_TO_NEXT_STAGE: 'GO_TO_NEXT_STAGE',
  RESET_PROGRESS: 'RESET_PROGRESS',
  INCREMENT_ATTEMPT: 'INCREMENT_ATTEMPT',

  // Score actions
  UPDATE_SCORE: 'UPDATE_SCORE',
  RESET_SCORES: 'RESET_SCORES',

  // Settings actions
  SET_GRAPHICS_QUALITY: 'SET_GRAPHICS_QUALITY',
  SET_FPS_CAP: 'SET_FPS_CAP',
  SET_MASTER_VOLUME: 'SET_MASTER_VOLUME',
  SET_PRESET: 'SET_PRESET',

  // Audio actions
  PLAY_STINGER: 'PLAY_STINGER',
  PLAY_MUSIC: 'PLAY_MUSIC',
  STOP_MUSIC: 'STOP_MUSIC',
  SET_MUTED: 'SET_MUTED',

  // Performance actions
  UPDATE_PERFORMANCE_METRICS: 'UPDATE_PERFORMANCE_METRICS',
  SET_PERFORMANCE_DASHBOARD_VISIBLE: 'SET_PERFORMANCE_DASHBOARD_VISIBLE'
} as const;

// State Selectors
export const createSelector = <TState, TResult>(
  selector: (state: TState) => TResult
) => selector;

// Common selectors
export const gameSelectors = {
  currentScreen: (state: any) => state.currentScreen,
  currentStage: (state: any) => state.currentStage,
  gameState: (state: any) => state.gameState,
  unlockedStages: (state: any) => state.unlockedStages,
  isGamePlaying: (state: any) => state.gameState === 'playing',
  isGamePaused: (state: any) => state.gameState === 'paused',
  canUnlockNextStage: (state: any) => state.currentStage < 8
};

export const scoreSelectors = {
  currentScore: (state: any, stage: number) => state.scores[stage] || 0,
  highScore: (state: any, stage: number) => state.highScores[stage] || 0,
  totalScore: (state: any) => Object.values(state.scores).reduce((sum: number, score: number) => sum + score, 0),
  hasHighScore: (state: any, stage: number) => state.highScores[stage] > 0
};

export const settingsSelectors = {
  graphicsQuality: (state: any) => state.graphicsQuality,
  fpsCap: (state: any) => state.fpsCap,
  masterVolume: (state: any) => state.masterVolume,
  isMuted: (state: any) => state.masterVolume === 0,
  currentPreset: (state: any) => state.preset
};

// State Synchronization
export class StateSynchronizer {
  private stores: Map<string, any> = new Map();
  private syncRules: Map<string, (state: any) => void> = new Map();

  // Register a store for synchronization
  registerStore(name: string, store: any): void {
    this.stores.set(name, store);
  }

  // Add synchronization rule
  addSyncRule(triggerStore: string, targetStore: string, syncFn: (state: any) => void): void {
    const ruleKey = `${triggerStore}->${targetStore}`;
    this.syncRules.set(ruleKey, syncFn);
  }

  // Synchronize state between stores
  sync(triggerStore: string, state: any): void {
    for (const [ruleKey, syncFn] of this.syncRules) {
      if (ruleKey.startsWith(`${triggerStore}->`)) {
        try {
          syncFn(state);
        } catch (error) {
          console.error(`Sync rule ${ruleKey} failed:`, error);
        }
      }
    }
  }

  // Get all registered stores
  getStores(): Map<string, any> {
    return new Map(this.stores);
  }
}

// Global state synchronizer
export const stateSynchronizer = new StateSynchronizer();

// State Persistence Manager
export class StatePersistenceManager {
  private persistenceRules: Map<string, {
    serialize: (state: any) => any;
    deserialize: (data: any) => any;
    version: number;
  }> = new Map();

  // Add persistence rule
  addPersistenceRule(
    storeName: string,
    serialize: (state: any) => any,
    deserialize: (data: any) => any,
    version: number = 1
  ): void {
    this.persistenceRules.set(storeName, {
      serialize,
      deserialize,
      version
    });
  }

  // Save state to localStorage
  saveState(storeName: string, state: any): void {
    const rule = this.persistenceRules.get(storeName);
    if (!rule) return;

    try {
      const serialized = rule.serialize(state);
      const data = {
        version: rule.version,
        data: serialized,
        timestamp: Date.now()
      };
      localStorage.setItem(`state-${storeName}`, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to save state for ${storeName}:`, error);
    }
  }

  // Load state from localStorage
  loadState(storeName: string): any {
    const rule = this.persistenceRules.get(storeName);
    if (!rule) return null;

    try {
      const stored = localStorage.getItem(`state-${storeName}`);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      if (parsed.version !== rule.version) {
        console.warn(`Version mismatch for ${storeName}: expected ${rule.version}, got ${parsed.version}`);
        return null;
      }

      return rule.deserialize(parsed.data);
    } catch (error) {
      console.error(`Failed to load state for ${storeName}:`, error);
      return null;
    }
  }

  // Clear persisted state
  clearState(storeName: string): void {
    localStorage.removeItem(`state-${storeName}`);
  }

  // Clear all persisted states
  clearAllStates(): void {
    for (const storeName of this.persistenceRules.keys()) {
      this.clearState(storeName);
    }
  }
}

// Global persistence manager
export const statePersistenceManager = new StatePersistenceManager();

// State Debugging Utilities
export class StateDebugger {
  private isEnabled: boolean = process.env.NODE_ENV === 'development';

  // Enable/disable debugging
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Log state change
  logStateChange(storeName: string, action: StateAction, prevState: any, newState: any): void {
    if (!this.isEnabled) return;

    console.group(`🔄 State Change: ${storeName}`);
    console.log('Action:', action);
    console.log('Previous State:', prevState);
    console.log('New State:', newState);
    console.log('Changes:', this.getStateChanges(prevState, newState));
    console.groupEnd();
  }

  // Get state changes
  private getStateChanges(prevState: any, newState: any): any {
    const changes: any = {};
    
    for (const key in newState) {
      if (prevState[key] !== newState[key]) {
        changes[key] = {
          from: prevState[key],
          to: newState[key]
        };
      }
    }

    return changes;
  }

  // Log state snapshot
  logStateSnapshot(storeName: string, state: any): void {
    if (!this.isEnabled) return;

    console.group(`📸 State Snapshot: ${storeName}`);
    console.log('State:', state);
    console.log('Size:', JSON.stringify(state).length, 'bytes');
    console.groupEnd();
  }

  // Log performance metrics
  logPerformanceMetrics(storeName: string, metrics: {
    actionCount: number;
    averageActionTime: number;
    memoryUsage?: number;
  }): void {
    if (!this.isEnabled) return;

    console.group(`⚡ Performance: ${storeName}`);
    console.log('Action Count:', metrics.actionCount);
    console.log('Average Action Time:', metrics.averageActionTime, 'ms');
    if (metrics.memoryUsage) {
      console.log('Memory Usage:', metrics.memoryUsage, 'MB');
    }
    console.groupEnd();
  }
}

// Global state debugger
export const stateDebugger = new StateDebugger();

// Export utilities
export {
  stateManager,
  stateSynchronizer,
  statePersistenceManager,
  stateDebugger
};
