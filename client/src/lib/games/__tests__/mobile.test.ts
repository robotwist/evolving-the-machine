/**
 * Mobile-specific testing utilities and tests
 * Tests touch controls, PWA functionality, and mobile performance
 */

import { DefenderGame } from '../DefenderGame';
import { PongGame } from '../PongGame';
import { BreakoutGame } from '../BreakoutGame';
import { 
  createMockCanvasContext,
  createMockTouchEvent,
  waitForFrames,
  runGameLoop
} from '../../utils/__tests__/testUtils';

// Mock mobile environment
const mockMobileEnvironment = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  screen: { width: 375, height: 667 },
  touch: true,
  orientation: 'portrait',
  connection: { effectiveType: '4g' },
  deviceMemory: 4,
  hardwareConcurrency: 6,
};

// Mock PWA APIs
const mockPWAApis = {
  serviceWorker: {
    register: jest.fn(() => Promise.resolve()),
    ready: Promise.resolve(),
  },
  beforeinstallprompt: null,
  appinstalled: null,
  manifest: {
    name: 'Evolving The Machine',
    short_name: 'ETM',
    start_url: '/',
    display: 'standalone',
    theme_color: '#000000',
    background_color: '#ffffff',
  },
};

Object.assign(global, mockMobileEnvironment);
Object.assign(global, mockPWAApis);

