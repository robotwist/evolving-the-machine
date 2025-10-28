// Performance monitoring and frame rate tracking
// Extend Performance interface for memory monitoring
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage?: number;
  drawCalls: number;
  particleCount: number;
  // Enhanced metrics
  averageFrameTime: number;
  frameTimeVariance: number;
  memoryPressure: 'low' | 'medium' | 'high';
  performanceScore: number;
  bottlenecks: string[];
  recommendations: string[];
}

export interface PerformanceHistory {
  timestamp: number;
  metrics: PerformanceMetrics;
}

export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 60;
  private isMonitoring = false;
  private onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
  private history: PerformanceHistory[] = [];
  private maxHistorySize = 300; // 5 minutes at 60fps
  private drawCallCount = 0;
  private particleCount = 0;
  private performanceThresholds = {
    fps: { good: 55, warning: 45, critical: 30 },
    frameTime: { good: 16.67, warning: 22.22, critical: 33.33 },
    memory: { good: 50, warning: 100, critical: 200 }
  };

  constructor() {
    this.frameTimes = [];
    this.lastFrameTime = performance.now();
  }

  startMonitoring(onUpdate?: (metrics: PerformanceMetrics) => void) {
    this.isMonitoring = true;
    this.onMetricsUpdate = onUpdate;
    this.frameCount = 0;
    this.frameTimes = [];
    this.history = [];
    this.lastFrameTime = performance.now();
  }

  stopMonitoring() {
    this.isMonitoring = false;
  }

  update() {
    if (!this.isMonitoring) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Track frame times for FPS calculation
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift(); // Keep only last 60 frames
    }

    this.frameCount++;

    // Update FPS every second
    if (this.frameCount % 60 === 0) {
      const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.fps = Math.round(1000 / avgFrameTime);

      // Calculate frame time variance
      const variance = this.frameTimes.reduce((acc, time) => acc + Math.pow(time - avgFrameTime, 2), 0) / this.frameTimes.length;
      const frameTimeVariance = Math.sqrt(variance);

      // Get memory usage if available
      const memoryInfo = performance.memory;
      const memoryUsage = memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024) : undefined;

      // Determine memory pressure
      let memoryPressure: 'low' | 'medium' | 'high' = 'low';
      if (memoryUsage) {
        if (memoryUsage > this.performanceThresholds.memory.critical) {
          memoryPressure = 'high';
        } else if (memoryUsage > this.performanceThresholds.memory.warning) {
          memoryPressure = 'medium';
        }
      }

      // Calculate performance score (0-100)
      const performanceScore = this.calculatePerformanceScore(this.fps, avgFrameTime, memoryUsage);

      // Detect bottlenecks
      const bottlenecks = this.detectBottlenecks(this.fps, avgFrameTime, memoryUsage, this.drawCallCount, this.particleCount);

      // Generate recommendations
      const recommendations = this.generateRecommendations(bottlenecks, performanceScore);

      const metrics: PerformanceMetrics = {
        fps: this.fps,
        frameTime: Math.round(avgFrameTime),
        averageFrameTime: Math.round(avgFrameTime),
        frameTimeVariance: Math.round(frameTimeVariance),
        memoryUsage,
        memoryPressure,
        performanceScore,
        drawCalls: this.drawCallCount,
        particleCount: this.particleCount,
        bottlenecks,
        recommendations
      };

      // Store in history
      this.history.push({
        timestamp: now,
        metrics: { ...metrics }
      });

      // Keep history size manageable
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }

      if (this.onMetricsUpdate) {
        this.onMetricsUpdate(metrics);
      }

      // Log warnings for performance issues
      this.logPerformanceWarnings(metrics);

      // Reset counters
      this.drawCallCount = 0;
      this.particleCount = 0;
    }
  }

  private calculatePerformanceScore(fps: number, frameTime: number, memoryUsage?: number): number {
    let score = 100;

    // FPS scoring (40% weight)
    if (fps < this.performanceThresholds.fps.critical) {
      score -= 40;
    } else if (fps < this.performanceThresholds.fps.warning) {
      score -= 20;
    } else if (fps < this.performanceThresholds.fps.good) {
      score -= 10;
    }

    // Frame time scoring (30% weight)
    if (frameTime > this.performanceThresholds.frameTime.critical) {
      score -= 30;
    } else if (frameTime > this.performanceThresholds.frameTime.warning) {
      score -= 15;
    } else if (frameTime > this.performanceThresholds.frameTime.good) {
      score -= 5;
    }

    // Memory scoring (30% weight)
    if (memoryUsage) {
      if (memoryUsage > this.performanceThresholds.memory.critical) {
        score -= 30;
      } else if (memoryUsage > this.performanceThresholds.memory.warning) {
        score -= 15;
      } else if (memoryUsage > this.performanceThresholds.memory.good) {
        score -= 5;
      }
    }

    return Math.max(0, score);
  }

  private detectBottlenecks(fps: number, frameTime: number, drawCalls: number, particleCount: number, memoryUsage?: number): string[] {
    const bottlenecks: string[] = [];

    if (fps < this.performanceThresholds.fps.warning) {
      bottlenecks.push('Low FPS');
    }

    if (frameTime > this.performanceThresholds.frameTime.warning) {
      bottlenecks.push('High Frame Time');
    }

    if (memoryUsage && memoryUsage > this.performanceThresholds.memory.warning) {
      bottlenecks.push('High Memory Usage');
    }

    if (drawCalls > 1000) {
      bottlenecks.push('Excessive Draw Calls');
    }

    if (particleCount > 500) {
      bottlenecks.push('Too Many Particles');
    }

    return bottlenecks;
  }

  private generateRecommendations(bottlenecks: string[], performanceScore: number): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.includes('Low FPS')) {
      recommendations.push('Consider reducing graphics quality');
      recommendations.push('Enable frame rate limiting');
    }

    if (bottlenecks.includes('High Frame Time')) {
      recommendations.push('Optimize game loop efficiency');
      recommendations.push('Reduce update frequency for non-critical systems');
    }

    if (bottlenecks.includes('High Memory Usage')) {
      recommendations.push('Implement object pooling');
      recommendations.push('Clear unused assets from memory');
    }

    if (bottlenecks.includes('Excessive Draw Calls')) {
      recommendations.push('Batch similar draw operations');
      recommendations.push('Use sprite atlases');
    }

    if (bottlenecks.includes('Too Many Particles')) {
      recommendations.push('Reduce particle count');
      recommendations.push('Use particle pooling');
    }

    if (performanceScore < 50) {
      recommendations.push('Consider enabling performance mode');
      recommendations.push('Reduce visual effects');
    }

    return recommendations;
  }

  private logPerformanceWarnings(metrics: PerformanceMetrics) {
    // Warn about low FPS
    if (metrics.fps < this.performanceThresholds.fps.warning) {
      console.warn(`🚨 Low FPS detected: ${metrics.fps}fps (target: 60fps)`);
    }

    // Warn about high frame times
    if (metrics.frameTime > this.performanceThresholds.frameTime.warning) {
      console.warn(`🚨 High frame time: ${metrics.frameTime}ms (should be < 22ms)`);
    }

    // Warn about memory usage
    if (metrics.memoryUsage && metrics.memoryUsage > this.performanceThresholds.memory.warning) {
      console.warn(`🚨 High memory usage: ${metrics.memoryUsage}MB`);
    }

    // Warn about performance score
    if (metrics.performanceScore < 50) {
      console.warn(`🚨 Poor performance score: ${metrics.performanceScore}/100`);
    }
  }

  getCurrentFPS(): number {
    return this.fps;
  }

  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }

  getPerformanceHistory(): PerformanceHistory[] {
    return [...this.history];
  }

  getCurrentMetrics(): PerformanceMetrics | null {
    if (this.history.length === 0) return null;
    return this.history[this.history.length - 1].metrics;
  }

  // Update particle count from particle system
  setParticleCount(count: number) {
    this.particleCount = count;
  }

  // Update draw call count from game loop
  setDrawCalls(count: number) {
    this.drawCallCount = count;
  }

  // Add draw call (called by rendering systems)
  addDrawCall() {
    this.drawCallCount++;
  }

  // Get performance summary
  getPerformanceSummary(): {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    mainBottleneck?: string;
    recommendation?: string;
  } {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) {
      return { score: 0, status: 'poor' };
    }

    const score = currentMetrics.performanceScore;
    let status: 'excellent' | 'good' | 'fair' | 'poor';
    
    if (score >= 80) status = 'excellent';
    else if (score >= 60) status = 'good';
    else if (score >= 40) status = 'fair';
    else status = 'poor';

    return {
      score,
      status,
      mainBottleneck: currentMetrics.bottlenecks[0],
      recommendation: currentMetrics.recommendations[0]
    };
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();
