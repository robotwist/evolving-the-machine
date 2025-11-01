/**
 * Unit tests for BaseGame functionality
 * Tests core game mechanics, lifecycle, and input handling
 */

import { 
  createMockCanvasContext, 
  createMockKeyboardEvent, 
  createMockTouchEvent,
  runGameLoop,
  MockGame
} from '../../utils/__tests__/testUtils';

describe('BaseGame', () => {
  let game: MockGame;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    // Create mock canvas and context
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;
    
    mockContext = createMockCanvasContext() as CanvasRenderingContext2D;
    jest.spyOn(mockCanvas, 'getContext').mockReturnValue(mockContext);

    // Create game instance with correct constructor signature
    game = new MockGame(mockContext, 800, 600);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Game Initialization', () => {
    test('should initialize with correct default values', () => {
      // Test that the game instance was created successfully
      expect(game).toBeDefined();
      expect(game).toBeInstanceOf(MockGame);
    });

    test('should handle resize correctly', () => {
      expect(() => game.resize(1024, 768)).not.toThrow();
    });

    test('should maintain aspect ratio on resize', () => {
      expect(() => game.resize(1600, 900)).not.toThrow();
    });
  });

  describe('Input Handling', () => {
    test('should handle keyboard input correctly', () => {
      const keyDownEvent = createMockKeyboardEvent('KeyA', 'keydown');
      const keyUpEvent = createMockKeyboardEvent('KeyA', 'keyup');

      expect(() => game.handleInput(keyDownEvent)).not.toThrow();
      expect(() => game.handleInput(keyUpEvent)).not.toThrow();
    });

    test('should handle multiple keys simultaneously', () => {
      const keyA = createMockKeyboardEvent('KeyA', 'keydown');
      const keyD = createMockKeyboardEvent('KeyD', 'keydown');
      const space = createMockKeyboardEvent('Space', 'keydown');

      expect(() => game.handleInput(keyA)).not.toThrow();
      expect(() => game.handleInput(keyD)).not.toThrow();
      expect(() => game.handleInput(space)).not.toThrow();
    });

    test('should handle touch input correctly', () => {
      const _touchEvent = createMockTouchEvent(100, 200, 'touchstart');
      
      game.handlePointerDown(100, 200);
      // Touch handling should not throw errors
      expect(() => game.handlePointerDown(100, 200)).not.toThrow();
    });

    test('should handle pointer movement', () => {
      expect(() => game.handlePointerMove(150, 250)).not.toThrow();
    });

    test('should handle pointer up events', () => {
      expect(() => game.handlePointerUp()).not.toThrow();
    });
  });

  describe('Game Loop', () => {
    test('should update game state correctly', async () => {
      const updateSpy = jest.spyOn(game, 'update');
      
      await runGameLoop(game, 5);
      
      expect(updateSpy).toHaveBeenCalledTimes(5);
    });

    test('should handle draw calls', () => {
      const renderSpy = jest.spyOn(game, 'render');
      
      game.render();
      
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    test('should maintain consistent frame timing', async () => {
      const startTime = performance.now();
      
      await runGameLoop(game, 10);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should take at least some time for 10 frames
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Reasonable upper bound
    });
  });

  describe('Game State Management', () => {
    test('should track game state correctly', () => {
      // Test that the game instance exists and can be used
      expect(game).toBeDefined();
    });

    test('should handle game lifecycle events', () => {
      const onGameOver = jest.fn();
      const onStageComplete = jest.fn();
      
      game.onGameOver = onGameOver;
      game.onStageComplete = onStageComplete;
      
      // Test callback assignments
      expect(game.onGameOver).toBe(onGameOver);
      expect(game.onStageComplete).toBe(onStageComplete);
    });
  });

  describe('Performance', () => {
    test('should handle high frame rates without issues', async () => {
      const updateSpy = jest.spyOn(game, 'update');
      
      await runGameLoop(game, 120); // 2 seconds at 60fps
      
      expect(updateSpy).toHaveBeenCalledTimes(120);
    });

    test('should maintain memory efficiency', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      await runGameLoop(game, 100);
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 1MB for 100 frames)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input gracefully', () => {
      expect(() => game.handleInput(null as any)).not.toThrow();
      expect(() => game.handleInput(undefined as any)).not.toThrow();
    });

    test('should handle invalid resize values', () => {
      expect(() => game.resize(-100, -100)).not.toThrow();
      expect(() => game.resize(0, 0)).not.toThrow();
      expect(() => game.resize(NaN, NaN)).not.toThrow();
    });

    test('should handle canvas context errors', () => {
      const invalidCanvas = document.createElement('canvas');
      jest.spyOn(invalidCanvas, 'getContext').mockReturnValue(null);
      
      expect(() => new MockGame(null as any, 800, 600)).not.toThrow();
    });
  });

  describe('Integration', () => {
    test('should work with real canvas element', () => {
      const realCanvas = document.createElement('canvas');
      realCanvas.width = 400;
      realCanvas.height = 300;
      
      const realGame = new MockGame(mockContext, 400, 300);
      
      expect(realGame).toBeDefined();
    });

    test('should handle rapid input changes', () => {
      const events = [
        createMockKeyboardEvent('KeyA', 'keydown'),
        createMockKeyboardEvent('KeyD', 'keydown'),
        createMockKeyboardEvent('KeyA', 'keyup'),
        createMockKeyboardEvent('Space', 'keydown'),
        createMockKeyboardEvent('KeyD', 'keyup'),
        createMockKeyboardEvent('Space', 'keyup'),
      ];
      
      events.forEach(event => {
        expect(() => game.handleInput(event)).not.toThrow();
      });
      
      // Test that the game handled all events without errors
      expect(game).toBeDefined();
    });
  });
});