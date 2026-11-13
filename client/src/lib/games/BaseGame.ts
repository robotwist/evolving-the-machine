import type { AudioOptions } from "@shared/types";
import { AdaptiveNarrativeDirector } from "../utils/AdaptiveNarrativeDirector";
import { performanceMonitor } from "../utils/PerformanceMonitor";
import * as audio from "./engine/audio";
import { vibrate, type HapticPreset } from "./engine/haptics";
import { ScreenShake } from "./engine/ScreenShake";
import { getGameSettings, type GameSettingsSnapshot } from "./engine/settings";

const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Games are tuned in units per update, so the simulation always advances in fixed 60 Hz steps. */
export const SIMULATION_STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5;
// Frame gaps within this distance of a whole number of steps are treated as exact,
// so a 60 Hz display runs exactly one update per frame despite timer jitter.
const VSYNC_SNAP_MS = 1;

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
  private lastRenderMs: number | null = null;
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
      this.lastFrameTimeMs = null;
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
    if (this.lastFrameTimeMs == null) {
      this.lastFrameTimeMs = now;
    }
    const deltaMs = now - this.lastFrameTimeMs;
    this.lastFrameTimeMs = now;

    performanceMonitor.update();

    if (!this.isPaused) {
      this.advance(deltaMs, now);
    }

    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  /** Runs as many fixed simulation steps as `deltaMs` covers, then renders (subject to the FPS cap). */
  protected advance(deltaMs: number, now = performance.now()) {
    const steps = Math.round(deltaMs / SIMULATION_STEP_MS);
    const snapped = steps * SIMULATION_STEP_MS;
    const frameMs = steps > 0 && Math.abs(deltaMs - snapped) < VSYNC_SNAP_MS ? snapped : deltaMs;

    this.frameAccumulatorMs += frameMs;
    let stepsRun = 0;
    while (this.frameAccumulatorMs >= SIMULATION_STEP_MS - 0.01 && stepsRun < MAX_STEPS_PER_FRAME) {
      this.update(SIMULATION_STEP_MS);
      this.frameAccumulatorMs -= SIMULATION_STEP_MS;
      stepsRun++;
    }
    if (stepsRun === MAX_STEPS_PER_FRAME) {
      // After a long stall (tab switch, debugger), drop the backlog instead of fast-forwarding
      this.frameAccumulatorMs = 0;
    }
    this.frameAccumulatorMs = Math.max(0, this.frameAccumulatorMs);

    if (stepsRun > 0 && this.renderAllowed(now)) {
      this.render();
      this.lastRenderMs = now;
    }
  }

  private renderAllowed(now: number): boolean {
    const fpsCap = getGameSettings().fpsCap;
    if (!fpsCap || this.lastRenderMs == null) return true;
    return now - this.lastRenderMs >= 1000 / fpsCap - VSYNC_SNAP_MS;
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
