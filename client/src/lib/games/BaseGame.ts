import { AdaptiveNarrativeDirector } from "../utils/AdaptiveNarrativeDirector";
import { performanceMonitor } from "../utils/PerformanceMonitor";

export abstract class BaseGame {
  protected ctx: CanvasRenderingContext2D;
  protected width: number;
  protected height: number;
  protected isRunning = false;
  protected isPaused = false;
  protected animationId: number | null = null;
  protected lastFrameTimeMs: number | null = null;
  protected frameAccumulatorMs = 0;
  protected director: AdaptiveNarrativeDirector;
  protected keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  
  // Event callbacks
  onScoreUpdate?: (score: number) => void;
  onGameOver?: () => void;
  onStageComplete?: () => void;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.director = new AdaptiveNarrativeDirector();
    this.setupEventListeners();
  }

  abstract init(): Promise<void> | void;
  abstract update(deltaTime: number): void;
  abstract render(): void;
  abstract handleInput(event: KeyboardEvent): void;
  // Optional pointer/touch hooks
  handlePointerDown?(x: number, y: number): void;
  handlePointerMove?(x: number, y: number): void;
  handlePointerUp?(): void;

  start() {
    this.isRunning = true;
    this.isPaused = false;
    performanceMonitor.startMonitoring(); // Start performance monitoring
    this.init();
    this.gameLoop();
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    if (!this.animationId) {
      this.gameLoop();
    }
  }

  stop() {
    this.isRunning = false;
    performanceMonitor.stopMonitoring(); // Stop performance monitoring
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy() {
    this.stop();
    this.cleanup();
  }

  protected gameLoop() {
    if (!this.isRunning) return;
    const now = performance.now();
    const targetFps = (window as unknown as { __CULTURAL_ARCADE_FPS_CAP__?: number }).__CULTURAL_ARCADE_FPS_CAP__ ?? 60;
    const minFrameMs = 1000 / Math.max(1, targetFps);

    if (this.lastFrameTimeMs == null) {
      this.lastFrameTimeMs = now;
    }
    const deltaMs = now - this.lastFrameTimeMs;
    this.lastFrameTimeMs = now;

    // Update performance monitor
    performanceMonitor.update();

    if (!this.isPaused) {
      this.frameAccumulatorMs += deltaMs;
      if (this.frameAccumulatorMs >= minFrameMs) {
        const clampedDt = Math.min(this.frameAccumulatorMs, 1000 / 30); // cap dt to ~33ms to avoid huge jumps
        this.update(clampedDt);
        this.render();
        this.frameAccumulatorMs = 0;
      }
    }

    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  protected setupEventListeners() {
    // Store the handler so we can remove it later
    this.keydownHandler = (e: KeyboardEvent) => {
      if (this.isRunning && !this.isPaused) {
        this.handleInput(e);
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
  }

  protected cleanup() {
    // Remove event listener to prevent memory leaks
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    // Override in subclasses if needed
  }

  protected drawText(text: string, x: number, y: number, size = 16, color = 'white', align: CanvasTextAlign = 'left') {
    this.ctx.save();
    this.ctx.font = `${size}px Inter, sans-serif`;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.fillText(text, x, y);
    this.ctx.restore();
  }

  protected clearCanvas() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}
