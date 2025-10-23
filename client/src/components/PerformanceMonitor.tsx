import React, { useEffect, useState } from 'react';
import { performanceMonitor, PerformanceMetrics } from '../lib/utils/PerformanceMonitor';

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16,
    drawCalls: 0,
    particleCount: 0,
  });

  useEffect(() => {
    const handleMetricsUpdate = (newMetrics: PerformanceMetrics) => {
      setMetrics(newMetrics);
    };

    performanceMonitor.startMonitoring(handleMetricsUpdate);

    return () => {
      performanceMonitor.stopMonitoring();
    };
  }, []);

  // Only show in development or when explicitly enabled
  const shouldShow = process.env.NODE_ENV === 'development' ||
    (typeof window !== 'undefined' && (window as unknown as { __CULTURAL_ARCADE_SHOW_PERF_MONITOR__?: boolean }).__CULTURAL_ARCADE_SHOW_PERF_MONITOR__);

  if (!shouldShow) {
    return null;
  }

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return 'text-green-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getFrameTimeColor = (frameTime: number) => {
    if (frameTime <= 16) return 'text-green-400';
    if (frameTime <= 33) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed top-4 right-4 bg-black/90 text-white text-xs font-mono p-3 rounded-lg border border-gray-600 z-50 backdrop-blur-sm">
      <div className="mb-2 font-bold text-cyan-400">Performance Monitor</div>
      <div className={`mb-1 ${getFpsColor(metrics.fps)}`}>
        FPS: <span className="font-bold">{metrics.fps}</span>
      </div>
      <div className={`mb-1 ${getFrameTimeColor(metrics.frameTime)}`}>
        Frame: <span className="font-bold">{metrics.frameTime}ms</span>
      </div>
      <div className="mb-1 text-blue-400">
        Particles: <span className="font-bold">{metrics.particleCount}</span>
      </div>
      <div className="mb-1 text-purple-400">
        Draw Calls: <span className="font-bold">{metrics.drawCalls}</span>
      </div>
      {metrics.memoryUsage && (
        <div className="text-orange-400">
          Memory: <span className="font-bold">{metrics.memoryUsage}MB</span>
        </div>
      )}

      {/* Performance warnings */}
      {metrics.fps < 30 && (
        <div className="mt-2 text-red-400 text-xs animate-pulse">
          ⚠️ Low FPS detected!
        </div>
      )}
      {metrics.frameTime > 33 && (
        <div className="mt-1 text-red-400 text-xs animate-pulse">
          ⚠️ High frame time!
        </div>
      )}
    </div>
  );
}