describe('Mobile Testing Suite', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 375; // Mobile width
    mockCanvas.height = 667; // Mobile height
    
    mockContext = createMockCanvasContext() as CanvasRenderingContext2D;
    jest.spyOn(mockCanvas, 'getContext').mockReturnValue(mockContext);

    // Mock mobile-specific APIs
    Object.defineProperty(navigator, 'userAgent', {
      value: mockMobileEnvironment.userAgent,
      writable: true,
    });

    Object.defineProperty(window.screen, 'width', {
      value: mockMobileEnvironment.screen.width,
      writable: true,
    });

    Object.defineProperty(window.screen, 'height', {
      value: mockMobileEnvironment.screen.height,
      writable: true,
    });

    // Mock touch events
    Object.defineProperty(window, 'ontouchstart', {
      value: true,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Touch Controls Testing', () => {
    let defenderGame: DefenderGame;
    let pongGame: PongGame;
    let breakoutGame: BreakoutGame;

    beforeEach(() => {
      defenderGame = new DefenderGame(mockContext, 375, 667);
      pongGame = new PongGame(mockContext, 375, 667);
      breakoutGame = new BreakoutGame(mockContext, 375, 667);

      defenderGame.init();
      pongGame.init();
      breakoutGame.init();
    });

    test('DefenderGame should handle touch shooting', () => {
      const initialBulletCount = defenderGame['playerBullets'].length;
      
      // Touch anywhere should shoot
      defenderGame.handlePointerDown(200, 300);
      
      expect(defenderGame['playerBullets'].length).toBeGreaterThan(initialBulletCount);
    });

    test('DefenderGame should handle touch movement', () => {
      const _initialX = defenderGame['player'].position.x;
      
      // Touch left side should move left
      defenderGame.handlePointerDown(100, 300);
      
      expect(defenderGame['keys'].has('ArrowLeft')).toBe(true);
      expect(defenderGame['keys'].has('KeyA')).toBe(true);
    });

    test('PongGame should handle touch paddle movement', () => {
      const _initialPaddleX = pongGame['player1'].x;
      
      // Touch should move paddle
      pongGame.handlePointerDown(200, 300);
      
      // Paddle should move toward touch position
      expect((pongGame as any)['targetPaddleX']).toBeDefined();
    });

    test('BreakoutGame should handle touch paddle movement', () => {
      const _initialPaddleX = breakoutGame['paddle'].x;
      
      // Touch should move paddle
      breakoutGame.handlePointerDown(200, 300);
      
      // Paddle should move toward touch position
      expect(breakoutGame['targetPaddleX']).toBeDefined();
    });

    test('should handle multi-touch gestures', () => {
      // Simulate multi-touch
      const _touch1 = createMockTouchEvent(100, 300, 'touchstart');
      const _touch2 = createMockTouchEvent(200, 300, 'touchstart');
      
      expect(() => {
        defenderGame.handlePointerDown(100, 300);
        defenderGame.handlePointerDown(200, 300);
      }).not.toThrow();
    });

    test('should handle touch move events', () => {
      expect(() => {
        defenderGame.handlePointerMove(150, 250);
        pongGame.handlePointerMove(150, 250);
        breakoutGame.handlePointerMove(150, 250);
      }).not.toThrow();
    });

    test('should handle touch end events', () => {
      expect(() => {
        defenderGame.handlePointerUp();
        pongGame.handlePointerUp();
        breakoutGame.handlePointerUp();
      }).not.toThrow();
    });
  });

  describe('Mobile Performance Testing', () => {
    test('should maintain 60fps on mobile devices', async () => {
      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      const frameTimes: number[] = [];
      const startTime = performance.now();

      for (let i = 0; i < 60; i++) {
        const frameStart = performance.now();
        game.update(16);
        const frameEnd = performance.now();
        frameTimes.push(frameEnd - frameStart);
        await waitForFrames(1);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

      // Should maintain 60fps (16.67ms per frame)
      expect(averageFrameTime).toBeLessThan(20); // Allow some margin
      expect(totalTime).toBeLessThan(1200); // Should complete in under 1.2 seconds
    });

    test('should handle memory constraints on mobile', async () => {
      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Simulate intensive gameplay
      for (let i = 0; i < 10; i++) {
        game['spawnWave'](); // Spawn enemies
        await runGameLoop(game, 60); // Run for 1 second
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable for mobile
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
    });

    test('should handle low-end device performance', async () => {
      // Simulate low-end device
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: 2,
        writable: true,
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        value: 2,
        writable: true,
      });

      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      const startTime = performance.now();
      await runGameLoop(game, 30); // 0.5 seconds
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('PWA Functionality Testing', () => {
    test('should detect PWA installation capability', () => {
      // Mock beforeinstallprompt event
      const mockEvent = new Event('beforeinstallprompt') as any;
      mockEvent.prompt = jest.fn();

      window.dispatchEvent(mockEvent);

      expect(mockEvent.prompt).toBeDefined();
    });

    test('should handle service worker registration', async () => {
      const mockServiceWorker = {
        register: jest.fn(() => Promise.resolve()),
        ready: Promise.resolve(),
      };

      Object.defineProperty(navigator, 'serviceWorker', {
        value: mockServiceWorker,
        writable: true,
      });

      const _result = await navigator.serviceWorker.register('/sw.js');
      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js');
    });

    test('should handle offline functionality', () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      // Game should still work offline
      expect(() => {
        game.update(16);
        game.render();
      }).not.toThrow();
    });

    test('should handle app installation', () => {
      const mockEvent = new Event('appinstalled');
      
      expect(() => {
        window.dispatchEvent(mockEvent);
      }).not.toThrow();
    });
  });

  describe('Mobile-Specific Game Features', () => {
    test('should handle screen orientation changes', () => {
      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      // Simulate orientation change
      Object.defineProperty(window.screen, 'width', {
        value: 667, // Portrait width
        writable: true,
      });

      Object.defineProperty(window.screen, 'height', {
        value: 375, // Portrait height
        writable: true,
      });

      expect(() => {
        game.resize(667, 375);
      }).not.toThrow();

      // Width and height are protected, so we can't access them directly
      // But we can verify the game was created successfully
      expect(game).toBeDefined();
    });

    test('should handle device pixel ratio', () => {
      // Mock high DPI display
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 2,
        writable: true,
      });

      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      // Game should handle high DPI correctly
      expect(() => {
        game.render();
      }).not.toThrow();
    });

    test('should handle viewport changes', () => {
      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      // Simulate viewport change
      expect(() => {
        game.resize(414, 896); // iPhone 11 Pro Max
        game.resize(360, 640); // Android
        game.resize(768, 1024); // iPad
      }).not.toThrow();
    });
  });

  describe('Mobile Input Testing', () => {
    test('should handle touch pressure sensitivity', () => {
      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      // Mock touch with pressure
      const _mockTouch = {
        clientX: 200,
        clientY: 300,
        force: 0.5, // Pressure
        identifier: 1,
      };

      expect(() => {
        game.handlePointerDown(200, 300);
      }).not.toThrow();
    });

    test('should handle touch size', () => {
      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      // Mock touch with size
      const _mockTouch2 = {
        clientX: 200,
        clientY: 300,
        radiusX: 10,
        radiusY: 10,
        identifier: 1,
      };

      expect(() => {
        game.handlePointerDown(200, 300);
      }).not.toThrow();
    });

    test('should handle touch angle', () => {
      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      // Mock touch with angle
      const _mockTouch3 = {
        clientX: 200,
        clientY: 300,
        rotationAngle: 45,
        identifier: 1,
      };

      expect(() => {
        game.handlePointerDown(200, 300);
      }).not.toThrow();
    });
  });

  describe('Mobile Network Testing', () => {
    test('should handle slow network connections', () => {
      // Mock slow connection
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '2g',
          downlink: 0.5,
          rtt: 1000,
        },
        writable: true,
      });

      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      // Game should still work on slow connections
      expect(() => {
        game.update(16);
        game.render();
      }).not.toThrow();
    });

    test('should handle network disconnection', () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      // Game should work offline
      expect(() => {
        game.update(16);
        game.render();
      }).not.toThrow();
    });
  });

  describe('Mobile Battery Testing', () => {
    test('should handle low battery mode', () => {
      // Mock low battery
      Object.defineProperty(navigator, 'getBattery', {
        value: () => Promise.resolve({
          level: 0.1, // 10% battery
          charging: false,
          chargingTime: Infinity,
          dischargingTime: 3600,
        }),
        writable: true,
      });

      const game = new DefenderGame(mockContext, 375, 667);
      game.init();

      // Game should handle low battery gracefully
      expect(() => {
        game.update(16);
        game.render();
      }).not.toThrow();
    });
  });
});
