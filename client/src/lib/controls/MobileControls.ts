import { VirtualStick, TouchControls } from './VirtualStick';

export interface MobileControlCallbacks {
  onMove: (x: number, y: number) => void;
  onShoot: (x: number, y: number) => void;
  onPause: () => void;
  onAction: () => void;
}

export class MobileControlsManager {
  private canvas: HTMLCanvasElement;
  private controls: TouchControls;
  private callbacks: MobileControlCallbacks;
  private touchIdMap = new Map<number, 'primary' | 'secondary' | 'action' | 'pause'>();
  private isMobile = false;

  // Control positions (responsive)
  private controlZones = {
    left: { x: 0, y: 0, width: 0, height: 0 },
    right: { x: 0, y: 0, width: 0, height: 0 },
    topLeft: { x: 0, y: 0, width: 0, height: 0 },
    topRight: { x: 0, y: 0, width: 0, height: 0 },
    bottomCenter: { x: 0, y: 0, width: 0, height: 0 }
  };

  constructor(canvas: HTMLCanvasElement, callbacks: MobileControlCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.controls = {
      primary: new VirtualStick({ maxRadius: 60, deadZone: 0.1 }),
      secondary: new VirtualStick({ maxRadius: 60, deadZone: 0.1 }),
      action: false,
      pause: false
    };

    this.detectMobile();
    this.setupEventListeners();
    this.updateControlPositions();
  }

  private detectMobile() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

    this.isMobile = isTouchDevice || isMobileUA;

