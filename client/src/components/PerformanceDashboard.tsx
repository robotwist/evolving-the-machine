import React, { useState, useEffect } from 'react';
import { performanceMonitor, PerformanceMetrics, PerformanceHistory } from '../lib/utils/PerformanceMonitor';

interface PerformanceDashboardProps {
  isVisible: boolean;
  onToggle: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ isVisible, onToggle }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [history, setHistory] = useState<PerformanceHistory[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (isVisible && !isMonitoring) {
      setIsMonitoring(true);
      performanceMonitor.startMonitoring((newMetrics) => {
        setMetrics(newMetrics);
        setHistory(performanceMonitor.getPerformanceHistory());
      });
    } else if (!isVisible && isMonitoring) {
      setIsMonitoring(false);
      performanceMonitor.stopMonitoring();
    }
  }, [isVisible, isMonitoring]);

  if (!isVisible || !metrics) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-mono"
        title="Toggle Performance Dashboard"
      >
        📊
      </button>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getMemoryPressureColor = (pressure: string) => {
    switch (pressure) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const summary = performanceMonitor.getPerformanceSummary();

  return (
    <div className="fixed top-4 right-4 z-50 bg-black/90 text-white p-4 rounded-lg font-mono text-xs max-w-sm">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-blue-400">Performance Dashboard</h3>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-white text-lg"
          title="Close Dashboard"
        >
          ×
        </button>
      </div>

      {/* Performance Score */}
      <div className="mb-3">
        <div className="flex justify-between items-center">
          <span>Performance Score:</span>
          <span className={`font-bold ${getStatusColor(summary.status)}`}>
            {summary.score}/100 ({summary.status})
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              summary.score >= 80 ? 'bg-green-400' :
              summary.score >= 60 ? 'bg-blue-400' :
              summary.score >= 40 ? 'bg-yellow-400' : 'bg-red-400'
            }`}
            style={{ width: `${summary.score}%` }}
          />
        </div>
      </div>

      {/* Core Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <div className="text-gray-400">FPS</div>
          <div className={`font-bold ${
            metrics.fps >= 55 ? 'text-green-400' :
            metrics.fps >= 45 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {metrics.fps}
          </div>
        </div>
        <div>
          <div className="text-gray-400">Frame Time</div>
          <div className={`font-bold ${
            metrics.frameTime <= 16.67 ? 'text-green-400' :
            metrics.frameTime <= 22.22 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {metrics.frameTime}ms
          </div>
        </div>
        <div>
          <div className="text-gray-400">Memory</div>
          <div className={`font-bold ${getMemoryPressureColor(metrics.memoryPressure)}`}>
            {metrics.memoryUsage || 'N/A'}MB
          </div>
        </div>
        <div>
          <div className="text-gray-400">Draw Calls</div>
          <div className={`font-bold ${
            metrics.drawCalls <= 500 ? 'text-green-400' :
            metrics.drawCalls <= 1000 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {metrics.drawCalls}
          </div>
        </div>
      </div>

      {/* Advanced Metrics */}
      <div className="mb-3">
        <div className="text-gray-400 mb-1">Advanced Metrics</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Avg Frame Time:</span>
            <span>{metrics.averageFrameTime}ms</span>
          </div>
          <div className="flex justify-between">
            <span>Frame Variance:</span>
            <span>{metrics.frameTimeVariance}ms</span>
          </div>
          <div className="flex justify-between">
            <span>Particles:</span>
            <span className={
              metrics.particleCount <= 200 ? 'text-green-400' :
              metrics.particleCount <= 500 ? 'text-yellow-400' : 'text-red-400'
            }>
              {metrics.particleCount}
            </span>
          </div>
        </div>
      </div>

      {/* Bottlenecks */}
      {metrics.bottlenecks.length > 0 && (
        <div className="mb-3">
          <div className="text-gray-400 mb-1">Bottlenecks</div>
          <div className="space-y-1">
            {metrics.bottlenecks.map((bottleneck, index) => (
              <div key={index} className="text-red-400 text-xs">
                • {bottleneck}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {metrics.recommendations.length > 0 && (
        <div className="mb-3">
          <div className="text-gray-400 mb-1">Recommendations</div>
          <div className="space-y-1">
            {metrics.recommendations.slice(0, 3).map((recommendation, index) => (
              <div key={index} className="text-blue-400 text-xs">
                • {recommendation}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Chart */}
      {history.length > 1 && (
        <div className="mb-3">
          <div className="text-gray-400 mb-1">FPS History (60s)</div>
          <div className="h-16 bg-gray-800 rounded p-1">
            <svg width="100%" height="100%" className="overflow-visible">
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1"
                points={history.map((entry, index) => {
                  const x = (index / (history.length - 1)) * 100;
                  const y = 100 - (entry.metrics.fps / 60) * 100;
                  return `${x},${y}`;
                }).join(' ')}
              />
              {/* Target line */}
              <line x1="0" y1="16.67" x2="100" y2="16.67" stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" />
            </svg>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex space-x-2">
        <button
          onClick={() => {
            performanceMonitor.stopMonitoring();
            performanceMonitor.startMonitoring((newMetrics) => {
              setMetrics(newMetrics);
              setHistory(performanceMonitor.getPerformanceHistory());
            });
          }}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
        >
          Reset
        </button>
        <button
          onClick={() => {
            const data = {
              timestamp: Date.now(),
              metrics,
              history: history.slice(-60) // Last minute
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `performance-report-${new Date().toISOString().slice(0, 19)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs"
        >
          Export
        </button>
      </div>
    </div>
  );
};
