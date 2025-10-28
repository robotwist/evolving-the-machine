import React, { useState, useEffect } from 'react';
import { 
  useStateSync, 
  useStatePersistence, 
  useStateValidation, 
  useStateMiddleware, 
  useStateDebugging, 
  useStatePerformance 
} from '../hooks/useStateManagement';
import { stateManager, ActionTypes, createAction } from '../lib/stores/stateManagement';

interface StateManagementDashboardProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function StateManagementDashboard({ isVisible, onToggle }: StateManagementDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'stores' | 'actions' | 'performance' | 'debug'>('overview');
  const [stateSnapshots, setStateSnapshots] = useState<Record<string, any>>({});
  const [actionHistory, setActionHistory] = useState<any[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  
  const {
    getAllStateSnapshots,
    restoreAllStateSnapshots,
    clearAllState,
    getActionHistory,
    clearActionHistory
  } = useStateSync();
  
  const {
    exportStates,
    importStates,
    clearAllStates
  } = useStatePersistence();
  
  const {
    validateTransition,
    validateStructure,
    validateAction
  } = useStateValidation();
  
  const {
    getAllMiddleware
  } = useStateMiddleware();
  
  const {
    setDebugEnabled,
    logStateSnapshot
  } = useStateDebugging();
  
  const {
    getPerformanceMetrics,
    resetPerformanceMetrics
  } = useStatePerformance();

  // Update state snapshots
  useEffect(() => {
    if (isVisible) {
      const snapshots = getAllStateSnapshots();
      setStateSnapshots(snapshots);
    }
  }, [isVisible, getAllStateSnapshots]);

  // Update action history
  useEffect(() => {
    if (isVisible) {
      const history = getActionHistory();
      setActionHistory(history);
    }
  }, [isVisible, getActionHistory]);

  // Update performance metrics
  useEffect(() => {
    if (isVisible) {
      const metrics = getPerformanceMetrics();
      setPerformanceMetrics(metrics);
    }
  }, [isVisible, getPerformanceMetrics]);

  // Auto-refresh data
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      const snapshots = getAllStateSnapshots();
      setStateSnapshots(snapshots);
      
      const history = getActionHistory();
      setActionHistory(history);
      
      const metrics = getPerformanceMetrics();
      setPerformanceMetrics(metrics);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isVisible, getAllStateSnapshots, getActionHistory, getPerformanceMetrics]);

  if (!isVisible) return null;

  const handleExportStates = () => {
    const states = exportStates();
    const dataStr = JSON.stringify(states, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'game-states.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportStates = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const states = JSON.parse(e.target?.result as string);
        importStates(states);
        // Refresh snapshots
        const snapshots = getAllStateSnapshots();
        setStateSnapshots(snapshots);
      } catch (error) {
        console.error('Failed to import states:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleDispatchAction = (actionType: string, payload?: any) => {
    const action = createAction(actionType, payload);
    stateManager.processAction(action, {});
    // Refresh action history
    const history = getActionHistory();
    setActionHistory(history);
  };

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-semibold mb-2">Stores</h3>
          <p className="text-2xl font-bold text-blue-400">{Object.keys(stateSnapshots).length}</p>
          <p className="text-sm text-gray-400">Active stores</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-semibold mb-2">Actions</h3>
          <p className="text-2xl font-bold text-green-400">{actionHistory.length}</p>
          <p className="text-sm text-gray-400">Total actions</p>
        </div>
      </div>
      
      <div className="bg-gray-800 p-4 rounded">
        <h3 className="text-lg font-semibold mb-2">Performance</h3>
        {performanceMetrics && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Actions/sec</p>
              <p className="text-xl font-bold text-yellow-400">
                {performanceMetrics.actionsPerSecond.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Avg Action Time</p>
              <p className="text-xl font-bold text-purple-400">
                {performanceMetrics.averageActionTime.toFixed(2)}ms
              </p>
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-gray-800 p-4 rounded">
        <h3 className="text-lg font-semibold mb-2">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleDispatchAction(ActionTypes.RESET_PROGRESS)}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Reset Progress
          </button>
          <button
            onClick={() => handleDispatchAction(ActionTypes.RESET_SCORES)}
            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-sm"
          >
            Reset Scores
          </button>
          <button
            onClick={clearAllState}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );

  const renderStores = () => (
    <div className="space-y-4">
      {Object.entries(stateSnapshots).map(([storeName, state]) => (
        <div key={storeName} className="bg-gray-800 p-4 rounded">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold capitalize">{storeName}</h3>
            <button
              onClick={() => logStateSnapshot(storeName, state)}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
            >
              Log Snapshot
            </button>
          </div>
          <div className="bg-gray-900 p-3 rounded text-xs font-mono overflow-auto max-h-40">
            <pre>{JSON.stringify(state, null, 2)}</pre>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActions = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Action History</h3>
        <button
          onClick={() => {
            clearActionHistory();
            setActionHistory([]);
          }}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
        >
          Clear History
        </button>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-auto">
        {actionHistory.slice(-50).reverse().map((action, index) => (
          <div key={index} className="bg-gray-800 p-3 rounded">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-blue-400">{action.type}</span>
              <span className="text-xs text-gray-400">
                {new Date(action.timestamp).toLocaleTimeString()}
              </span>
            </div>
            {action.payload && (
              <div className="bg-gray-900 p-2 rounded text-xs font-mono">
                <pre>{JSON.stringify(action.payload, null, 2)}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderPerformance = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Performance Metrics</h3>
        <button
          onClick={() => {
            resetPerformanceMetrics();
            setPerformanceMetrics(getPerformanceMetrics());
          }}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        >
          Reset Metrics
        </button>
      </div>
      
      {performanceMetrics && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 p-4 rounded">
            <h4 className="font-semibold mb-2">Action Statistics</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Actions:</span>
                <span className="font-bold">{performanceMetrics.actionCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Time:</span>
                <span className="font-bold">{performanceMetrics.totalActionTime.toFixed(2)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Average Time:</span>
                <span className="font-bold">{performanceMetrics.averageActionTime.toFixed(2)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Actions/sec:</span>
                <span className="font-bold">{performanceMetrics.actionsPerSecond.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded">
            <h4 className="font-semibold mb-2">System Info</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Uptime:</span>
                <span className="font-bold">{(performanceMetrics.uptime / 1000).toFixed(2)}s</span>
              </div>
              <div className="flex justify-between">
                <span>Memory:</span>
                <span className="font-bold">
                  {performance.memory ? 
                    `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB` : 
                    'N/A'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDebug = () => (
    <div className="space-y-4">
      <div className="bg-gray-800 p-4 rounded">
        <h3 className="text-lg font-semibold mb-2">Debug Controls</h3>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              onChange={(e) => setDebugEnabled(e.target.checked)}
              className="mr-2"
            />
            Enable Debug Logging
          </label>
        </div>
      </div>
      
      <div className="bg-gray-800 p-4 rounded">
        <h3 className="text-lg font-semibold mb-2">State Management</h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleExportStates}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              Export States
            </button>
            <label className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm cursor-pointer">
              Import States
              <input
                type="file"
                accept=".json"
                onChange={handleImportStates}
                className="hidden"
              />
            </label>
          </div>
          <button
            onClick={() => {
              clearAllStates();
              const snapshots = getAllStateSnapshots();
              setStateSnapshots(snapshots);
            }}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Clear Persisted States
          </button>
        </div>
      </div>
      
      <div className="bg-gray-800 p-4 rounded">
        <h3 className="text-lg font-semibold mb-2">Middleware</h3>
        <div className="space-y-1">
          {getAllMiddleware().map((middleware) => (
            <div key={middleware} className="text-sm text-gray-300">
              • {middleware}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">State Management Dashboard</h2>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="flex border-b border-gray-700 mb-4">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'stores', label: 'Stores' },
            { id: 'actions', label: 'Actions' },
            { id: 'performance', label: 'Performance' },
            { id: 'debug', label: 'Debug' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="overflow-auto max-h-[60vh]">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'stores' && renderStores()}
          {activeTab === 'actions' && renderActions()}
          {activeTab === 'performance' && renderPerformance()}
          {activeTab === 'debug' && renderDebug()}
        </div>
      </div>
    </div>
  );
}