    // Force mobile controls if requested
    if (window.location.search.includes('force-mobile')) {
      this.isMobile = true;
    }
  }

  private updateControlPositions() {
    const rect = this.canvas.getBoundingClientRect();
    const padding = 20;
    const stickSize = 80;

    // Left stick (movement) - bottom left
    this.controlZones.left = {
      x: padding,
      y: rect.height - stickSize - padding,
      width: stickSize,
      height: stickSize
    };

    // Right stick (aiming) - bottom right
    this.controlZones.right = {
      x: rect.width - stickSize - padding,
      y: rect.height - stickSize - padding,
      width: stickSize,
      height: stickSize
    };

    // Action button (shoot) - top right
    this.controlZones.topRight = {
      x: rect.width - 60 - padding,
      y: padding,
      width: 60,
      height: 60
    };

    // Pause button - top left
    this.controlZones.topLeft = {
      x: padding,
      y: padding,
      width: 50,
      height: 50
    };

    // Secondary action - bottom center
    this.controlZones.bottomCenter = {
      x: rect.width / 2 - 40,
      y: rect.height - 80 - padding,
      width: 80,
      height: 50
    };

    // Update stick positions
    this.controls.primary.setPosition(
      this.controlZones.left.x + this.controlZones.left.width / 2,
      this.controlZones.left.y + this.controlZones.left.height / 2
    );

    this.controls.secondary.setPosition(
      this.controlZones.right.x + this.controlZones.right.width / 2,
      this.controlZones.right.y + this.controlZones.right.height / 2
    );
  }

  private setupEventListeners() {
    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

    // Mouse events (for testing on desktop)
    if (!this.isMobile) {
      this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
      this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
      this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    // Window resize for responsive controls
    window.addEventListener('resize', this.updateControlPositions.bind(this));
    window.addEventListener('orientationchange', this.updateControlPositions.bind(this));
  }

  private getTouchZone(x: number, y: number): 'primary' | 'secondary' | 'action' | 'pause' | 'none' {
    const zones = this.controlZones;

    if (x >= zones.left.x && x <= zones.left.x + zones.left.width &&
        y >= zones.left.y && y <= zones.left.y + zones.left.height) {
      return 'primary';
    }

    if (x >= zones.right.x && x <= zones.right.x + zones.right.width &&
        y >= zones.right.y && y <= zones.right.y + zones.right.height) {
      return 'secondary';
    }

    if (x >= zones.topRight.x && x <= zones.topRight.x + zones.topRight.width &&
        y >= zones.topRight.y && y <= zones.topRight.y + zones.topRight.height) {
      return 'action';
    }

    if (x >= zones.topLeft.x && x <= zones.topLeft.x + zones.topLeft.width &&
        y >= zones.topLeft.y && y <= zones.topLeft.y + zones.topLeft.height) {
      return 'pause';
    }

    return 'none';
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const zone = this.getTouchZone(touch.clientX, touch.clientY);

      if (zone !== 'none') {
        this.touchIdMap.set(touch.identifier, zone);

        switch (zone) {
          case 'primary':
            this.controls.primary.begin(touch.clientX, touch.clientY);
            break;
          case 'secondary':
            this.controls.secondary.begin(touch.clientX, touch.clientY);
            break;
          case 'action':
            this.controls.action = true;
            this.callbacks.onAction();
            break;
          case 'pause':
            this.controls.pause = true;
            this.callbacks.onPause();
            break;
        }
      }
    }
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const zone = this.touchIdMap.get(touch.identifier);

      if (zone === 'primary') {
        this.controls.primary.update(touch.clientX, touch.clientY);
        const vector = this.controls.primary.getVector();
        this.callbacks.onMove(vector.x, vector.y);
      } else if (zone === 'secondary') {
        this.controls.secondary.update(touch.clientX, touch.clientY);
        const vector = this.controls.secondary.getVector();
        this.callbacks.onShoot(vector.rawX, vector.rawY);
      }
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const zone = this.touchIdMap.get(touch.identifier);

      if (zone === 'primary') {
        this.controls.primary.end();
        this.callbacks.onMove(0, 0);
      } else if (zone === 'secondary') {
        this.controls.secondary.end();
      } else if (zone === 'action') {
        this.controls.action = false;
      } else if (zone === 'pause') {
        this.controls.pause = false;
      }

      this.touchIdMap.delete(touch.identifier);
    }
  }

  // Mouse event handlers for desktop testing
  private handleMouseDown(e: MouseEvent) {
    const zone = this.getTouchZone(e.clientX, e.clientY);

    if (zone !== 'none') {
      this.touchIdMap.set(0, zone); // Use ID 0 for mouse

      switch (zone) {
        case 'primary':
          this.controls.primary.begin(e.clientX, e.clientY);
          break;
        case 'secondary':
          this.controls.secondary.begin(e.clientX, e.clientY);
          break;
        case 'action':
          this.controls.action = true;
          this.callbacks.onAction();
          break;
        case 'pause':
          this.controls.pause = true;
          this.callbacks.onPause();
          break;
      }
    }
  }

  private handleMouseMove(e: MouseEvent) {
    const zone = this.touchIdMap.get(0);

    if (zone === 'primary') {
      this.controls.primary.update(e.clientX, e.clientY);
      const vector = this.controls.primary.getVector();
      this.callbacks.onMove(vector.x, vector.y);
    } else if (zone === 'secondary') {
      this.controls.secondary.update(e.clientX, e.clientY);
      const vector = this.controls.secondary.getVector();
      this.callbacks.onShoot(vector.rawX, vector.rawY);
    }
  }

  private handleMouseUp(_e: MouseEvent) {
    const zone = this.touchIdMap.get(0);

    if (zone === 'primary') {
      this.controls.primary.end();
      this.callbacks.onMove(0, 0);
    } else if (zone === 'secondary') {
      this.controls.secondary.end();
    } else if (zone === 'action') {
      this.controls.action = false;
    } else if (zone === 'pause') {
      this.controls.pause = false;
    }

    this.touchIdMap.delete(0);
  }

  // Public methods for game integration
  getControls(): TouchControls {
    return this.controls;
  }

  isMobileDevice(): boolean {
    return this.isMobile;
  }

  // Force mobile mode for testing
  setMobileMode(enabled: boolean) {
    this.isMobile = enabled;
    this.updateControlPositions();
  }

  // Cleanup
  destroy() {
    this.canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this));

    if (!this.isMobile) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
      this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
      this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    window.removeEventListener('resize', this.updateControlPositions.bind(this));
    window.removeEventListener('orientationchange', this.updateControlPositions.bind(this));

    this.touchIdMap.clear();
  }
}
