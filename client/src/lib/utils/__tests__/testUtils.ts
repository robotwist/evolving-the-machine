/**
 * Testing utilities for game development
 * Provides common mocks, helpers, and test data for consistent testing
 */

import { BaseGame } from '../../games/BaseGame';

// Mock game class for testing
export class MockGame extends BaseGame {
  public testData: any = {};
  
  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    super(ctx, width, height);
  }
  
  async init() {
    // Mock init implementation
  }
  
  update(_deltaTime: number) {
    // Mock update implementation
  }
  
  render() {
    // Mock render implementation
  }
  
  handleInput(_event: KeyboardEvent) {
    // Mock input handling
  }
  
  handlePointerDown(_x: number, _y: number) {
    // Mock pointer handling
  }
  
  handlePointerUp() {
    // Mock pointer handling
  }
  
  handlePointerMove(_x: number, _y: number) {
    // Mock pointer handling
  }
}

// Test data generators
export const createMockPlayer = (overrides: Partial<any> = {}) => ({
  position: { x: 100, y: 100 },
  velocity: { x: 0, y: 0 },
  size: { x: 20, y: 20 },
  alive: true,
  health: 100,
  maxHealth: 100,
  ...overrides,
});

export const createMockEnemy = (overrides: Partial<any> = {}) => ({
  position: { x: 200, y: 200 },
  velocity: { x: 1, y: 0 },
  size: { x: 15, y: 15 },
  alive: true,
  health: 50,
  maxHealth: 50,
  type: 'invader' as 'invader' | 'bomber' | 'kamikaze',
  shootTimer: 0,
  kamikazeMode: false,
  originalVelocity: undefined,
  ...overrides,
});

export const createMockProjectile = (overrides: Partial<any> = {}) => ({
  position: { x: 150, y: 150 },
  velocity: { x: 0, y: -5 },
  size: { x: 3, y: 8 },
  alive: true,
  owner: 'player' as 'player' | 'enemy',
  damage: 25,
  lifetime: 100,
  ...overrides,
});

export const createMockPowerUp = (overrides: Partial<any> = {}) => ({
  position: { x: 300, y: 300 },
  width: 30,
  height: 30,
  type: 'health',
  timer: 0,
  collected: false,
  intensity: 1,
  effect: 'glow-red',
  ...overrides,
});

// Collision detection helpers
export const isColliding = (obj1: any, obj2: any): boolean => {
  return (
    obj1.position.x < obj2.position.x + obj2.size.x &&
    obj1.position.x + obj1.size.x > obj2.position.x &&
    obj1.position.y < obj2.position.y + obj2.size.y &&
    obj1.position.y + obj1.size.y > obj2.position.y
  );
};

// Mock audio state for testing
export const createMockAudioState = () => ({
  isMuted: false,
  masterVolume: 1,
  sfxVolume: 1,
  musicVolume: 1,
  playStinger: jest.fn(),
  playSuccess: jest.fn(),
  playHit: jest.fn(),
  playExplosion: jest.fn(),
  playVO: jest.fn(),
});

// Mock settings for testing
export const createMockSettings = () => ({
  hapticsEnabled: true,
  hitMarkers: true,
  screenShake: true,
  damageNumbers: true,
});

// Mock particle system for testing
export const createMockParticleSystem = () => ({
  addExplosion: jest.fn(),
  addScreenFlash: jest.fn(),
  update: jest.fn(),
  draw: jest.fn(),
});

// Mock visual feedback for testing
export const createMockVisualFeedback = () => ({
  addHitMarker: jest.fn(),
  addScreenShake: jest.fn(),
  update: jest.fn(),
  draw: jest.fn(),
});

// Game state helpers
export const createGameState = (overrides: Partial<any> = {}) => ({
  currentScreen: 'menu',
  currentStage: 1,
  gameState: 'playing',
  unlockedStages: 1,
  showDemo: false,
  productionMode: false,
  ...overrides,
});

// Performance testing helpers
export const measurePerformance = async (fn: () => void | Promise<void>): Promise<number> => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};

// Mock canvas context with additional methods
export const createMockCanvasContext = () => ({
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  fillText: jest.fn(),
  strokeRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  getImageData: jest.fn(),
  putImageData: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  fillStyle: '#000',
  strokeStyle: '#000',
  font: '16px Inter',
  textAlign: 'left',
  textBaseline: 'top',
  globalAlpha: 1,
  canvas: {
    width: 800,
    height: 600,
  },
  shadowColor: '',
  shadowBlur: 0,
  // Additional CanvasRenderingContext2D properties
  getContextAttributes: jest.fn(),
  globalCompositeOperation: 'source-over',
  clip: jest.fn(),
  isPointInPath: jest.fn(),
  isPointInStroke: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  createImageData: jest.fn(),
  createPattern: jest.fn(),
  createConicGradient: jest.fn(),
  arc: jest.fn(),
  arcTo: jest.fn(),
  bezierCurveTo: jest.fn(),
  closePath: jest.fn(),
  ellipse: jest.fn(),
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  lineDashOffset: 0,
  setLineDash: jest.fn(),
  getLineDash: jest.fn(() => []),
  quadraticCurveTo: jest.fn(),
  rect: jest.fn(),
  roundRect: jest.fn(),
  direction: 'inherit',
  textRenderingOptimization: 'auto',
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'low',
  filter: 'none',
}) as unknown as CanvasRenderingContext2D;

