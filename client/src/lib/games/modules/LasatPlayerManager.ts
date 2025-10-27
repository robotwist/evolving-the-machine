import { Vector2 } from '../types';

export interface PlayerData {
  position: Vector2;
  velocity: Vector2;
  size: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  energy: number;
  maxEnergy: number;
  weaponType: 'laser' | 'ion_cannon';
  shieldActive: boolean;
  shieldTimer: number;
  cockpitView: boolean;
  targetingLock: boolean;
  targetLocked: any | null; // Will be Enemy type from main game
  deathBlossomReady: boolean;
  deathBlossomCooldown: number;
  weaponEnergy: {
    laser: number;
    ion: number;
  };
}

export class LasatPlayerManager {
  private player: PlayerData;
  private keys: Set<string> = new Set();
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    // Initialize player with default values
    this.player = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      size: 20,
      health: 200,
      maxHealth: 200,
      alive: true,
      energy: 100,
      maxEnergy: 100,
      weaponType: 'laser',
      shieldActive: false,
      shieldTimer: 0,
      cockpitView: false,
      targetingLock: false,
      targetLocked: null,
      deathBlossomReady: false,
      deathBlossomCooldown: 0,
      weaponEnergy: {
        laser: 100,
        ion: 100
      }
    };
    this.initPlayer();
  }

  private initPlayer() {
    this.player = {
      position: { x: this.width / 2, y: this.height - 100 },
      velocity: { x: 0, y: 0 },
      size: 20,
      health: 200,
      maxHealth: 200,
      alive: true,
      energy: 100,
      maxEnergy: 100,
      weaponType: 'laser',
      shieldActive: false,
      shieldTimer: 0,
      cockpitView: true,
      targetingLock: false,
      targetLocked: null,
      deathBlossomReady: true,
      deathBlossomCooldown: 0,
      weaponEnergy: {
        laser: 100,
        ion: 50
      }
    };
  }

  getPlayer(): PlayerData {
    return this.player;
  }

  updateKeys(keys: Set<string>) {
    this.keys = keys;
  }

  update(deltaTime: number) {
    this.handleMovement();
    this.updatePlayer(deltaTime);
    this.updateTargeting();
    this.updateWeaponEnergy();
  }

  private handleMovement() {
    const speed = 4;
    
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      this.player.velocity.x = -speed;
    } else if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      this.player.velocity.x = speed;
    } else {
      this.player.velocity.x *= 0.8; // Friction
    }

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      this.player.velocity.y = -speed;
    } else if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      this.player.velocity.y = speed;
    } else {
      this.player.velocity.y *= 0.8; // Friction
    }

    // Ion Cannon (Q key)
    if (this.keys.has('KeyQ')) {
      this.shootIonCannon();
    }

    // Death Blossom (E key)
    if (this.keys.has('KeyE')) {
      this.activateDeathBlossom();
    }
  }

  private updatePlayer(deltaTime: number) {
    // Update position
    this.player.position.x += this.player.velocity.x;
    this.player.position.y += this.player.velocity.y;

    // Keep player in bounds
    this.player.position.x = Math.max(this.player.size, Math.min(this.width - this.player.size, this.player.position.x));
    this.player.position.y = Math.max(this.player.size, Math.min(this.height - this.player.size, this.player.position.y));

    // Update shield timer
    if (this.player.shieldTimer > 0) {
      this.player.shieldTimer--;
      if (this.player.shieldTimer <= 0) {
        this.player.shieldActive = false;
      }
    }

    // Update Death Blossom cooldown
    if (this.player.deathBlossomCooldown > 0) {
      this.player.deathBlossomCooldown--;
      if (this.player.deathBlossomCooldown <= 0) {
        this.player.deathBlossomReady = true;
      }
    }
  }

  private updateTargeting() {
    // Simple targeting logic - can be enhanced
    this.player.targetingLock = this.keys.has('KeyT');
  }

  private updateWeaponEnergy() {
    // Regenerate weapon energy slowly
    if (this.player.weaponEnergy.laser < 100) {
      this.player.weaponEnergy.laser = Math.min(100, this.player.weaponEnergy.laser + 0.5);
    }
    if (this.player.weaponEnergy.ion < 50) {
      this.player.weaponEnergy.ion = Math.min(50, this.player.weaponEnergy.ion + 0.2);
    }
  }

  private shootIonCannon() {
    if (this.player.weaponEnergy.ion >= 10) {
      this.player.weaponEnergy.ion -= 10;
      // Return projectile data for main game to handle
      return {
        position: { ...this.player.position },
        velocity: { x: 0, y: -8 },
        type: 'ion_cannon',
        damage: 25,
        owner: 'player'
      };
    }
    return null;
  }

  private activateDeathBlossom() {
    if (this.player.deathBlossomReady && this.player.energy >= 50) {
      this.player.energy -= 50;
      this.player.deathBlossomReady = false;
      this.player.deathBlossomCooldown = 300; // 5 seconds cooldown
      return true; // Signal to main game to activate Death Blossom
    }
    return false;
  }

  takeDamage(damage: number) {
    if (this.player.shieldActive) {
      this.player.shieldActive = false;
      this.player.shieldTimer = 0;
      return false; // Shield absorbed damage
    } else {
      this.player.health -= damage;
      if (this.player.health <= 0) {
        this.player.alive = false;
        this.player.health = 0;
      }
      return true; // Damage was taken
    }
  }

  heal(amount: number) {
    this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
  }

  addEnergy(amount: number) {
    this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + amount);
  }

  activateShield() {
    this.player.shieldActive = true;
    this.player.shieldTimer = 300; // 5 seconds
  }

  setTargetLocked(enemy: any) {
    this.player.targetLocked = enemy;
  }

  getTargetLocked() {
    return this.player.targetLocked;
  }

  isAlive(): boolean {
    return this.player.alive;
  }

  getHealth(): number {
    return this.player.health;
  }

  getMaxHealth(): number {
    return this.player.maxHealth;
  }

  getEnergy(): number {
    return this.player.energy;
  }

  getMaxEnergy(): number {
    return this.player.maxEnergy;
  }

  getWeaponEnergy() {
    return this.player.weaponEnergy;
  }

  isShieldActive(): boolean {
    return this.player.shieldActive;
  }

  isDeathBlossomReady(): boolean {
    return this.player.deathBlossomReady;
  }

  getDeathBlossomCooldown(): number {
    return this.player.deathBlossomCooldown;
  }
}
