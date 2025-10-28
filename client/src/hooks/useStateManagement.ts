import { useEffect, useRef, useCallback } from 'react';
import { 
  stateManager, 
  stateSynchronizer, 
  StateAction, 
  ActionTypes,
  createAction 
} from './stateManagement';

// State Synchronization Hook
export function useStateSync() {
  const syncRef = useRef<Map<string, any>>(new Map());

  // Sync state between stores
  const syncStores = useCallback((sourceStore: string, targetStore: string, syncFn: (state: any) => void) => {
    stateSynchronizer.addSyncRule(sourceStore, targetStore, syncFn);
  }, []);

  // Dispatch action to all stores
  const dispatchToAllStores = useCallback((action: StateAction) => {
    const stores = stateSynchronizer.getStores();
    for (const [name, store] of stores) {
      if (store.dispatch) {
        store.dispatch(action);
      }
    }
  }, []);

  // Subscribe to state changes
  const subscribeToState = useCallback((
    storeName: string,
    selector: (state: any) => any,
    callback: (value: any, prevValue: any) => void
  ) => {
    const unsubscribe = stateManager.subscribe(storeName, selector, callback);
    return unsubscribe;
  }, []);

  // Get state snapshot from all stores
  const getAllStateSnapshots = useCallback(() => {
    const stores = stateSynchronizer.getStores();
    const snapshots: Record<string, any> = {};
    
    for (const [name, store] of stores) {
      if (store.getStateSnapshot) {
        snapshots[name] = store.getStateSnapshot();
      }
    }
    
    return snapshots;
  }, []);

  // Restore state snapshots to all stores
  const restoreAllStateSnapshots = useCallback((snapshots: Record<string, any>) => {
    const stores = stateSynchronizer.getStores();
    
    for (const [name, store] of stores) {
      if (store.restoreStateSnapshot && snapshots[name]) {
        store.restoreStateSnapshot(snapshots[name]);
      }
    }
  }, []);

  // Clear all state
  const clearAllState = useCallback(() => {
    const stores = stateSynchronizer.getStores();
    
    for (const [name, store] of stores) {
      if (store.resetProgress) {
        store.resetProgress();
      } else if (store.resetScores) {
        store.resetScores();
      } else if (store.resetSettings) {
        store.resetSettings();
      }
    }
  }, []);

  // Get action history
  const getActionHistory = useCallback(() => {
    return stateManager.getActionHistory();
  }, []);

  // Clear action history
  const clearActionHistory = useCallback(() => {
    stateManager.clearActionHistory();
  }, []);

  return {
    syncStores,
    dispatchToAllStores,
    subscribeToState,
    getAllStateSnapshots,
    restoreAllStateSnapshots,
    clearAllState,
    getActionHistory,
    clearActionHistory
  };
}

// State Persistence Hook
export function useStatePersistence() {
  const persistenceRef = useRef<Map<string, boolean>>(new Map());

  // Enable/disable persistence for a store
  const setPersistence = useCallback((storeName: string, enabled: boolean) => {
    persistenceRef.current.set(storeName, enabled);
  }, []);

  // Save state to localStorage
  const saveState = useCallback((storeName: string, state: any) => {
    if (!persistenceRef.current.get(storeName)) return;
    
    try {
      localStorage.setItem(`state-${storeName}`, JSON.stringify({
        data: state,
        timestamp: Date.now(),
        version: 1
      }));
    } catch (error) {
      console.error(`Failed to save state for ${storeName}:`, error);
    }
  }, []);

  // Load state from localStorage
  const loadState = useCallback((storeName: string) => {
    if (!persistenceRef.current.get(storeName)) return null;
    
    try {
      const stored = localStorage.getItem(`state-${storeName}`);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      return parsed.data;
    } catch (error) {
      console.error(`Failed to load state for ${storeName}:`, error);
      return null;
    }
  }, []);

  // Clear persisted state
  const clearState = useCallback((storeName: string) => {
    localStorage.removeItem(`state-${storeName}`);
  }, []);

  // Clear all persisted states
  const clearAllStates = useCallback(() => {
    for (const storeName of persistenceRef.current.keys()) {
      localStorage.removeItem(`state-${storeName}`);
    }
  }, []);

  // Export all states
  const exportStates = useCallback(() => {
    const states: Record<string, any> = {};
    
    for (const storeName of persistenceRef.current.keys()) {
      const state = loadState(storeName);
      if (state) {
        states[storeName] = state;
      }
    }
    
    return states;
  }, [loadState]);

  // Import states
  const importStates = useCallback((states: Record<string, any>) => {
    for (const [storeName, state] of Object.entries(states)) {
      if (persistenceRef.current.get(storeName)) {
        saveState(storeName, state);
      }
    }
  }, [saveState]);

  return {
    setPersistence,
    saveState,
    loadState,
    clearState,
    clearAllStates,
    exportStates,
    importStates
  };
}

