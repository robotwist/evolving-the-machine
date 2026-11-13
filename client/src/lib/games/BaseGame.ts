import type { AudioOptions } from "@shared/types";
import { AdaptiveNarrativeDirector } from "../utils/AdaptiveNarrativeDirector";
import { performanceMonitor } from "../utils/PerformanceMonitor";
import * as audio from "./engine/audio";
import { vibrate, type HapticPreset } from "./engine/haptics";
import { ScreenShake } from "./engine/ScreenShake";
import { getGameSettings, type GameSettingsSnapshot } from "./engine/settings";

const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function isTextEntryTarget(target: unknown): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

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
  /** Codes (KeyboardEvent.code) of keys currently held down. */
  protected keys: Set<string> = new Set();
  protected screenShake: ScreenShake;
  private removeInputListeners: (() => void) | null = null;
  
  // Event callbacks
  onScoreUpdate?: (score: number) => void;
  onGameOver?: () => void;
  onStageComplete?: () => void;

  // Mobile input handlers (optional, for mobile support)
  handleMobileMove?(x: number, y: number): void;
  handleMobileShoot?(x: number, y: number): void;
  handleMobileAction?(): void;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.director = new AdaptiveNarrativeDirector();
    this.screenShake = new ScreenShake(ctx);
    this.setupEventListeners();
  }

  abstract init(): Promise<void> | void;
  abstract update(deltaTime: number): void;
  abstract render(): void;

  /** Called for each keydown while the game is running. Held keys are tracked in `keys`. */
  handleInput(_event: KeyboardEvent): void {}

  // Optional pointer/touch hooks, in canvas CSS pixels
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
    this.keys.clear();
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
    const minFrameMs = 1000 / Math.max(1, getGameSettings().fpsCap);

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
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.isRunning || this.isPaused) return;
      if (SCROLL_KEYS.has(e.code) && !isTextEntryTarget(e.target)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      this.handleInput(e);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    // Keyup never arrives for keys held while the window loses focus
    const onBlur = () => this.keys.clear();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    this.removeInputListeners = () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }

  /** Releases listeners and resources. Subclasses that override must call super.cleanup(). */
  protected cleanup() {
    this.removeInputListeners?.();
    this.removeInputListeners = null;
    this.keys.clear();
  }

  protected isKeyDown(...codes: string[]): boolean {
    return codes.some(code => this.keys.has(code));
  }

  protected getSettings(): GameSettingsSnapshot {
    return getGameSettings();
  }

  protected playStinger(stinger: string) {
    audio.playStinger(stinger);
  }

  protected playVO(text: string, options: AudioOptions = {}) {
    audio.playVO(text, options);
  }

  protected playHitSound() {
    audio.playHit();
  }

  protected playSuccessSound() {
    audio.playSuccess();
  }

  protected vibrate(pattern: HapticPreset | number | number[]) {
    vibrate(pattern);
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
