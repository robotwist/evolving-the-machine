export interface StickVector {
  x: number; // -1..1
  y: number; // -1..1
  magnitude: number; // 0..1
}

export class VirtualStick {
  private startX = 0;
  private startY = 0;
  private curX = 0;
  private curY = 0;
  private active = false;
  private smoothedX = 0;
  private smoothedY = 0;
  private smoothing: number;
  private deadZone: number;
  private maxRadius: number;

  constructor(options?: { smoothing?: number; deadZone?: number; maxRadius?: number }) {
    this.smoothing = options?.smoothing ?? 0.25; // 0..1, higher = smoother
    this.deadZone = options?.deadZone ?? 0.08; // 0..1
    this.maxRadius = options?.maxRadius ?? 64;
  }

  begin(x: number, y: number) {
    this.startX = x;
    this.startY = y;
    this.curX = x;
    this.curY = y;
    this.active = true;
  }

  update(x: number, y: number) {
    if (!this.active) return;
    this.curX = x;
    this.curY = y;
  }

  end() {
    this.active = false;
    this.smoothedX = 0;
    this.smoothedY = 0;
  }

  isActive() {
    return this.active;
  }

  getVector(): StickVector {
    if (!this.active) {
      // decay toward 0
      this.smoothedX *= 1 - this.smoothing;
      this.smoothedY *= 1 - this.smoothing;
      return { x: this.smoothedX, y: this.smoothedY, magnitude: Math.hypot(this.smoothedX, this.smoothedY) };
    }
    let dx = this.curX - this.startX;
    let dy = this.curY - this.startY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(1, dist / this.maxRadius);
    if (dist > 0) {
      dx /= dist;
      dy /= dist;
    }
    let mag = clamped;
    if (mag < this.deadZone) mag = 0;
    const targetX = dx * mag;
    const targetY = dy * mag;
    // smoothing
    this.smoothedX = this.smoothedX + (targetX - this.smoothedX) * this.smoothing;
    this.smoothedY = this.smoothedY + (targetY - this.smoothedY) * this.smoothing;
    return { x: this.smoothedX, y: this.smoothedY, magnitude: Math.hypot(this.smoothedX, this.smoothedY) };
  }
}