// State Validation Hook
export function useStateValidation() {
  // Validate state transition
  const validateTransition = useCallback((
    fromState: any,
    toState: any,
    rules: Array<(from: any, to: any) => boolean>
  ) => {
    for (const rule of rules) {
      if (!rule(fromState, toState)) {
        return false;
      }
    }
    return true;
  }, []);

  // Validate state structure
  const validateStructure = useCallback((
    state: any,
    schema: Record<string, (value: any) => boolean>
  ) => {
    for (const [key, validator] of Object.entries(schema)) {
      if (!validator(state[key])) {
        return false;
      }
    }
    return true;
  }, []);

  // Validate action
  const validateAction = useCallback((action: StateAction) => {
    if (!action.type || typeof action.type !== 'string') {
      return false;
    }
    
    if (action.timestamp && typeof action.timestamp !== 'number') {
      return false;
    }
    
    return true;
  }, []);

  return {
    validateTransition,
    validateStructure,
    validateAction
  };
}

// State Middleware Hook
export function useStateMiddleware() {
  const middlewareRef = useRef<Map<string, any>>(new Map());

  // Add middleware
  const addMiddleware = useCallback((name: string, middleware: any) => {
    middlewareRef.current.set(name, middleware);
    stateManager.addMiddleware(middleware);
  }, []);

  // Remove middleware
  const removeMiddleware = useCallback((name: string) => {
    middlewareRef.current.delete(name);
    stateManager.removeMiddleware(name);
  }, []);

  // Get all middleware
  const getAllMiddleware = useCallback(() => {
    return Array.from(middlewareRef.current.keys());
  }, []);

  return {
    addMiddleware,
    removeMiddleware,
    getAllMiddleware
  };
}

// State Debugging Hook
export function useStateDebugging() {
  const debugRef = useRef<boolean>(process.env.NODE_ENV === 'development');

  // Enable/disable debugging
  const setDebugEnabled = useCallback((enabled: boolean) => {
    debugRef.current = enabled;
  }, []);

  // Log state change
  const logStateChange = useCallback((
    storeName: string,
    action: StateAction,
    prevState: any,
    newState: any
  ) => {
    if (!debugRef.current) return;
    
    console.group(`🔄 State Change: ${storeName}`);
    console.log('Action:', action);
    console.log('Previous State:', prevState);
    console.log('New State:', newState);
    console.log('Changes:', getStateChanges(prevState, newState));
    console.groupEnd();
  }, []);

  // Get state changes
  const getStateChanges = useCallback((prevState: any, newState: any) => {
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
  }, []);

  // Log state snapshot
  const logStateSnapshot = useCallback((storeName: string, state: any) => {
    if (!debugRef.current) return;
    
    console.group(`📸 State Snapshot: ${storeName}`);
    console.log('State:', state);
    console.log('Size:', JSON.stringify(state).length, 'bytes');
    console.groupEnd();
  }, []);

  // Log performance metrics
  const logPerformanceMetrics = useCallback((
    storeName: string,
    metrics: {
      actionCount: number;
      averageActionTime: number;
      memoryUsage?: number;
    }
  ) => {
    if (!debugRef.current) return;
    
    console.group(`⚡ Performance: ${storeName}`);
    console.log('Action Count:', metrics.actionCount);
    console.log('Average Action Time:', metrics.averageActionTime, 'ms');
    if (metrics.memoryUsage) {
      console.log('Memory Usage:', metrics.memoryUsage, 'MB');
    }
    console.groupEnd();
  }, []);

  return {
    setDebugEnabled,
    logStateChange,
    getStateChanges,
    logStateSnapshot,
    logPerformanceMetrics
  };
}

// State Performance Hook
export function useStatePerformance() {
  const performanceRef = useRef<{
    actionCount: number;
    totalActionTime: number;
    startTime: number;
  }>({
    actionCount: 0,
    totalActionTime: 0,
    startTime: Date.now()
  });

  // Track action performance
  const trackAction = useCallback((action: StateAction, startTime: number, endTime: number) => {
    const duration = endTime - startTime;
    performanceRef.current.actionCount++;
    performanceRef.current.totalActionTime += duration;
  }, []);

  // Get performance metrics
  const getPerformanceMetrics = useCallback(() => {
    const { actionCount, totalActionTime, startTime } = performanceRef.current;
    const averageActionTime = actionCount > 0 ? totalActionTime / actionCount : 0;
    const uptime = Date.now() - startTime;
    
    return {
      actionCount,
      totalActionTime,
      averageActionTime,
      uptime,
      actionsPerSecond: actionCount / (uptime / 1000)
    };
  }, []);

  // Reset performance metrics
  const resetPerformanceMetrics = useCallback(() => {
    performanceRef.current = {
      actionCount: 0,
      totalActionTime: 0,
      startTime: Date.now()
    };
  }, []);

  return {
    trackAction,
    getPerformanceMetrics,
    resetPerformanceMetrics
  };
}

// Export all hooks
export {
  useStateSync,
  useStatePersistence,
  useStateValidation,
  useStateMiddleware,
  useStateDebugging,
  useStatePerformance
};
