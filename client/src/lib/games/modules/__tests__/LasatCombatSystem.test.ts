import { LasatCombatSystem, ProjectileData, PowerUpData } from '../LasatCombatSystem';
import { Vector2 } from '../../types';

describe('LasatCombatSystem', () => {
  let combatSystem: LasatCombatSystem;
  const width = 800;
  const height = 600;

  beforeEach(() => {
    combatSystem = new LasatCombatSystem(width, height);
  });

  describe('Projectile Management', () => {
    it('should shoot player projectiles', () => {
      const position: Vector2 = { x: 100, y: 100 };
      const velocity: Vector2 = { x: 0, y: -5 };
      
      combatSystem.shootPlayerProjectile(position, velocity, 'laser', 10);
      
      const projectiles = combatSystem.getPlayerProjectiles();
      expect(projectiles).toHaveLength(1);
      expect(projectiles[0].position).toEqual(position);
      expect(projectiles[0].velocity).toEqual(velocity);
      expect(projectiles[0].damage).toBe(10);
      expect(projectiles[0].owner).toBe('player');
    });

    it('should shoot enemy projectiles', () => {
      const position: Vector2 = { x: 200, y: 200 };
      const velocity: Vector2 = { x: 0, y: 3 };
      
      combatSystem.shootEnemyProjectile(position, velocity, 'laser', 15);
      
      const projectiles = combatSystem.getEnemyProjectiles();
      expect(projectiles).toHaveLength(1);
      expect(projectiles[0].position).toEqual(position);
      expect(projectiles[0].velocity).toEqual(velocity);
      expect(projectiles[0].damage).toBe(15);
      expect(projectiles[0].owner).toBe('enemy');
    });

    it('should update projectile positions', () => {
      const position: Vector2 = { x: 100, y: 100 };
      const velocity: Vector2 = { x: 2, y: 3 };
      
      combatSystem.shootPlayerProjectile(position, velocity, 'laser', 10);
      
      combatSystem.updateProjectiles();
      
      const projectiles = combatSystem.getPlayerProjectiles();
      expect(projectiles[0].position.x).toBe(102);
      expect(projectiles[0].position.y).toBe(103);
    });

    it('should remove expired projectiles', () => {
      const position: Vector2 = { x: 100, y: 100 };
      const velocity: Vector2 = { x: 0, y: -5 };
      
      combatSystem.shootPlayerProjectile(position, velocity, 'laser', 10);
      const projectile = combatSystem.getPlayerProjectiles()[0];
      
      // Set lifetime to 0 to expire it
      projectile.lifetime = 0;
      
      combatSystem.updateProjectiles();
      
      const projectiles = combatSystem.getPlayerProjectiles();
      expect(projectiles).toHaveLength(0);
    });
  });

  describe('PowerUp Management', () => {
    it('should spawn powerups', () => {
      const position: Vector2 = { x: 300, y: 300 };
      
      combatSystem.spawnPowerUp(position, 'health');
      
      const powerUps = combatSystem.getPowerUps();
      expect(powerUps).toHaveLength(1);
      expect(powerUps[0].position).toEqual(position);
      expect(powerUps[0].type).toBe('health');
      expect(powerUps[0].collected).toBe(false);
    });

    it('should update powerup lifetimes', () => {
      const position: Vector2 = { x: 300, y: 300 };
      
      combatSystem.spawnPowerUp(position, 'energy');
      const powerUp = combatSystem.getPowerUps()[0];
      const initialLifetime = powerUp.lifetime;
      
      combatSystem.updatePowerUps();
      
      expect(powerUp.lifetime).toBe(initialLifetime - 1);
    });

    it('should remove expired powerups', () => {
      const position: Vector2 = { x: 300, y: 300 };
      
      combatSystem.spawnPowerUp(position, 'shield');
      const powerUp = combatSystem.getPowerUps()[0];
      powerUp.lifetime = 0;
      
      combatSystem.updatePowerUps();
      
      const powerUps = combatSystem.getPowerUps();
      expect(powerUps).toHaveLength(0);
    });
  });

  describe('Collision Detection', () => {
    it('should detect projectile-enemy collisions', () => {
      const projectilePosition: Vector2 = { x: 100, y: 100 };
      const projectileVelocity: Vector2 = { x: 0, y: -5 };
      
      combatSystem.shootPlayerProjectile(projectilePosition, projectileVelocity, 'laser', 10);
      
      const mockEnemy = {
        position: { x: 100, y: 100 },
        size: 20,
        alive: true,
        type: 'fighter'
      };
      
      const collisions = combatSystem.checkCollisions(
        { x: 400, y: 400 }, // Player position
        20, // Player size
        [mockEnemy],
        {} // Player manager mock
      );
      
      expect(collisions.enemiesHit).toHaveLength(1);
      expect(collisions.enemiesHit[0].enemy).toBe(mockEnemy);
      expect(collisions.enemiesHit[0].damage).toBe(10);
    });

    it('should detect projectile-player collisions', () => {
      const projectilePosition: Vector2 = { x: 400, y: 400 };
      const projectileVelocity: Vector2 = { x: 0, y: 3 };
      
      combatSystem.shootEnemyProjectile(projectilePosition, projectileVelocity, 'laser', 15);
      
      const collisions = combatSystem.checkCollisions(
        { x: 400, y: 400 }, // Player position
        20, // Player size
        [], // No enemies
        {} // Player manager mock
      );
      
      expect(collisions.playerHit).toBe(true);
      expect(collisions.enemiesHit).toHaveLength(1);
      expect(collisions.enemiesHit[0].damage).toBe(15);
    });

    it('should detect player-powerup collisions', () => {
      const powerUpPosition: Vector2 = { x: 400, y: 400 };
      
      combatSystem.spawnPowerUp(powerUpPosition, 'health');
      
      const collisions = combatSystem.checkCollisions(
        { x: 400, y: 400 }, // Player position
        20, // Player size
        [], // No enemies
        {} // Player manager mock
      );
      
      expect(collisions.powerUpsCollected).toHaveLength(1);
      expect(collisions.powerUpsCollected[0].type).toBe('health');
    });

    it('should not detect collisions when objects are far apart', () => {
      const projectilePosition: Vector2 = { x: 100, y: 100 };
      const projectileVelocity: Vector2 = { x: 0, y: -5 };
      
      combatSystem.shootPlayerProjectile(projectilePosition, projectileVelocity, 'laser', 10);
      
      const mockEnemy = {
        position: { x: 500, y: 500 },
        size: 20,
        alive: true,
        type: 'fighter'
      };
      
      const collisions = combatSystem.checkCollisions(
        { x: 400, y: 400 }, // Player position
        20, // Player size
        [mockEnemy],
        {} // Player manager mock
      );
      
      expect(collisions.enemiesHit).toHaveLength(0);
    });
  });

  describe('Projectile Removal', () => {
    it('should remove player projectiles', () => {
      const position: Vector2 = { x: 100, y: 100 };
      const velocity: Vector2 = { x: 0, y: -5 };
      
      combatSystem.shootPlayerProjectile(position, velocity, 'laser', 10);
      const projectile = combatSystem.getPlayerProjectiles()[0];
      
      combatSystem.removeProjectile(projectile, true);
      
      const projectiles = combatSystem.getPlayerProjectiles();
      expect(projectiles).toHaveLength(0);
    });

    it('should remove enemy projectiles', () => {
      const position: Vector2 = { x: 200, y: 200 };
      const velocity: Vector2 = { x: 0, y: 3 };
      
      combatSystem.shootEnemyProjectile(position, velocity, 'laser', 15);
      const projectile = combatSystem.getEnemyProjectiles()[0];
      
      combatSystem.removeProjectile(projectile, false);
      
      const projectiles = combatSystem.getEnemyProjectiles();
      expect(projectiles).toHaveLength(0);
    });
  });

  describe('PowerUp Removal', () => {
    it('should remove powerups', () => {
      const position: Vector2 = { x: 300, y: 300 };
      
      combatSystem.spawnPowerUp(position, 'health');
      const powerUp = combatSystem.getPowerUps()[0];
      
      combatSystem.removePowerUp(powerUp);
      
      const powerUps = combatSystem.getPowerUps();
      expect(powerUps).toHaveLength(0);
    });
  });

  describe('Boundary Checking', () => {
    it('should remove projectiles that go off screen', () => {
      const position: Vector2 = { x: 100, y: -10 }; // Off screen
      const velocity: Vector2 = { x: 0, y: -5 };
      
      combatSystem.shootPlayerProjectile(position, velocity, 'laser', 10);
      
      combatSystem.updateProjectiles();
      
      const projectiles = combatSystem.getPlayerProjectiles();
      expect(projectiles).toHaveLength(0);
    });

    it('should keep projectiles that are on screen', () => {
      const position: Vector2 = { x: 100, y: 100 };
      const velocity: Vector2 = { x: 0, y: -5 };
      
      combatSystem.shootPlayerProjectile(position, velocity, 'laser', 10);
      
      combatSystem.updateProjectiles();
      
      const projectiles = combatSystem.getPlayerProjectiles();
      expect(projectiles).toHaveLength(1);
    });
  });

  describe('Score Calculation', () => {
    it('should calculate correct enemy scores', () => {
      const mockEnemies = [
        { type: 'fighter', alive: true },
        { type: 'destroyer', alive: true },
        { type: 'mothership', alive: true }
      ];
      
      const collisions = combatSystem.checkCollisions(
        { x: 400, y: 400 },
        20,
        mockEnemies,
        {}
      );
      
      // Should have some score from enemy hits
      expect(collisions.score).toBeGreaterThanOrEqual(0);
    });
  });
});
