export interface StickVector {
  x: number; // -1..1
  y: number; // -1..1
  magnitude: number; // 0..1
  angle: number; // 0..2π
  rawX: number; // Raw screen coordinates
  rawY: number; // Raw screen coordinates
}

export interface TouchControls {
  primary: VirtualStick;
  secondary: VirtualStick;
  action: boolean;
  pause: boolean;
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
  private centerX = 0;
  private centerY = 0;

  constructor(options?: { smoothing?: number; deadZone?: number; maxRadius?: number; centerX?: number; centerY?: number }) {
    this.smoothing = options?.smoothing ?? 0.25; // 0..1, higher = smoother
    this.deadZone = options?.deadZone ?? 0.08; // 0..1
    this.maxRadius = options?.maxRadius ?? 64;
    this.centerX = options?.centerX ?? 0;
    this.centerY = options?.centerY ?? 0;
  }

  // Set stick position for mobile layout
  setPosition(centerX: number, centerY: number) {
    this.centerX = centerX;
    this.centerY = centerY;
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

    // Calculate angle in radians
    const angle = Math.atan2(this.smoothedY, this.smoothedX);

    return {
      x: this.smoothedX,
      y: this.smoothedY,
      magnitude: Math.hypot(this.smoothedX, this.smoothedY),
      angle: angle < 0 ? angle + 2 * Math.PI : angle, // Normalize to 0-2π
      rawX: this.curX,
      rawY: this.curY
    };
  }
}


