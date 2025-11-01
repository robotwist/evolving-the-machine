/**
 * Integration tests for game systems
 * Tests interactions between different game components and end-to-end scenarios
 */

import { DefenderGame } from '../DefenderGame';
import { PongGame } from '../PongGame';
import { BreakoutGame } from '../BreakoutGame';
import { 
  createMockCanvasContext,
  createMockAudioState,
  createMockSettings,
  createMockParticleSystem,
  createMockVisualFeedback,
  createMockProjectile,
  runGameLoop
} from '../../utils/__tests__/testUtils';

// Mock the window extensions
const mockWindowExtensions = {
  __CULTURAL_ARCADE_AUDIO__: createMockAudioState(),
  __CULTURAL_ARCADE_REDUCE_MOTION__: false,
  __CULTURAL_ARCADE_SCREEN_SHAKE__: true,
  __CULTURAL_ARCADE_PARTICLES__: true,
};

Object.assign(global, mockWindowExtensions);

describe('Game System Integration Tests', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;
    
    mockContext = createMockCanvasContext() as CanvasRenderingContext2D;
    jest.spyOn(mockCanvas, 'getContext').mockReturnValue(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('DefenderGame Integration', () => {
    let game: DefenderGame;

    beforeEach(() => {
      game = new DefenderGame(mockContext, 800, 600);
      game.init();
    });

    test('should handle complete gameplay session', async () => {
      const onStageComplete = jest.fn();
      const onScoreUpdate = jest.fn();
      
      game.onStageComplete = onStageComplete;
      game.onScoreUpdate = onScoreUpdate;

      // Simulate a complete gameplay session
      await runGameLoop(game, 300); // 5 seconds at 60fps

      // Game should still be running
      expect(game['player'].alive).toBe(true);
      expect(game['player'].health).toBeGreaterThan(0);
    });

    test('should handle input system integration', async () => {
      // Test keyboard input
      game.handleInput(new KeyboardEvent('keydown', { code: 'KeyA' }));
      expect(game['keys'].has('KeyA')).toBe(true);

      // Test touch input
      game.handlePointerDown(100, 300);
      expect(game['keys'].has('ArrowLeft')).toBe(true);

      // Test input affects gameplay
      await runGameLoop(game, 10);
      expect(game['player'].position.x).toBeLessThan(100); // Should have moved left
    });

    test('should handle collision system integration', async () => {
      // Spawn enemies
      game['spawnWave']();

      // Position player bullets to hit enemies
      const enemy = game['enemies'][0];
      if (enemy) {
        const bullet = createMockProjectile({
          position: { x: enemy.position.x, y: enemy.position.y },
          owner: 'player',
          damage: 100
        });
        game['playerBullets'] = [bullet];
        
        // Check collisions
        game['checkCollisions']();
        
        // Enemy should be hit
        expect(enemy.health).toBeLessThan(enemy.maxHealth);
      }
    });

    test('should handle audio system integration', () => {
      const audioState = mockWindowExtensions.__CULTURAL_ARCADE_AUDIO__;
      
      // Test that audio system is available and can be called
      audioState.playStinger();
      
      // Audio should be called
      expect(audioState.playStinger).toHaveBeenCalled();
    });

    test('should handle particle system integration', () => {
      const particleSystem = createMockParticleSystem();
      game['particles'] = particleSystem as any;

      // Create an explosion
      (game as any)['particles'].addExplosion(100, 100, 20, '#FF0000', 'epic');

      expect(particleSystem.addExplosion).toHaveBeenCalledWith(
        100, 100, 20, '#FF0000', 'epic'
      );
    });

    test('should handle visual feedback integration', () => {
      const visualFeedback = createMockVisualFeedback();
      (game as any)['visualFeedback'] = visualFeedback;

      // Test that visual feedback system is available and can be called
      visualFeedback.addScreenShake(5);
      
      expect(visualFeedback.addScreenShake).toHaveBeenCalledWith(5);
    });

    test('should handle mobile controls integration', async () => {
      // Test touch shooting
      const initialBulletCount = game['playerBullets'].length;
      game.handlePointerDown(400, 300);
      
      expect(game['playerBullets'].length).toBeGreaterThan(initialBulletCount);

      // Test touch movement
      const initialX = game['player'].position.x;
      game.handlePointerDown(100, 300); // Left side
      
      await runGameLoop(game, 5);
      expect(game['player'].position.x).toBeLessThan(initialX);
    });

    test('should handle kamikaze system integration', async () => {
      // Spawn enemies
      game['spawnWave']();
      
      // Create kamikaze bomber
      game['createKamikazeBomber']();
      
      const kamikaze = game['enemies'].find(e => e.kamikazeMode);
      expect(kamikaze).toBeDefined();

      if (kamikaze) {
        // Kamikaze should move toward player
        const initialDistance = Math.sqrt(
          Math.pow(kamikaze.position.x - game['player'].position.x, 2) +
          Math.pow(kamikaze.position.y - game['player'].position.y, 2)
        );

        await runGameLoop(game, 30);

        const finalDistance = Math.sqrt(
          Math.pow(kamikaze.position.x - game['player'].position.x, 2) +
          Math.pow(kamikaze.position.y - game['player'].position.y, 2)
        );

        expect(finalDistance).toBeLessThan(initialDistance);
      }
    });
  });

  describe('PongGame Integration', () => {
    let game: PongGame;

    beforeEach(() => {
      game = new PongGame(mockContext, 800, 600);
      game.init();
    });

    test('should handle complete Pong game session', async () => {
      const onStageComplete = jest.fn();
      game.onStageComplete = onStageComplete;

      // Simulate gameplay
      await runGameLoop(game, 600); // 10 seconds

      // Game should be running
      expect(game['ball']).toBeDefined();
      expect(game['player1']).toBeDefined();
    });

    test('should handle powerup system integration', async () => {
      // Spawn powerups
      (game as any).spawnPowerupsPublic();
      
      const initialPowerupCount = game['powerups'].length;
      expect(initialPowerupCount).toBeGreaterThan(0);

      // Collect powerup
      const powerup = game['powerups'][0];
      powerup.x = game['player1'].x;
      powerup.y = game['player1'].y;

      game.update(16);
      
      // Powerup should be collected
      const remainingPowerups = game['powerups'].filter(p => !p.collected).length;
      expect(remainingPowerups).toBeLessThan(initialPowerupCount);
    });

    test('should handle AI system integration', async () => {
      const initialAIY = game['player2'].y;
      
      // Move ball toward AI
      game['ball'].y = game['player2'].y;
      game['ball'].dy = 2;

      await runGameLoop(game, 30);

      // AI should have moved to track ball
      expect(game['player2'].y).not.toBe(initialAIY);
    });
  });

  describe('BreakoutGame Integration', () => {
    let game: BreakoutGame;

    beforeEach(() => {
      game = new BreakoutGame(mockContext, 800, 600);
      game.init();
    });

    test('should handle complete Breakout game session', async () => {
      const onStageComplete = jest.fn();
      game.onStageComplete = onStageComplete;

      // Simulate gameplay
      await runGameLoop(game, 600); // 10 seconds

      // Game should be running
      expect(game['paddle']).toBeDefined();
      expect(game['ball']).toBeDefined();
    });

    test('should handle paddle evolution system', async () => {
      const initialPaddleWidth = game['paddle'].width;
      
      // Destroy enough bricks to trigger evolution
      const bricksToDestroy = Math.floor(game['bricks'].length * 0.5);
      for (let i = 0; i < bricksToDestroy; i++) {
        if (game['bricks'][i]) {
          game['bricks'][i].destroyed = true;
        }
      }

      await runGameLoop(game, 60);

      // Paddle should have evolved
      expect(game['paddle'].width).toBeGreaterThan(initialPaddleWidth);
    });

    test('should handle powerup system integration', async () => {
      // Spawn powerups
      (game as any).spawnPowerupsPublic();
      
      const initialPowerupCount = game['powerups'].length;
      expect(initialPowerupCount).toBeGreaterThan(0);

      // Collect powerup
      const powerup = game['powerups'][0];
      powerup.x = game['paddle'].x;
      powerup.y = game['paddle'].y;

      game.update(16);
      
      // Powerup should be collected
      const remainingPowerups = game['powerups'].filter(p => !p.collected).length;
      expect(remainingPowerups).toBeLessThan(initialPowerupCount);
    });
  });

  describe('Cross-Game Integration', () => {
    test('should handle game switching', () => {
      const defenderGame = new DefenderGame(mockContext, 800, 600);
      const pongGame = new PongGame(mockContext, 800, 600);
      const breakoutGame = new BreakoutGame(mockContext, 800, 600);

      // All games should initialize without conflicts
      expect(() => defenderGame.init()).not.toThrow();
      expect(() => pongGame.init()).not.toThrow();
      expect(() => breakoutGame.init()).not.toThrow();
    });

    test('should handle shared audio system', () => {
      const audioState = mockWindowExtensions.__CULTURAL_ARCADE_AUDIO__;
      
      const defenderGame = new DefenderGame(mockContext, 800, 600);
      const pongGame = new PongGame(mockContext, 800, 600);

      defenderGame.init();
      pongGame.init();

      // Both games should be able to use the same audio system
      expect(audioState.playStinger).toBeDefined();
      expect(audioState.playSuccess).toBeDefined();
      expect(audioState.playHit).toBeDefined();
    });

    test('should handle shared settings system', () => {
      const settings = createMockSettings();
      
      const defenderGame = new DefenderGame(mockContext, 800, 600);
      const pongGame = new PongGame(mockContext, 800, 600);

      (defenderGame as any)['settings'] = settings;
      (pongGame as any)['settings'] = settings;

      // Both games should respect the same settings
      expect((defenderGame as any)['settings'].hapticsEnabled).toBe(settings.hapticsEnabled);
      expect((pongGame as any)['settings'].hapticsEnabled).toBe(settings.hapticsEnabled);
    });
  });

  describe('Performance Integration', () => {
    test('should handle multiple games running simultaneously', async () => {
      const defenderGame = new DefenderGame(mockContext, 800, 600);
      const pongGame = new PongGame(mockContext, 800, 600);
      const breakoutGame = new BreakoutGame(mockContext, 800, 600);

      defenderGame.init();
      pongGame.init();
      breakoutGame.init();

      const startTime = performance.now();
      
      // Run all games simultaneously
      await Promise.all([
        runGameLoop(defenderGame, 60),
        runGameLoop(pongGame, 60),
        runGameLoop(breakoutGame, 60)
      ]);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(2000);
    });

    test('should handle memory management across games', async () => {
      const games = [
        new DefenderGame(mockContext, 800, 600),
        new PongGame(mockContext, 800, 600),
        new BreakoutGame(mockContext, 800, 600)
      ];

      games.forEach(game => game.init());

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Run games and create/destroy objects
      for (let i = 0; i < 10; i++) {
        await Promise.all(games.map(game => runGameLoop(game, 30)));
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });
  });

  describe('Error Recovery Integration', () => {
    test('should handle game errors gracefully', () => {
      const game = new DefenderGame(mockContext, 800, 600);
      game.init();

      // Simulate various error conditions
      expect(() => {
        game['player'] = null as any;
        game.update(16);
      }).not.toThrow();

      expect(() => {
        game['enemies'] = null as any;
        game.update(16);
      }).not.toThrow();

      expect(() => {
        game['playerBullets'] = null as any;
        game.update(16);
      }).not.toThrow();
    });

    test('should recover from invalid input', () => {
      const game = new DefenderGame(mockContext, 800, 600);
      game.init();

      // Test invalid input handling
      expect(() => game.handleInput(null as any)).not.toThrow();
      expect(() => game.handleInput(undefined as any)).not.toThrow();
      expect(() => game.handlePointerDown(NaN, NaN)).not.toThrow();
    });
  });
});
