import { useState, useEffect, useCallback } from 'react';
import { performanceMonitor, PerformanceMetrics } from '../lib/utils/PerformanceMonitor';

export interface UsePerformanceMonitorReturn {
  metrics: PerformanceMetrics | null;
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  toggleMonitoring: () => void;
  getPerformanceSummary: () => {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    mainBottleneck?: string;
    recommendation?: string;
  };
  addDrawCall: () => void;
  setParticleCount: (count: number) => void;
}

export const usePerformanceMonitor = (): UsePerformanceMonitorReturn => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const startMonitoring = useCallback(() => {
    if (!isMonitoring) {
      setIsMonitoring(true);
      performanceMonitor.startMonitoring((newMetrics) => {
        setMetrics(newMetrics);
      });
    }
  }, [isMonitoring]);

  const stopMonitoring = useCallback(() => {
    if (isMonitoring) {
      setIsMonitoring(false);
      performanceMonitor.stopMonitoring();
    }
  }, [isMonitoring]);

  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  }, [isMonitoring, startMonitoring, stopMonitoring]);

  const getPerformanceSummary = useCallback(() => {
    return performanceMonitor.getPerformanceSummary();
  }, []);

  const addDrawCall = useCallback(() => {
    performanceMonitor.addDrawCall();
  }, []);

  const setParticleCount = useCallback((count: number) => {
    performanceMonitor.setParticleCount(count);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isMonitoring) {
        performanceMonitor.stopMonitoring();
      }
    };
  }, [isMonitoring]);

  return {
    metrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    toggleMonitoring,
    getPerformanceSummary,
    addDrawCall,
    setParticleCount
  };
};
