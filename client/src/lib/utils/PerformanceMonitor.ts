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
}

export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 60;
  private isMonitoring = false;
  private onMetricsUpdate?: (metrics: PerformanceMetrics) => void;

  constructor() {
    this.frameTimes = [];
    this.lastFrameTime = performance.now();
  }

  startMonitoring(onUpdate?: (metrics: PerformanceMetrics) => void) {
    this.isMonitoring = true;
    this.onMetricsUpdate = onUpdate;
    this.frameCount = 0;
    this.frameTimes = [];
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

      // Get memory usage if available
      const memoryInfo = performance.memory;
      const memoryUsage = memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024) : undefined;

      const metrics: PerformanceMetrics = {
        fps: this.fps,
        frameTime: Math.round(avgFrameTime),
        memoryUsage,
        drawCalls: 0, // Will be updated by game loop
        particleCount: 0, // Will be updated by particle system
      };

      if (this.onMetricsUpdate) {
        this.onMetricsUpdate(metrics);
      }

      // Log warnings for performance issues
      this.logPerformanceWarnings(metrics);
    }
  }

  private logPerformanceWarnings(metrics: PerformanceMetrics) {
    // Warn about low FPS
    if (metrics.fps < 30) {
      console.warn(`🚨 Low FPS detected: ${metrics.fps}fps (target: 60fps)`);
    }

    // Warn about high frame times
    if (metrics.frameTime > 33) { // Less than 30fps
      console.warn(`🚨 High frame time: ${metrics.frameTime}ms (should be < 33ms)`);
    }

    // Warn about memory usage
    if (metrics.memoryUsage && metrics.memoryUsage > 100) {
      console.warn(`🚨 High memory usage: ${metrics.memoryUsage}MB`);
    }
  }

  getCurrentFPS(): number {
    return this.fps;
  }

  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }

  // Update particle count from particle system
  setParticleCount(count: number) {
    if (this.onMetricsUpdate) {
      const currentMetrics = {
        fps: this.fps,
        frameTime: this.getAverageFrameTime(),
        drawCalls: 0,
        particleCount: count,
      };
      this.onMetricsUpdate(currentMetrics);
    }
  }

  // Update draw call count from game loop
  setDrawCalls(count: number) {
    if (this.onMetricsUpdate) {
      const currentMetrics = {
        fps: this.fps,
        frameTime: this.getAverageFrameTime(),
        drawCalls: count,
        particleCount: 0,
      };
      this.onMetricsUpdate(currentMetrics);
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();
