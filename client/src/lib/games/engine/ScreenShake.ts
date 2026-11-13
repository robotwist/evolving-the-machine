import { isScreenShakeAllowed } from './settings';

/**
 * Frame-based screen shake. `trigger(frames)` starts (or extends) a shake;
 * `begin()` / `end()` wrap a render pass with the jitter offset applied.
 * Respects the player's screen-shake and reduce-motion settings.
 */
export class ScreenShake {
  private framesLeft = 0;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly amplitudeX = 6,
    private readonly amplitudeY = 4
  ) {}

  trigger(frames: number) {
    if (!isScreenShakeAllowed()) return;
    this.framesLeft = Math.max(this.framesLeft, frames);
  }

  get active(): boolean {
    return this.framesLeft > 0;
  }

  get remaining(): number {
    return this.framesLeft;
  }

  clear() {
    this.framesLeft = 0;
  }

  /** Saves the context and translates it by this frame's jitter. Always pair with end(). */
  begin(scale = 1) {
    this.ctx.save();
    if (this.framesLeft <= 0 || !isScreenShakeAllowed()) {
      this.framesLeft = 0;
      return;
    }
    this.framesLeft--;
    const ox = (Math.random() - 0.5) * this.amplitudeX * scale;
    const oy = (Math.random() - 0.5) * this.amplitudeY * scale;
    this.ctx.translate(ox, oy);
  }

  end() {
    this.ctx.restore();
  }
}
