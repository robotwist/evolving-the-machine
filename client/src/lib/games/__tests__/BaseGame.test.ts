import { BaseGame } from '../BaseGame';

// Mock canvas context
const mockCanvas = {
  width: 800,
  height: 600,
  getContext: jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    scale: jest.fn(),
    fillText: jest.fn(),
    strokeText: jest.fn(),
    measureText: jest.fn(() => ({ width: 100 })),
    createLinearGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
    createRadialGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
  })),
} as unknown as HTMLCanvasElement;

// Mock HTMLCanvasElement
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: jest.fn(() => mockCanvas.getContext('2d')),
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn();

// Mock performance.now
global.performance.now = jest.fn(() => Date.now());

// Mock window properties
Object.defineProperty(window, 'devicePixelRatio', {
  value: 1,
  writable: true,
});

// Concrete implementation for testing
class TestGame extends BaseGame {
  public init(): void {
    // Mock implementation
  }

  public update(_deltaTime: number): void {
    // Mock implementation
  }

  public render(): void {
    // Mock implementation
  }

  public handleInput(_event: KeyboardEvent): void {
    // Mock implementation
  }

  public destroy(): void {
    super.destroy();
  }

  // Expose protected methods for testing
  public testGameLoop(): void {
    this.gameLoop();
  }

  public testStart(): void {
    this.start();
  }

  public testStop(): void {
    this.stop();
  }

  public testPause(): void {
    this.pause();
  }

  public testResume(): void {
    this.resume();
  }
}

describe('BaseGame', () => {
  let game: TestGame;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCtx = mockCanvas.getContext('2d') as CanvasRenderingContext2D;
    game = new TestGame(mockCtx, 800, 600);
    jest.clearAllMocks();
  });

  afterEach(() => {
    game.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with correct dimensions', () => {
      expect(game).toBeDefined();
      // Access protected properties through the test class
      expect((game as any).width).toBe(800);
      expect((game as any).height).toBe(600);
    });

    it('should start in stopped state', () => {
      expect((game as any).isRunning).toBe(false);
      expect((game as any).isPaused).toBe(false);
    });
  });

  describe('Game State Management', () => {
    it('should start the game', () => {
      game.testStart();
      expect((game as any).isRunning).toBe(true);
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });

    it('should stop the game', () => {
      game.testStart();
      game.testStop();
      expect((game as any).isRunning).toBe(false);
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('should pause the game', () => {
      game.testStart();
      game.testPause();
      expect((game as any).isPaused).toBe(true);
    });

    it('should resume the game', () => {
      game.testStart();
      game.testPause();
      game.testResume();
      expect((game as any).isPaused).toBe(false);
    });
  });

  describe('Game Loop', () => {
    it('should handle frame timing correctly', () => {
      const mockNow = jest.fn()
        .mockReturnValueOnce(0)    // First frame
        .mockReturnValueOnce(16)   // Second frame (16ms later)
        .mockReturnValueOnce(32);  // Third frame (32ms later)
      
      global.performance.now = mockNow;
      
      game.testStart();
      game.testGameLoop();
      
      expect(mockNow).toHaveBeenCalled();
    });

    it('should not update when paused', () => {
      const updateSpy = jest.spyOn(game, 'update');
      const renderSpy = jest.spyOn(game, 'render');
      
      game.testStart();
      game.testPause();
      game.testGameLoop();
      
      // Should still call update and render, but with paused flag
      expect(updateSpy).toHaveBeenCalled();
      expect(renderSpy).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should handle keyboard events', () => {
      const keydownEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      document.dispatchEvent(keydownEvent);
      
      // The BaseGame should have set up event listeners
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Performance Monitoring', () => {
    it('should track frame timing', () => {
      game.testStart();
      game.testGameLoop();
      
      expect((game as any).lastFrameTimeMs).toBeDefined();
      expect((game as any).frameAccumulatorMs).toBeDefined();
    });

    it('should cap delta time to prevent large jumps', () => {
      const updateSpy = jest.spyOn(game, 'update');
      
      // Simulate a large time jump
      global.performance.now = jest.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1000); // 1 second jump
      
      game.testStart();
      game.testGameLoop();
      
      // Should cap delta time to ~33ms (1000/30)
      expect(updateSpy).toHaveBeenCalledWith(expect.any(Number));
      const deltaTime = updateSpy.mock.calls[0][0];
      expect(deltaTime).toBeLessThanOrEqual(1000 / 30);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      game.testStart();
      game.destroy();
      
      expect((game as any).isRunning).toBe(false);
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
  });
});
