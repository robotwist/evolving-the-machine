export abstract class BaseGame {
  protected ctx: CanvasRenderingContext2D;
  protected width: number;
  protected height: number;
  protected isRunning = false;
  protected isPaused = false;
  protected animationId: number | null = null;
  
  // Event callbacks
  onScoreUpdate?: (score: number) => void;
  onGameOver?: () => void;
  onStageComplete?: () => void;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.setupEventListeners();
  }

  abstract init(): void;
  abstract update(deltaTime: number): void;
  abstract render(): void;
  abstract handleInput(event: KeyboardEvent): void;

  start() {
    this.isRunning = true;
    this.isPaused = false;
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

    if (!this.isPaused) {
      this.update(16.67); // ~60fps
      this.render();
    }

    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  protected setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (this.isRunning && !this.isPaused) {
        this.handleInput(e);
      }
    });
  }

  protected cleanup() {
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
}