// Test assertions for game objects
export const expectGameObject = (obj: any, expected: any) => {
  expect(obj.position).toEqual(expected.position);
  expect(obj.velocity).toEqual(expected.velocity);
  expect(obj.size).toEqual(expected.size);
  expect(obj.alive).toBe(expected.alive);
};

// Mock event helpers
export const createMockKeyboardEvent = (code: string, type: 'keydown' | 'keyup' = 'keydown') => ({
  code,
  type,
  altKey: false,
  charCode: 0,
  ctrlKey: false,
  isComposing: false,
  key: code,
  keyCode: 0,
  location: 0,
  metaKey: false,
  repeat: false,
  shiftKey: false,
  which: 0,
  bubbles: false,
  cancelable: false,
  composed: false,
  currentTarget: null,
  defaultPrevented: false,
  eventPhase: 0,
  target: null,
  timeStamp: 0,
  isTrusted: false,
  NONE: 0,
  CAPTURING_PHASE: 1,
  AT_TARGET: 2,
  BUBBLING_PHASE: 3,
  initEvent: jest.fn(),
  preventDefault: jest.fn(),
  stopImmediatePropagation: jest.fn(),
  stopPropagation: jest.fn(),
}) as unknown as KeyboardEvent;

export const createMockTouchEvent = (x: number, y: number, type: 'touchstart' | 'touchmove' | 'touchend' = 'touchstart') => ({
  type,
  touches: [{ clientX: x, clientY: y }],
  altKey: false,
  changedTouches: [],
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  targetTouches: [],
  bubbles: false,
  cancelable: false,
  composed: false,
  currentTarget: null,
  defaultPrevented: false,
  eventPhase: 0,
  target: null,
  timeStamp: 0,
  isTrusted: false,
  NONE: 0,
  CAPTURING_PHASE: 1,
  AT_TARGET: 2,
  BUBBLING_PHASE: 3,
  initEvent: jest.fn(),
  preventDefault: jest.fn(),
  stopImmediatePropagation: jest.fn(),
  stopPropagation: jest.fn(),
}) as unknown as TouchEvent;

// Animation frame helpers
export const waitForAnimationFrame = (): Promise<void> => {
  return new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });
};

export const waitForFrames = (count: number): Promise<void> => {
  return new Promise(resolve => {
    let frames = 0;
    const callback = () => {
      frames++;
      if (frames >= count) {
        resolve();
      } else {
        requestAnimationFrame(callback);
      }
    };
    requestAnimationFrame(callback);
  });
};

// Mock game loop for testing
export const runGameLoop = async (game: BaseGame, frameCount: number = 60): Promise<void> => {
  for (let i = 0; i < frameCount; i++) {
    game.update(16); // 60 FPS
    await waitForAnimationFrame();
  }
};

// Test data for different game scenarios
export const testScenarios = {
  collision: {
    player: createMockPlayer({ position: { x: 100, y: 100 } }),
    enemy: createMockEnemy({ position: { x: 110, y: 110 } }),
    shouldCollide: true,
  },
  noCollision: {
    player: createMockPlayer({ position: { x: 100, y: 100 } }),
    enemy: createMockEnemy({ position: { x: 200, y: 200 } }),
    shouldCollide: false,
  },
  powerUpCollection: {
    player: createMockPlayer({ position: { x: 100, y: 100 } }),
    powerUp: createMockPowerUp({ position: { x: 105, y: 105 } }),
    shouldCollect: true,
  },
};

export default {
  MockGame,
  createMockPlayer,
  createMockEnemy,
  createMockProjectile,
  createMockPowerUp,
  createMockAudioState,
  createMockSettings,
  createMockParticleSystem,
  createMockVisualFeedback,
  createGameState,
  createMockCanvasContext,
  createMockKeyboardEvent,
  createMockTouchEvent,
  measurePerformance,
  waitForAnimationFrame,
  waitForFrames,
  runGameLoop,
  isColliding,
  expectGameObject,
  testScenarios,
};

// Simple test to satisfy Jest requirement
describe('Test Utils', () => {
  test('should export all utility functions', () => {
    expect(createMockPlayer).toBeDefined();
    expect(createMockEnemy).toBeDefined();
    expect(createMockProjectile).toBeDefined();
    expect(createMockPowerUp).toBeDefined();
    expect(createMockAudioState).toBeDefined();
    expect(createMockSettings).toBeDefined();
    expect(createMockParticleSystem).toBeDefined();
    expect(createMockVisualFeedback).toBeDefined();
    expect(createGameState).toBeDefined();
    expect(createMockCanvasContext).toBeDefined();
    expect(createMockKeyboardEvent).toBeDefined();
    expect(createMockTouchEvent).toBeDefined();
    expect(measurePerformance).toBeDefined();
    expect(waitForAnimationFrame).toBeDefined();
    expect(waitForFrames).toBeDefined();
    expect(runGameLoop).toBeDefined();
    expect(isColliding).toBeDefined();
    expect(expectGameObject).toBeDefined();
    expect(testScenarios).toBeDefined();
  });
});
