/**
 * Unit tests for DefenderGame
 * Tests game mechanics, collision detection, and mobile controls
 */

import { DefenderGame } from '../DefenderGame';
import { 
  createMockPlayer,
  createMockEnemy,
  createMockProjectile,
  createMockAudioState,
  createMockSettings,
  createMockParticleSystem,
  createMockVisualFeedback,
  createMockCanvasContext,
  createMockKeyboardEvent,
  createMockTouchEvent,
  isColliding,
  waitForFrames,
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

describe('DefenderGame', () => {
  let game: DefenderGame;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    // Create mock canvas and context
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;
    
    mockContext = createMockCanvasContext() as CanvasRenderingContext2D;
    jest.spyOn(mockCanvas, 'getContext').mockReturnValue(mockContext);

    // Create game instance
    game = new DefenderGame(mockCanvas);
    game.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Game Initialization', () => {
    test('should initialize with correct player state', () => {
      expect(game['player']).toBeDefined();
      expect(game['player'].health).toBe(100);
      expect(game['player'].maxHealth).toBe(100);
      expect(game['player'].alive).toBe(true);
    });

    test('should initialize with empty enemy and bullet arrays', () => {
      expect(game['enemies']).toEqual([]);
      expect(game['playerBullets']).toEqual([]);
      expect(game['enemyBullets']).toEqual([]);
    });

    test('should initialize with correct game state', () => {
      expect(game['wave']).toBe(1);
      expect(game['score']).toBe(0);
      expect(game['civiliansRescued']).toBe(0);
    });
  });

  describe('Player Movement', () => {
    test('should move player left with A key', () => {
      const initialX = game['player'].position.x;
      game['keys'].add('KeyA');
      
      game.update(16);
      
      expect(game['player'].position.x).toBeLessThan(initialX);
    });

    test('should move player right with D key', () => {
      const initialX = game['player'].position.x;
      game['keys'].add('KeyD');
      
      game.update(16);
      
      expect(game['player'].position.x).toBeGreaterThan(initialX);
    });

    test('should move player up with W key', () => {
      const initialY = game['player'].position.y;
      game['keys'].add('KeyW');
      
      game.update(16);
      
      expect(game['player'].position.y).toBeLessThan(initialY);
    });

    test('should move player down with S key', () => {
      const initialY = game['player'].position.y;
      game['keys'].add('KeyS');
      
      game.update(16);
      
      expect(game['player'].position.y).toBeGreaterThan(initialY);
    });

    test('should respect screen boundaries', () => {
      game['player'].position.x = 0;
      game['keys'].add('KeyA');
      
      game.update(16);
      
      expect(game['player'].position.x).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Shooting Mechanics', () => {
    test('should shoot horizontal bullet with Space key', () => {
      const initialBulletCount = game['playerBullets'].length;
      
      game['keys'].add('Space');
      game.update(16);
      
      expect(game['playerBullets'].length).toBeGreaterThan(initialBulletCount);
    });

    test('should shoot vertical bullet with X key', () => {
      const initialBulletCount = game['playerBullets'].length;
      
      game['keys'].add('KeyX');
      game.update(16);
      
      expect(game['playerBullets'].length).toBeGreaterThan(initialBulletCount);
    });

    test('should respect shooting cooldown', () => {
      game['keys'].add('Space');
      game.update(16);
      
      const bulletCountAfterFirst = game['playerBullets'].length;
      
      game.update(16); // Should not shoot again immediately
      
      expect(game['playerBullets'].length).toBe(bulletCountAfterFirst);
    });

    test('should create bullets with correct properties', () => {
      game['keys'].add('Space');
      game.update(16);
      
      const bullet = game['playerBullets'][0];
      expect(bullet.owner).toBe('player');
      expect(bullet.damage).toBe(25);
      expect(bullet.alive).toBe(true);
    });
  });

  describe('Mobile Touch Controls', () => {
    test('should handle touch shooting', () => {
      const initialBulletCount = game['playerBullets'].length;
      
      game.handlePointerDown(400, 300); // Center of screen
      
      expect(game['playerBullets'].length).toBeGreaterThan(initialBulletCount);
    });

    test('should handle left side touch for movement', () => {
      const initialX = game['player'].position.x;
      
      game.handlePointerDown(100, 300); // Left side
      
      expect(game['keys'].has('ArrowLeft')).toBe(true);
      expect(game['keys'].has('KeyA')).toBe(true);
    });

    test('should handle right side touch for movement', () => {
      const initialX = game['player'].position.x;
      
      game.handlePointerDown(700, 300); // Right side
      
      expect(game['keys'].has('ArrowRight')).toBe(true);
      expect(game['keys'].has('KeyD')).toBe(true);
    });

    test('should clear movement keys on touch up', () => {
      game.handlePointerDown(100, 300);
      expect(game['keys'].has('ArrowLeft')).toBe(true);
      
      game.handlePointerUp();
      
      expect(game['keys'].has('ArrowLeft')).toBe(false);
      expect(game['keys'].has('KeyA')).toBe(false);
    });
  });

  describe('Enemy Management', () => {
    test('should spawn enemies in waves', () => {
      const initialEnemyCount = game['enemies'].length;
      
      game['spawnWave']();
      
      expect(game['enemies'].length).toBeGreaterThan(initialEnemyCount);
    });

    test('should create enemies with correct properties', () => {
      game['spawnWave']();
      
      const enemy = game['enemies'][0];
      expect(enemy.alive).toBe(true);
      expect(enemy.health).toBeGreaterThan(0);
      expect(enemy.type).toMatch(/invader|bomber/);
    });

    test('should increase difficulty with each wave', () => {
      const wave1Enemies = game['enemies'].length;
      game['wave'] = 2;
      game['spawnWave']();
      
      const wave2Enemies = game['enemies'].length;
      expect(wave2Enemies).toBeGreaterThan(wave1Enemies);
    });
  });

  describe('Collision Detection', () => {
    test('should detect player bullet hitting enemy', () => {
      const enemy = createMockEnemy({ position: { x: 200, y: 200 } });
      const bullet = createMockProjectile({ 
        position: { x: 200, y: 200 },
        owner: 'player'
      });
      
      game['enemies'] = [enemy];
      game['playerBullets'] = [bullet];
      
      const initialHealth = enemy.health;
      game['checkCollisions']();
      
      expect(enemy.health).toBeLessThan(initialHealth);
      expect(bullet.alive).toBe(false);
    });

    test('should detect enemy bullet hitting player', () => {
      const bullet = createMockProjectile({ 
        position: { x: 100, y: 100 },
        owner: 'enemy'
      });
      
      game['player'].position = { x: 100, y: 100 };
      game['enemyBullets'] = [bullet];
      
      const initialHealth = game['player'].health;
      game['checkCollisions']();
      
      expect(game['player'].health).toBeLessThan(initialHealth);
      expect(bullet.alive).toBe(false);
    });

    test('should handle shield collision', () => {
      game['player'].shielded = true;
      const bullet = createMockProjectile({ 
        position: { x: 100, y: 100 },
        owner: 'enemy'
      });
      
      game['player'].position = { x: 100, y: 100 };
      game['enemyBullets'] = [bullet];
      
      game['checkCollisions']();
      
      expect(game['player'].shielded).toBe(false);
      expect(bullet.alive).toBe(false);
    });
  });

  describe('Kamikaze System', () => {
    test('should create kamikaze bombers', () => {
      game['spawnWave']();
      const initialEnemies = game['enemies'].length;
      
      game['createKamikazeBomber']();
      
      const kamikazeCount = game['enemies'].filter(e => e.kamikazeMode).length;
      expect(kamikazeCount).toBeGreaterThan(0);
    });

    test('should make kamikaze bombers target player', () => {
      game['spawnWave']();
      game['createKamikazeBomber']();
      
      const kamikaze = game['enemies'].find(e => e.kamikazeMode);
      expect(kamikaze).toBeDefined();
      
      if (kamikaze) {
        const initialDistance = Math.sqrt(
          Math.pow(kamikaze.position.x - game['player'].position.x, 2) +
          Math.pow(kamikaze.position.y - game['player'].position.y, 2)
        );
        
        game.update(16);
        
        const newDistance = Math.sqrt(
          Math.pow(kamikaze.position.x - game['player'].position.x, 2) +
          Math.pow(kamikaze.position.y - game['player'].position.y, 2)
        );
        
        expect(newDistance).toBeLessThan(initialDistance);
      }
    });
  });

  describe('Health System', () => {
    test('should reduce player health when hit', () => {
      const initialHealth = game['player'].health;
      const bullet = createMockProjectile({ 
        position: { x: 100, y: 100 },
        owner: 'enemy',
        damage: 20
      });
      
      game['player'].position = { x: 100, y: 100 };
      game['enemyBullets'] = [bullet];
      
      game['checkCollisions']();
      
      expect(game['player'].health).toBe(initialHealth - 20);
    });

    test('should trigger game over when player health reaches zero', () => {
      const onGameOver = jest.fn();
      game.onGameOver = onGameOver;
      
      game['player'].health = 0;
      game['checkCollisions']();
      
      expect(onGameOver).toHaveBeenCalled();
    });

    test('should reduce enemy health when hit', () => {
      const enemy = createMockEnemy({ health: 100 });
      const bullet = createMockProjectile({ 
        position: { x: 200, y: 200 },
        owner: 'player',
        damage: 25
      });
      
      game['enemies'] = [enemy];
      game['playerBullets'] = [bullet];
      
      game['checkCollisions']();
      
      expect(enemy.health).toBe(75);
    });
  });

  describe('Score System', () => {
    test('should award points for destroying enemies', () => {
      const enemy = createMockEnemy({ type: 'bomber' });
      const bullet = createMockProjectile({ 
        position: { x: 200, y: 200 },
        owner: 'player',
        damage: 200 // Enough to destroy enemy
      });
      
      game['enemies'] = [enemy];
      game['playerBullets'] = [bullet];
      
      const initialScore = game['score'];
      game['checkCollisions']();
      
      expect(game['score']).toBeGreaterThan(initialScore);
    });

    test('should prevent infinite score updates', () => {
      const onScoreUpdate = jest.fn();
      game.onScoreUpdate = onScoreUpdate;
      
      // Run multiple updates without score changes
      for (let i = 0; i < 10; i++) {
        game.update(16);
      }
      
      // Should only call onScoreUpdate when score actually changes
      expect(onScoreUpdate).toHaveBeenCalledTimes(0);
    });
  });

  describe('Performance', () => {
    test('should handle many enemies efficiently', async () => {
      // Spawn many enemies
      for (let i = 0; i < 50; i++) {
        game['spawnWave']();
      }
      
      const startTime = performance.now();
      await runGameLoop(game, 60);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should handle many bullets efficiently', async () => {
      // Create many bullets
      for (let i = 0; i < 100; i++) {
        game['playerBullets'].push(createMockProjectile({
          position: { x: Math.random() * 800, y: Math.random() * 600 }
        }));
      }
      
      const startTime = performance.now();
      await runGameLoop(game, 30);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });
  });

  describe('Integration', () => {
    test('should complete full game cycle', async () => {
      const onStageComplete = jest.fn();
      game.onStageComplete = onStageComplete;
      
      // Simulate playing through waves
      game['wave'] = 5;
      game['enemies'] = []; // Clear enemies to trigger wave completion
      
      await runGameLoop(game, 60);
      
      expect(onStageComplete).toHaveBeenCalled();
    });

    test('should handle rapid input changes', () => {
      const events = [
        { key: 'KeyA', type: 'keydown' },
        { key: 'Space', type: 'keydown' },
        { key: 'KeyA', type: 'keyup' },
        { key: 'KeyD', type: 'keydown' },
        { key: 'KeyX', type: 'keydown' },
        { key: 'KeyD', type: 'keyup' },
        { key: 'KeyX', type: 'keyup' },
        { key: 'Space', type: 'keyup' },
      ];
      
      events.forEach(({ key, type }) => {
        const event = createMockKeyboardEvent(key, type as 'keydown' | 'keyup');
        expect(() => game.handleInput(event)).not.toThrow();
      });
      
      game.update(16);
      expect(game['keys'].size).toBe(0);
    });
  });
});
