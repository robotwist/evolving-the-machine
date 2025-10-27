import { LasatPlayerManager, PlayerData } from '../LasatPlayerManager';
import { Vector2 } from '../../types';

describe('LasatPlayerManager', () => {
  let playerManager: LasatPlayerManager;
  const width = 800;
  const height = 600;

  beforeEach(() => {
    playerManager = new LasatPlayerManager(width, height);
  });

  describe('Initialization', () => {
    it('should initialize player with correct values', () => {
      const player = playerManager.getPlayer();
      
      expect(player.position.x).toBe(width / 2);
      expect(player.position.y).toBe(height - 100);
      expect(player.health).toBe(200);
      expect(player.maxHealth).toBe(200);
      expect(player.alive).toBe(true);
      expect(player.weaponType).toBe('laser');
      expect(player.weaponEnergy.laser).toBe(100);
      expect(player.weaponEnergy.ion).toBe(50);
    });
  });

  describe('Movement', () => {
    it('should handle keyboard input through updateKeys', () => {
      const keys = new Set(['ArrowLeft', 'ArrowUp']);
      playerManager.updateKeys(keys);
      
      playerManager.update(16); // 16ms delta time
      
      const player = playerManager.getPlayer();
      expect(player.velocity.x).toBeLessThan(0); // Moving left
      expect(player.velocity.y).toBeLessThan(0); // Moving up
    });

    it('should constrain player to screen bounds', () => {
      const player = playerManager.getPlayer();
      
      // Move player off screen
      player.position.x = -10;
      player.position.y = -10;
      
      playerManager.update(16);
      
      expect(player.position.x).toBeGreaterThanOrEqual(player.size);
      expect(player.position.y).toBeGreaterThanOrEqual(player.size);
      expect(player.position.x).toBeLessThanOrEqual(width - player.size);
      expect(player.position.y).toBeLessThanOrEqual(height - player.size);
    });
  });

  describe('Health Management', () => {
    it('should take damage', () => {
      const initialHealth = playerManager.getPlayer().health;
      const damageTaken = playerManager.takeDamage(50);
      
      expect(damageTaken).toBe(true);
      expect(playerManager.getPlayer().health).toBe(initialHealth - 50);
    });

    it('should die when health reaches 0', () => {
      playerManager.takeDamage(200);
      
      const player = playerManager.getPlayer();
      expect(player.health).toBe(0);
      expect(player.alive).toBe(false);
    });

    it('should heal player', () => {
      playerManager.takeDamage(100);
      playerManager.heal(50);
      
      const player = playerManager.getPlayer();
      expect(player.health).toBe(150);
    });

    it('should not heal beyond max health', () => {
      playerManager.takeDamage(50);
      playerManager.heal(100);
      
      const player = playerManager.getPlayer();
      expect(player.health).toBe(player.maxHealth);
    });
  });

  describe('Energy Management', () => {
    it('should add energy', () => {
      // First reduce energy below max
      const player = playerManager.getPlayer();
      player.energy = 75; // Set to 75
      
      playerManager.addEnergy(25);
      
      expect(playerManager.getPlayer().energy).toBe(100); // Should be capped at max
    });

    it('should not exceed max energy', () => {
      playerManager.addEnergy(200);
      
      const player = playerManager.getPlayer();
      expect(player.energy).toBe(player.maxEnergy);
    });
  });

  describe('Shield System', () => {
    it('should activate shield', () => {
      playerManager.activateShield();
      
      const player = playerManager.getPlayer();
      expect(player.shieldActive).toBe(true);
      expect(player.shieldTimer).toBeGreaterThan(0);
    });

    it('should deactivate shield when timer expires', () => {
      playerManager.activateShield();
      const player = playerManager.getPlayer();
      const shieldTimer = player.shieldTimer;
      
      // Simulate time passing
      for (let i = 0; i < shieldTimer + 1; i++) {
        playerManager.update(16);
      }
      
      expect(player.shieldActive).toBe(false);
    });

    it('should absorb damage when shield is active', () => {
      playerManager.activateShield();
      const initialHealth = playerManager.getPlayer().health;
      
      const damageTaken = playerManager.takeDamage(50);
      
      expect(damageTaken).toBe(false); // Shield absorbed damage
      expect(playerManager.getPlayer().health).toBe(initialHealth);
      expect(playerManager.getPlayer().shieldActive).toBe(false); // Shield consumed
    });
  });

  describe('Targeting System', () => {
    it('should set and get target', () => {
      const mockTarget = { position: { x: 100, y: 100 }, size: 20 };
      playerManager.setTargetLocked(mockTarget);
      
      expect(playerManager.getTargetLocked()).toBe(mockTarget);
    });

    it('should handle targeting input', () => {
      const keys = new Set(['KeyT']);
      playerManager.updateKeys(keys);
      
      playerManager.update(16);
      
      const player = playerManager.getPlayer();
      expect(player.targetingLock).toBe(true);
    });
  });

  describe('Death Blossom', () => {
    it('should track death blossom readiness', () => {
      expect(playerManager.isDeathBlossomReady()).toBe(true);
    });

    it('should track death blossom cooldown', () => {
      const cooldown = playerManager.getDeathBlossomCooldown();
      expect(cooldown).toBe(0);
    });
  });

  describe('Update Loop', () => {
    it('should update player state', () => {
      const keys = new Set(['ArrowLeft']);
      playerManager.updateKeys(keys);
      const initialX = playerManager.getPlayer().position.x;
      
      playerManager.update(16);
      
      const player = playerManager.getPlayer();
      expect(player.position.x).toBeLessThan(initialX);
    });

    it('should handle multiple updates', () => {
      const keys = new Set(['ArrowRight']);
      playerManager.updateKeys(keys);
      
      for (let i = 0; i < 10; i++) {
        playerManager.update(16);
      }
      
      const player = playerManager.getPlayer();
      expect(player.position.x).toBeGreaterThan(width / 2);
    });
  });

  describe('Getters', () => {
    it('should provide access to player data', () => {
      expect(playerManager.isAlive()).toBe(true);
      expect(playerManager.getHealth()).toBe(200);
      expect(playerManager.getMaxHealth()).toBe(200);
      expect(playerManager.getEnergy()).toBe(100);
      expect(playerManager.getMaxEnergy()).toBe(100);
      expect(playerManager.isShieldActive()).toBe(false);
      
      const weaponEnergy = playerManager.getWeaponEnergy();
      expect(weaponEnergy.laser).toBe(100);
      expect(weaponEnergy.ion).toBe(50);
    });
  });
});