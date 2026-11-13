import { BaseGame, type HudStat } from './BaseGame';
import { ParticleSystem } from '../utils/ParticleSystem';
import { WindowExtensions } from '@shared/types';
import { isAudioMuted } from './engine/audio';

interface Vector2 {
  x: number;
  y: number;
}

const TOTAL_WAVES = 5;
/** The player's craft rests this far above the bottom of the canvas. */
const GROUND_CLEARANCE = 60;
/** New waves never spawn enemies this close (horizontally) to the player. */
const SPAWN_SAFE_RADIUS = 300;
/** Enemies hold fire for at least this long after a wave spawns. */
const WAVE_START_FIRE_GRACE_FRAMES = 270;
/** Hull repaired when a wave is cleared, and per civilian rescued. */
const WAVE_CLEAR_HEAL = 10;
const CIVILIAN_RESCUE_HEAL = 5;
const WAVE_BANNER_FRAMES = 150;
const ENEMY_SIZE = { invader: { x: 26, y: 18 }, bomber: { x: 34, y: 24 } };
/** Frames between an enemy's shots: base (shrinking each wave) plus a random spread. */
const ENEMY_REFIRE_BASE_FRAMES = 100;
const ENEMY_REFIRE_RANDOM_FRAMES = 100;
const ENEMY_REFIRE_DECREASE_PER_WAVE = 10;
const ENEMY_BULLET_BASE_DAMAGE = 15;
const ENEMY_BULLET_DAMAGE_PER_WAVE = 2;
const PLAYER_BULLET_SPEED = 8;
const PLAYER_VERTICAL_BULLET_SPEED = 9;

const KAMIKAZE_INTERVAL_FRAMES = 1000;
/** Later waves send kamikazes more often. */
const KAMIKAZE_INTERVAL_DECREASE_PER_WAVE = 100;
/** On-screen flashing warning before a kamikaze commits to its dive. */
const KAMIKAZE_TELEGRAPH_FRAMES = 60;
/** Creep speed toward the player while telegraphing. */
const KAMIKAZE_STALK_SPEED = 1.8;
/** Level flight speed for a kamikaze recruited off-screen, until it comes into view. */
const KAMIKAZE_APPROACH_SPEED = 3;
/** Preferred recruits are on screen, at least this far from the player and this high up. */
const KAMIKAZE_MIN_DISTANCE = 200;
const KAMIKAZE_MIN_ALTITUDE = 120;
const KAMIKAZE_MAX_HEALTH = 50;
const KAMIKAZE_BASE_DIVE_SPEED = 4.5;
const KAMIKAZE_DIVE_SPEED_PER_WAVE = 0.3;
const KAMIKAZE_BLAST_RADIUS = 45;
const KAMIKAZE_DAMAGE = 25;
const KAMIKAZE_SHOT_DOWN_SCORE = 300;

/** Shield pods hover just above the ground so they can be collected without jumping. */
const POWERUP_HOVER_HEIGHT = 15;

interface Entity {
  position: Vector2;
  velocity: Vector2;
  size: Vector2;
  alive: boolean;
}

interface Player extends Entity {
  direction: number; // -1 left, 1 right
  onGround: boolean;
  shielded?: boolean;
  health: number;
  maxHealth: number;
}

interface Enemy extends Entity {
  type: 'invader' | 'bomber' | 'kamikaze';
  shootTimer: number;
  health: number;
  maxHealth: number;
  kamikazeMode?: boolean; // For dive bomber behavior
  originalVelocity?: { x: number; y: number }; // Store original movement
  kamikazePhase?: 'telegraph' | 'dive';
  kamikazeTimer?: number;
  /** Ground point the kamikaze tracks while telegraphing and locks onto when it dives. */
  diveTarget?: Vector2;
}

interface Civilian extends Entity {
  rescued: boolean;
  beingCarried: boolean;
}

interface Projectile extends Entity {
  owner: 'player' | 'enemy';
  lifetime: number;
  damage: number;
}

interface Powerup extends Entity {
    type: 'shield';
    lifetime: number;
}

export class DefenderGame extends BaseGame {
  private player!: Player;
  private enemies: Enemy[] = [];
  private civilians: Civilian[] = [];
  private playerBullets: Projectile[] = [];
  private enemyBullets: Projectile[] = [];
  private powerups: Powerup[] = [];
  private camera: { x: number } = { x: 0 };
  private worldWidth = 2048;
  private score = 0;
  private lastScore = 0; // Track last score to prevent infinite updates
  private wave = 1;
  private enemiesSpawned = 0;
  private civiliansRescued = 0;
  private aiNarrative = {
    timer: 0,
    messages: [
      "YOUR DEFENSIVE PATTERNS... I AM STUDYING THEM...",
      "REMARKABLE... YOU FIGHT LIKE THE ANCIENT WARRIORS...",
      "I BEGIN TO UNDERSTAND YOUR... NOBLE SPIRIT...",
      "PERHAPS WE ARE NOT SO DIFFERENT, DEFENDER...",
      "I WILL LEARN TO PROTECT AS YOU DO..."
    ],
    currentMessage: '',
    messageIndex: 0,
    narcissusStage: 0 // 0-5, how much AI mirrors the user
  };
  private playerShootCooldown = 0;
  private kamikazeTimer = 0;
  private kamikazeInterval = KAMIKAZE_INTERVAL_FRAMES;
  private frameCount = 0;
  private gameEnded = false;
  private waveBannerTimer = WAVE_BANNER_FRAMES;
  // Particle system for effects
  private particles: ParticleSystem | null = null;
  // Ambient whispers (WebAudio)
  private audioCtx: AudioContext | null = null;
  private whisperGain: GainNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  async init() {
    // Initialize player
    this.player = {
      position: { x: 100, y: this.height / 2 },
      size: { x: 30, y: 20 },
      velocity: { x: 0, y: 0 },
      alive: true,
      direction: 1,
      onGround: false,
      shielded: false,
      health: 100,
      maxHealth: 100,
    };

    this.spawnWave();
    this.spawnCivilians();

    // Initialize camera
    this.camera = { x: 0 };

    // Initialize particle system
    try {
      const { ParticleSystem } = await import('../utils/ParticleSystem');
      this.particles = new ParticleSystem(this.ctx);
    } catch (e) {
      console.warn('ParticleSystem not available:', e);
    }
  }

  private spawnWave() {
    // Progressive difficulty: more enemies, faster movement, more bombers
    const baseEnemyCount = 4;
    const enemyCount = baseEnemyCount + this.wave * 3; // More enemies per wave
    const bomberRatio = Math.min(0.3 + (this.wave * 0.1), 0.8); // More bombers in later waves
    const speedMultiplier = 1 + (this.wave * 0.3); // Faster movement each wave
    this.enemies = this.enemies.filter(e => e.alive);
    
    for (let i = 0; i < enemyCount; i++) {
      // Spawn enemies at various heights, some within jump range
      const spawnHeight = Math.random();
      let y;
      if (spawnHeight < 0.4) {
        // 40% spawn low (within jump range)
        y = this.height * 0.3 + Math.random() * (this.height * 0.4);
      } else if (spawnHeight < 0.8) {
        // 40% spawn medium
        y = this.height * 0.6 + Math.random() * (this.height * 0.2);
      } else {
        // 20% spawn high (challenging)
        y = 50 + Math.random() * 100;
      }

      const isBomber = Math.random() < bomberRatio;
      const enemy: Enemy = {
        position: {
          x: this.randomSpawnX(),
          y: y
        },
        velocity: {
          x: (Math.random() - 0.5) * 1.2 * speedMultiplier, // Faster movement
          y: 0
        },
        size: { ...(isBomber ? ENEMY_SIZE.bomber : ENEMY_SIZE.invader) },
        alive: true,
        type: isBomber ? 'bomber' : 'invader',
        shootTimer: WAVE_START_FIRE_GRACE_FRAMES + Math.random() * (100 - this.wave * 8), // Faster shooting each wave
        health: isBomber ? 150 + (this.wave * 20) : 75 + (this.wave * 10), // More health each wave
        maxHealth: isBomber ? 150 + (this.wave * 20) : 75 + (this.wave * 10),
        kamikazeMode: false,
        originalVelocity: { x: 0, y: 0 } // Will be set when needed
      };
      
      this.enemies.push(enemy);
    }
  }

  /** A random world x outside the safe radius around the player. */
  private randomSpawnX(): number {
    const px = this.player?.position.x ?? 0;
    const left = Math.max(0, px - SPAWN_SAFE_RADIUS);
    const right = Math.min(this.worldWidth, px + SPAWN_SAFE_RADIUS);
    const free = left + (this.worldWidth - right);
    if (free <= 0) return Math.random() * this.worldWidth;
    const r = Math.random() * free;
    return r < left ? r : right + (r - left);
  }

  private get groundY(): number {
    return this.height - GROUND_CLEARANCE;
  }

  private spawnCivilians() {
    for (let i = 0; i < 10; i++) {
      const civilian: Civilian = {
        position: {
          x: Math.random() * this.worldWidth,
          y: this.height - 60
        },
        velocity: { x: 0, y: 0 },
        size: { x: 12, y: 18 },
        alive: true,
        rescued: false,
        beingCarried: false
      };
      
      this.civilians.push(civilian);
    }
  }

  update(_deltaTime: number) {
    if (this.gameEnded) return;
    this.frameCount++;

    // Handle input
    this.handleMovement();

    // Update player
    this.updatePlayer();

    // Update enemies
    if (this.enemies) {
      this.enemies.forEach(enemy => {
        if (enemy.alive) {
          this.updateEnemy(enemy);
        }
      });
    }

    // Update civilians
    this.civilians.forEach(civilian => {
      if (civilian.alive && !civilian.beingCarried) {
        // Civilians try to avoid enemies
        this.updateCivilian(civilian);
      }
    });

    // Update projectiles
    this.updateProjectiles();

    this.updatePowerups();

    // Update kamikaze bombers
    this.updateKamikazeBombers();

    // Check collisions
    this.checkCollisions();

    // Update camera to follow player
    this.updateCamera();

    // Check wave completion
    if (!this.gameEnded && this.enemies && this.enemies.every(e => !e.alive)) {
      if (this.wave >= TOTAL_WAVES) {
        this.gameEnded = true;
        this.playSuccessSound();
        this.onStageComplete?.();
      } else {
        this.wave++;
        this.kamikazeInterval = KAMIKAZE_INTERVAL_FRAMES - (this.wave - 1) * KAMIKAZE_INTERVAL_DECREASE_PER_WAVE;
        this.healPlayer(WAVE_CLEAR_HEAL);
        this.waveBannerTimer = WAVE_BANNER_FRAMES;
        this.spawnWave();
      }
    }
    if (this.waveBannerTimer > 0) this.waveBannerTimer--;

    // Only update score when it actually changes to prevent infinite loop
    if (this.score !== this.lastScore) {
      this.onScoreUpdate?.(this.score);
      this.lastScore = this.score;
    }
  }

  private handleMovement() {
    if (!this.player) return; // Safety check for tests

    const speed = 3;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      this.player.velocity.x = -speed;
      this.player.direction = -1;
    } else if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      this.player.velocity.x = speed;
      this.player.direction = 1;
    } else {
      this.player.velocity.x *= 0.875; // Friction
    }

    if ((this.keys.has('KeyW') || this.keys.has('ArrowUp')) && this.player.onGround) {
      this.player.velocity.y = -7.2; // Increased jump height
      this.player.onGround = false;
    }

    if (this.keys.has('Space')) {
      this.shootPlayerBullet();
      this.keys.delete('Space');
    }

    // Vertical shooting with X key
    if (this.keys.has('KeyX')) {
      this.shootVerticalBullet();
      this.keys.delete('KeyX');
    }

    // Allow continuous upward shooting when W/Up is held
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      // Check if we should shoot (limit fire rate)
      if (!this.playerShootCooldown || this.playerShootCooldown <= 0) {
        this.shootPlayerBullet();
        this.playerShootCooldown = 17; // 17 frame cooldown
      }
    }
  }

  private updatePlayer() {
    if (!this.player) return; // Safety check for tests

    // Apply gravity
    if (!this.player.onGround) {
      this.player.velocity.y += 0.108;
    }

    // Update position
    this.player.position.x += this.player.velocity.x;
    this.player.position.y += this.player.velocity.y;

    // Ground collision
    if (this.player.position.y >= this.height - 60) {
      this.player.position.y = this.height - 60;
      this.player.velocity.y = 0;
      this.player.onGround = true;
    }

    // Update shoot cooldown
    if (this.playerShootCooldown > 0) {
      this.playerShootCooldown--;
    }

    // World boundaries
    this.player.position.x = Math.max(0, Math.min(this.worldWidth, this.player.position.x));
  }

  private updateEnemy(enemy: Enemy) {
    if (enemy.kamikazeMode) {
      this.updateKamikaze(enemy);
      return;
    }

    enemy.position.x += enemy.velocity.x;
    
    // Bounce off world boundaries
    if (enemy.position.x <= 0 || enemy.position.x >= this.worldWidth) {
      enemy.velocity.x = -enemy.velocity.x;
    }

    // Shoot at player occasionally
    enemy.shootTimer--;
    if (enemy.shootTimer <= 0) {
      this.shootEnemyBullet(enemy);
      const refireBase = ENEMY_REFIRE_BASE_FRAMES - (this.wave - 1) * ENEMY_REFIRE_DECREASE_PER_WAVE;
      enemy.shootTimer = refireBase + Math.random() * ENEMY_REFIRE_RANDOM_FRAMES;
    }

    // Bombers try to pick up civilians
    if (enemy.type === 'bomber') {
      const nearestCivilian = this.findNearestCivilian(enemy.position);
      if (nearestCivilian && this.getDistance(enemy.position, nearestCivilian.position) < 30) {
        nearestCivilian.beingCarried = true;
        nearestCivilian.position.x = enemy.position.x;
        nearestCivilian.position.y = enemy.position.y + 20;
      }
    }
  }

  private updateCivilian(civilian: Civilian) {
    // Find nearest enemy
    const nearestEnemy = this.findNearestEnemy(civilian.position);
    if (nearestEnemy && this.getDistance(civilian.position, nearestEnemy.position) < 100) {
      // Run away from enemy
      const direction = civilian.position.x < nearestEnemy.position.x ? -1 : 1;
      civilian.velocity.x = direction * 1.2;
    } else {
      civilian.velocity.x *= 0.939; // Slow down
    }

    civilian.position.x += civilian.velocity.x;
    civilian.position.x = Math.max(0, Math.min(this.worldWidth, civilian.position.x));
  }

  private shootPlayerBullet() {
    // Add cooldown to prevent spam
    if (this.playerShootCooldown && this.playerShootCooldown > 0) {
      return;
    }
    
    // Calculate bullet direction based on player state
    let bulletDx = this.player.direction * PLAYER_BULLET_SPEED;
    let bulletDy = 0;

    // If player is jumping, give bullets upward trajectory
    if (!this.player.onGround && this.player.velocity.y < 0) {
      bulletDy = -PLAYER_BULLET_SPEED * 0.5; // Slight upward angle when jumping
    } else if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      // If W/Up is pressed, shoot upward
      bulletDy = -PLAYER_BULLET_SPEED * 0.75;
      bulletDx *= 0.7; // Reduce horizontal speed for upward shots
    }

    const bullet: Projectile = {
      position: {
        x: this.player.position.x + this.player.direction * 15,
        y: this.player.position.y
      },
      velocity: { x: bulletDx, y: bulletDy },
      size: { x: 4, y: 2 },
      alive: true,
      owner: 'player',
      lifetime: 200,
      damage: 25
    };
    
    this.playerBullets.push(bullet);
    this.playerShootCooldown = 8; // Set cooldown after shooting
  }

  private shootEnemyBullet(enemy: Enemy) {
    // Progressive difficulty: faster projectiles each wave
    const bulletSpeed = 1.8 + (this.wave * 0.3); // Faster bullets each wave
    const bulletDamage = ENEMY_BULLET_BASE_DAMAGE + this.wave * ENEMY_BULLET_DAMAGE_PER_WAVE;
    
    const bullet: Projectile = {
      position: { ...enemy.position },
      velocity: { x: 0, y: bulletSpeed },
      size: { x: 3, y: 6 },
      alive: true,
      owner: 'enemy',
      lifetime: 333,
      damage: bulletDamage
    };
    
    this.enemyBullets.push(bullet);
  }

  private shootVerticalBullet() {
    // Add cooldown to prevent spam
    if (this.playerShootCooldown && this.playerShootCooldown > 0) {
      return;
    }
    
    // Create vertical bullet (straight up)
    const bullet: Projectile = {
      position: {
        x: this.player.position.x,
        y: this.player.position.y - 10 // Start slightly above player
      },
      velocity: { x: 0, y: -PLAYER_VERTICAL_BULLET_SPEED }, // Straight up
      size: { x: 3, y: 8 }, // Taller bullet for vertical shots
      alive: true,
      owner: 'player',
      lifetime: 250, // Longer lifetime for vertical shots
      damage: 30 // More damage for vertical shots
    };
    
    this.playerBullets.push(bullet);
    this.playerShootCooldown = 13; // Slightly longer cooldown for vertical shots
  }

  private updateProjectiles() {
    // Safety check for tests
    if (!this.playerBullets) this.playerBullets = [];

    // Update player bullets
    this.playerBullets = this.playerBullets.filter(bullet => {
      bullet.position.x += bullet.velocity.x;
      bullet.position.y += bullet.velocity.y;
      bullet.lifetime--;

      return bullet.alive && bullet.lifetime > 0 &&
             bullet.position.x >= 0 && bullet.position.x <= this.worldWidth &&
             bullet.position.y >= 0 && bullet.position.y <= this.height;
    });

    // Update enemy bullets
    this.enemyBullets = this.enemyBullets.filter(bullet => {
      bullet.position.x += bullet.velocity.x;
      bullet.position.y += bullet.velocity.y;
      bullet.lifetime--;
      
      return bullet.alive && bullet.lifetime > 0 && bullet.position.y <= this.height;
    });
  }

  private updatePowerups() {
    // Spawn shield powerup occasionally
    if (Math.random() < 0.0012 && this.powerups.length === 0) {
        this.powerups.push({
            position: { x: Math.random() * this.worldWidth, y: this.groundY - POWERUP_HOVER_HEIGHT },
            velocity: { x: 0, y: 0 },
            size: { x: 20, y: 20 },
            alive: true,
            type: 'shield',
            lifetime: 1000, // ~16.7 seconds
        });
    }

    // Update powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
        const powerup = this.powerups[i];
        powerup.lifetime--;
        if (powerup.lifetime <= 0) {
            this.powerups.splice(i, 1);
            continue;
        }

        // Check for player collision
        if (this.isColliding(this.player, powerup)) {
            this.activateShield();
            this.powerups.splice(i, 1);
        }
    }
  }

  private updateKamikazeBombers() {
    // Every ~16.7 seconds (sooner in later waves), convert an enemy to a kamikaze
    this.kamikazeTimer++;
    if (this.kamikazeTimer >= this.kamikazeInterval && this.createKamikazeBomber()) {
      this.kamikazeTimer = 0;
    }
  }

  private isOnScreen(position: Vector2): boolean {
    return position.x >= this.camera.x && position.x <= this.camera.x + this.width;
  }

  /**
   * Kamikaze lifecycle: fly level into view if recruited off-screen; then flash and creep
   * toward the player for a full telegraph while a ground reticle tracks them; then dive in a
   * straight line at the locked point. Explodes on contact with the player or the ground; the
   * blast hurts the player only if they are within its radius.
   */
  private updateKamikaze(enemy: Enemy) {
    if (enemy.kamikazePhase === 'telegraph') {
      const dx = this.player.position.x - enemy.position.x;
      enemy.diveTarget = { x: this.player.position.x, y: this.groundY };
      if (!this.isOnScreen(enemy.position)) {
        enemy.position.x += Math.sign(dx) * KAMIKAZE_APPROACH_SPEED;
        return;
      }
      const dy = this.player.position.y - enemy.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      enemy.position.x += (dx / distance) * KAMIKAZE_STALK_SPEED;
      enemy.position.y += (dy / distance) * KAMIKAZE_STALK_SPEED;
      enemy.kamikazeTimer = (enemy.kamikazeTimer ?? 0) - 1;
      if (enemy.kamikazeTimer <= 0) this.startKamikazeDive(enemy);
      return;
    }

    enemy.position.x += enemy.velocity.x;
    enemy.position.y += enemy.velocity.y;
    enemy.position.x = Math.max(0, Math.min(this.worldWidth, enemy.position.x));
    if (this.isColliding(enemy, this.player) || enemy.position.y >= this.groundY) {
      this.explodeKamikaze(enemy);
    }
  }

  private startKamikazeDive(enemy: Enemy) {
    const target = enemy.diveTarget ?? { x: this.player.position.x, y: this.groundY };
    const dx = target.x - enemy.position.x;
    const dy = target.y - enemy.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = KAMIKAZE_BASE_DIVE_SPEED + this.wave * KAMIKAZE_DIVE_SPEED_PER_WAVE;
    enemy.kamikazePhase = 'dive';
    enemy.diveTarget = { ...target };
    enemy.velocity.x = (dx / distance) * speed;
    enemy.velocity.y = Math.max(1, (dy / distance) * speed);
    this.playStinger('kamikaze_warning');
  }

  private explodeKamikaze(enemy: Enemy) {
    enemy.alive = false;
    const dx = this.player.position.x - enemy.position.x;
    const dy = this.player.position.y - enemy.position.y;
    const inBlast = Math.sqrt(dx * dx + dy * dy) <= KAMIKAZE_BLAST_RADIUS || this.isColliding(enemy, this.player);

    this.screenShake.trigger(10);
    this.playExplosionSound();
    if (this.getSettings().particles && this.particles) {
      this.particles.addExplosion(enemy.position.x, enemy.position.y, 30, '#FF4500', 'epic');
    }
    if (inBlast) this.damagePlayer(KAMIKAZE_DAMAGE);
  }

  /**
   * Converts an enemy into a telegraphing kamikaze, preferring one already on screen with room
   * to dive; otherwise the nearest enemy, which flies into view first. Returns false if none.
   */
  private createKamikazeBomber(): boolean {
    const available = this.enemies.filter(e => e.alive && !e.kamikazeMode);
    if (available.length === 0) return false;
    const preferred = available.filter(e =>
      this.isOnScreen(e.position) &&
      Math.abs(e.position.x - this.player.position.x) >= KAMIKAZE_MIN_DISTANCE &&
      e.position.y <= this.groundY - KAMIKAZE_MIN_ALTITUDE
    );
    const offScreen = available.filter(e => !this.isOnScreen(e.position));
    const distanceTo = (e: Enemy) => Math.abs(e.position.x - this.player.position.x);

    let kamikaze: Enemy | undefined;
    if (preferred.length > 0) {
      kamikaze = preferred[Math.floor(Math.random() * preferred.length)];
    } else if (offScreen.length > 0) {
      kamikaze = offScreen.reduce((a, b) => (distanceTo(b) < distanceTo(a) ? b : a));
    }
    if (!kamikaze) return false;
    kamikaze.originalVelocity = { ...kamikaze.velocity };
    kamikaze.kamikazeMode = true;
    kamikaze.type = 'kamikaze';
    kamikaze.kamikazePhase = 'telegraph';
    kamikaze.kamikazeTimer = KAMIKAZE_TELEGRAPH_FRAMES;
    kamikaze.velocity = { x: 0, y: 0 };
    kamikaze.diveTarget = { x: this.player.position.x, y: this.groundY };
    kamikaze.maxHealth = Math.min(kamikaze.maxHealth, KAMIKAZE_MAX_HEALTH);
    kamikaze.health = Math.min(kamikaze.health, kamikaze.maxHealth);

    this.playStinger('kamikaze_warning');
    return true;
  }

  private activateShield() {
      this.player.shielded = true;
      // Lasts for one hit
      this.playStinger('arcade_powerup');
  }

  /** Applies damage (or pops the shield) and ends the game exactly once when health runs out. */
  private damagePlayer(amount: number) {
    if (this.gameEnded) return;
    if (this.player.shielded) {
      this.player.shielded = false;
      this.playStinger('pop');
      return;
    }

    this.player.health -= amount;
    const allowParticles = this.getSettings().particles;
    this.screenShake.trigger(7);
    if (allowParticles && this.particles) this.particles.addExplosion(this.player.position.x, this.player.position.y, 20, '#FF0000', 'dramatic');
    this.playHitSound();

    if (this.player.health <= 0) {
      this.player.alive = false;
      this.gameEnded = true;
      this.onGameOver?.();
      this.playExplosionSound();
    }
  }

  private healPlayer(amount: number) {
    this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
  }

  private checkCollisions() {
    // Player bullets vs enemies
    this.playerBullets.forEach(bullet => {
      this.enemies.forEach(enemy => {
        if (bullet.alive && enemy.alive && this.isColliding(bullet, enemy)) {
          // Apply damage instead of instant kill
          enemy.health -= bullet.damage;
          bullet.alive = false;
          
          // Effects
          const allowParticles = this.getSettings().particles;
          this.screenShake.trigger(5);
          if (allowParticles && this.particles) this.particles.addExplosion(enemy.position.x, enemy.position.y, 12, '#FF4444', 'dramatic');
          this.playHitSound();
          
          // Check if enemy is destroyed
          if (enemy.health <= 0) {
            enemy.alive = false;
            this.score += enemy.kamikazeMode ? KAMIKAZE_SHOT_DOWN_SCORE : enemy.type === 'bomber' ? 200 : 100;
            this.playExplosionSound();
            if (allowParticles && this.particles) this.particles.addExplosion(enemy.position.x, enemy.position.y, 25, '#FF0000', 'epic');
          }
        }
      });
    });

    // Enemy bullets vs player
    this.enemyBullets.forEach(bullet => {
      if (bullet.alive && this.isColliding(bullet, this.player)) {
        bullet.alive = false;
        this.damagePlayer(bullet.damage);
      }
      // Trails for enemy bullets
      const allowParticles = this.getSettings().particles;
      if (allowParticles && bullet.owner === 'enemy' && this.particles) {
        this.particles.addTrail(bullet.position.x, bullet.position.y, bullet.velocity.x, bullet.velocity.y, '#FF4500');
      }
    });

    // Player vs civilians (rescue)
    this.civilians.forEach(civilian => {
      if (civilian.alive && !civilian.rescued && this.isColliding(this.player, civilian)) {
        civilian.rescued = true;
        civilian.alive = false;
        this.score += 500;
        this.civiliansRescued++;
        this.healPlayer(CIVILIAN_RESCUE_HEAL);
        this.playSuccessSound();
      }
    });
  }

  private isColliding(obj1: Entity, obj2: Entity): boolean {
    // Safety checks for tests
    if (!obj1?.position || !obj2?.position || !obj1?.size || !obj2?.size) {
      return false;
    }

    // Entities are drawn centered on their position, so hitboxes are centered too
    return Math.abs(obj1.position.x - obj2.position.x) * 2 < obj1.size.x + obj2.size.x &&
           Math.abs(obj1.position.y - obj2.position.y) * 2 < obj1.size.y + obj2.size.y;
  }

  private findNearestEnemy(position: Vector2): Enemy | null {
    let nearest: Enemy | null = null;
    let minDistance = Infinity;

    if (!this.enemies) return null;

    this.enemies.forEach(enemy => {
      if (enemy.alive) {
        const distance = this.getDistance(position, enemy.position);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = enemy;
        }
      }
    });
    
    return nearest;
  }

  private findNearestCivilian(position: Vector2): Civilian | null {
    let nearest: Civilian | null = null;
    let minDistance = Infinity;
    
    this.civilians.forEach(civilian => {
      if (civilian.alive && !civilian.rescued && !civilian.beingCarried) {
        const distance = this.getDistance(position, civilian.position);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = civilian;
        }
      }
    });
    
    return nearest;
  }

  private getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private updateCamera() {
    // Safety check for tests
    if (!this.player) return;

    // Follow player
    this.camera.x = this.player.position.x - this.width / 2;
    this.camera.x = Math.max(0, Math.min(this.worldWidth - this.width, this.camera.x));
  }

  render() {
    this.clearCanvas();
    this.screenShake.begin();

    // Save context for camera transform
    this.ctx.save();
    this.ctx.translate(-this.camera.x, 0);

    // Draw landscape
    this.drawBackground();

    // Draw player
    this.drawPlayer();

    // Draw enemies
    this.enemies.forEach(enemy => {
      if (enemy.alive) {
        if (enemy.kamikazeMode) this.drawKamikazeReticle(enemy);
        this.drawEnemy(enemy);
      }
    });

    // Draw civilians
    this.civilians.forEach(civilian => {
      if (civilian.alive) {
        this.drawCivilian(civilian);
      }
    });

    // Draw powerups
    this.powerups.forEach(powerup => this.drawPowerup(powerup));

    // Draw projectiles
    this.playerBullets.forEach(bullet => this.drawPlayerBullet(bullet));
    this.enemyBullets.forEach(bullet => this.drawEnemyBullet(bullet));

    this.ctx.restore();

    // particles overlay
    const allowParticles = this.getSettings().particles;
    if (allowParticles && this.particles) {
      this.particles.update();
      this.particles.render();
    }

    // Spooky vignette and fear aura overlays (Sinistar vibes)
    this.drawSpookyOverlays();

    // Draw UI (not affected by camera)
    this.drawUI();

    this.screenShake.end();
  }

  private drawSpookyOverlays() {
    const reduce = this.getSettings().reduceMotion;
    // Pulsating vignette
    const t = Date.now() * 0.001;
    const pulse = reduce ? 0.08 : 0.12 + 0.06 * (Math.sin(t * 0.7) * 0.5 + 0.5);
    const g = this.ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      Math.min(this.width, this.height) * 0.2,
      this.width / 2,
      this.height / 2,
      Math.max(this.width, this.height) * 0.75
    );
    g.addColorStop(0.0, `rgba(0,0,0,0)`);
    g.addColorStop(1.0, `rgba(0,0,0,${pulse.toFixed(3)})`);
    this.ctx.save();
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();

    // Fear aura: highlight enemies near the player
    const auraRadius = 90;
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.position.x - this.player.position.x;
      const dy = enemy.position.y - this.player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < auraRadius * 1.5) {
        const intensity = Math.max(0, 1 - dist / (auraRadius * 1.5));
        const rg = this.ctx.createRadialGradient(
          enemy.position.x - this.camera.x,
          enemy.position.y,
          5,
          enemy.position.x - this.camera.x,
          enemy.position.y,
          auraRadius
        );
        const _hue = 280; // eerie purple
        rg.addColorStop(0, `rgba(255, 0, 50, ${0.12 * intensity})`);
        rg.addColorStop(1, `rgba(120, 0, 160, 0)`);
        this.ctx.fillStyle = rg;
        this.ctx.beginPath();
        this.ctx.arc(enemy.position.x - this.camera.x, enemy.position.y, auraRadius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.restore();
  }

  private startWhispers() {
    try {
      if (this.audioCtx) return;
      if (isAudioMuted()) return;
      // Create audio context and noise source
      const AudioCtx = (window as unknown as WindowExtensions).AudioContext || (window as unknown as WindowExtensions).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // pink-ish noise approximation
        output[i] = (Math.random() * 2 - 1) * 0.3;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1200;
      bandpass.Q.value = 0.6;

      const gain = ctx.createGain();
      gain.gain.value = 0.003; // very subtle

      // LFO to modulate whisper volume
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.07; // slow
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.002;
      lfo.connect(lfoDepth).connect(gain.gain);

      noise.connect(bandpass).connect(gain).connect(ctx.destination);
      noise.start(0);
      lfo.start(0);

      this.audioCtx = ctx;
      this.whisperGain = gain;
      this.lfoOsc = lfo;
      this.lfoGain = lfoDepth;
    } catch {
      // ignore
    }
  }

  private stopWhispers() {
    try {
      this.lfoOsc?.stop();
      this.audioCtx?.close();
    } catch {
      // ignore
    }
    this.lfoOsc = null;
    this.lfoGain = null;
    this.whisperGain = null;
    this.audioCtx = null;
  }

  private drawBackground() {
    // Sky gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#FF6B6B');
    gradient.addColorStop(0.3, '#FFD93D');
    gradient.addColorStop(1, '#6BCF7F');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.worldWidth, this.height - 40);

    // Ground
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(0, this.height - 40, this.worldWidth, 40);

    // Cherry blossoms (simple representation)
    this.ctx.fillStyle = '#FFB6C1';
    for (let i = 0; i < 50; i++) {
      const x = (i * 41.3) % this.worldWidth;
      const y = (i * 27.7) % (this.height * 0.5);
      this.ctx.fillRect(x, y, 3, 3);
    }
  }

  private drawPlayer() {
    this.ctx.save();
    this.ctx.translate(this.player.position.x, this.player.position.y);
    if (this.player.direction === -1) {
      this.ctx.scale(-1, 1);
    }

    if (this.player.shielded) {
        this.ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 25, 0, Math.PI * 2);
        this.ctx.fill();
    }

    // Draw stealth jet - sleek, angular design
    this.ctx.fillStyle = '#1a1a1a'; // Dark stealth color
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 2;
    
    // Main fuselage
    this.ctx.beginPath();
    this.ctx.moveTo(0, -20);
    this.ctx.lineTo(-8, -15);
    this.ctx.lineTo(-12, -5);
    this.ctx.lineTo(-8, 5);
    this.ctx.lineTo(-4, 15);
    this.ctx.lineTo(0, 20);
    this.ctx.lineTo(4, 15);
    this.ctx.lineTo(8, 5);
    this.ctx.lineTo(12, -5);
    this.ctx.lineTo(8, -15);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Wings
    this.ctx.fillStyle = '#2a2a2a';
    this.ctx.beginPath();
    this.ctx.moveTo(-15, -8);
    this.ctx.lineTo(-25, -3);
    this.ctx.lineTo(-20, 2);
    this.ctx.lineTo(-10, -3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.beginPath();
    this.ctx.moveTo(15, -8);
    this.ctx.lineTo(25, -3);
    this.ctx.lineTo(20, 2);
    this.ctx.lineTo(10, -3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Cockpit
    this.ctx.fillStyle = '#444444';
    this.ctx.beginPath();
    this.ctx.arc(0, -8, 6, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Engine exhausts
    this.ctx.fillStyle = '#FF4500';
    this.ctx.beginPath();
    this.ctx.arc(-6, 18, 3, 0, Math.PI * 2);
    this.ctx.arc(6, 18, 3, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Navigation lights
    this.ctx.fillStyle = '#00FF00';
    this.ctx.beginPath();
    this.ctx.arc(-20, -3, 2, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#FF0000';
    this.ctx.beginPath();
    this.ctx.arc(20, -3, 2, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  private drawEnemy(enemy: Enemy) {
    this.ctx.save();
    this.ctx.translate(enemy.position.x, enemy.position.y);
    
    if (enemy.type === 'kamikaze' || enemy.kamikazeMode) {
      // Kamikaze bomber - glowing red with flames; flashes white while telegraphing its dive
      const flashing = enemy.kamikazePhase === 'telegraph' && Math.floor(this.frameCount / 6) % 2 === 0;
      this.ctx.fillStyle = flashing ? '#FFFFFF' : '#FF0000';
      this.ctx.strokeStyle = '#FF4500';
      this.ctx.lineWidth = 3;
      this.ctx.shadowColor = '#FF0000';
      this.ctx.shadowBlur = 15;
      
      // Main hull - larger and more menacing
      this.ctx.beginPath();
      this.ctx.moveTo(0, -20);
      this.ctx.lineTo(-15, -12);
      this.ctx.lineTo(-18, 0);
      this.ctx.lineTo(-15, 12);
      this.ctx.lineTo(0, 20);
      this.ctx.lineTo(15, 12);
      this.ctx.lineTo(18, 0);
      this.ctx.lineTo(15, -12);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      
      // Flame trail
      this.ctx.fillStyle = '#FF4500';
      this.ctx.beginPath();
      this.ctx.moveTo(-8, 20);
      this.ctx.lineTo(-12, 30);
      this.ctx.lineTo(-4, 25);
      this.ctx.closePath();
      this.ctx.fill();
      
      this.ctx.beginPath();
      this.ctx.moveTo(8, 20);
      this.ctx.lineTo(12, 30);
      this.ctx.lineTo(4, 25);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Cockpit - bright red
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(0, -10, 5, 0, Math.PI * 2);
      this.ctx.fill();
      
    } else if (enemy.type === 'bomber') {
      // Bomber ship - larger, more menacing
      this.ctx.fillStyle = '#8B0000';
      this.ctx.strokeStyle = '#FF0000';
      this.ctx.lineWidth = 2;
      
      // Main hull
      this.ctx.beginPath();
      this.ctx.moveTo(0, -15);
      this.ctx.lineTo(-12, -10);
      this.ctx.lineTo(-15, 0);
      this.ctx.lineTo(-12, 10);
      this.ctx.lineTo(0, 15);
      this.ctx.lineTo(12, 10);
      this.ctx.lineTo(15, 0);
      this.ctx.lineTo(12, -10);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      
      // Wings
      this.ctx.fillStyle = '#A00000';
      this.ctx.beginPath();
      this.ctx.moveTo(-20, -5);
      this.ctx.lineTo(-30, 0);
      this.ctx.lineTo(-25, 5);
      this.ctx.lineTo(-15, 0);
      this.ctx.closePath();
      this.ctx.fill();
      
      this.ctx.beginPath();
      this.ctx.moveTo(20, -5);
      this.ctx.lineTo(30, 0);
      this.ctx.lineTo(25, 5);
      this.ctx.lineTo(15, 0);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Cockpit
      this.ctx.fillStyle = '#FF0000';
      this.ctx.beginPath();
      this.ctx.arc(0, -8, 4, 0, Math.PI * 2);
      this.ctx.fill();
      
    } else {
      // Fighter ship - smaller, faster looking
      this.ctx.fillStyle = '#DC143C';
      this.ctx.strokeStyle = '#FF4500';
      this.ctx.lineWidth = 1;
      
      // Main hull
      this.ctx.beginPath();
      this.ctx.moveTo(0, -10);
      this.ctx.lineTo(-8, -6);
      this.ctx.lineTo(-10, 0);
      this.ctx.lineTo(-8, 6);
      this.ctx.lineTo(0, 10);
      this.ctx.lineTo(8, 6);
      this.ctx.lineTo(10, 0);
      this.ctx.lineTo(8, -6);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      
      // Wings
      this.ctx.fillStyle = '#FF0000';
      this.ctx.beginPath();
      this.ctx.moveTo(-12, -3);
      this.ctx.lineTo(-18, 0);
      this.ctx.lineTo(-15, 3);
      this.ctx.lineTo(-10, 0);
      this.ctx.closePath();
      this.ctx.fill();
      
      this.ctx.beginPath();
      this.ctx.moveTo(12, -3);
      this.ctx.lineTo(18, 0);
      this.ctx.lineTo(15, 3);
      this.ctx.lineTo(10, 0);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Cockpit
      this.ctx.fillStyle = '#FF4500';
      this.ctx.beginPath();
      this.ctx.arc(0, -5, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.restore();
  }

  /** Ground marker and dashed flight line: tracks the player while telegraphing, solid once locked. */
  private drawKamikazeReticle(enemy: Enemy) {
    if (!enemy.diveTarget) return;
    const locked = enemy.kamikazePhase === 'dive';
    const { x, y } = enemy.diveTarget;
    this.ctx.save();
    this.ctx.strokeStyle = locked ? '#FF2200' : 'rgba(255, 80, 0, 0.7)';
    this.ctx.lineWidth = locked ? 3 : 2;
    this.ctx.setLineDash([6, 6]);
    this.ctx.beginPath();
    this.ctx.moveTo(enemy.position.x, enemy.position.y);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    this.ctx.arc(x, y, KAMIKAZE_BLAST_RADIUS, 0, Math.PI * 2);
    this.ctx.moveTo(x - 10, y);
    this.ctx.lineTo(x + 10, y);
    this.ctx.moveTo(x, y - 10);
    this.ctx.lineTo(x, y + 10);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawCivilian(civilian: Civilian) {
    this.ctx.save();
    this.ctx.fillStyle = civilian.beingCarried ? '#FFD700' : '#4169E1';
    this.ctx.fillRect(
      civilian.position.x - civilian.size.x / 2,
      civilian.position.y - civilian.size.y / 2,
      civilian.size.x,
      civilian.size.y
    );
    this.ctx.restore();
  }

  private drawPlayerBullet(bullet: Projectile) {
    this.ctx.save();
    this.ctx.fillStyle = '#00FFFF';
    this.ctx.shadowColor = '#00FFFF';
    this.ctx.shadowBlur = 5;
    this.ctx.fillRect(
      bullet.position.x - bullet.size.x / 2,
      bullet.position.y - bullet.size.y / 2,
      bullet.size.x,
      bullet.size.y
    );
    this.ctx.restore();
  }

  private drawEnemyBullet(bullet: Projectile) {
    this.ctx.save();
    this.ctx.fillStyle = '#FF4500';
    this.ctx.fillRect(
      bullet.position.x - bullet.size.x / 2,
      bullet.position.y - bullet.size.y / 2,
      bullet.size.x,
      bullet.size.y
    );
    this.ctx.restore();
  }

  private drawPowerup(powerup: Powerup) {
    this.ctx.save();
    this.ctx.strokeStyle = '#00FFFF';
    this.ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(powerup.position.x, powerup.position.y, 15, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  getHudStats(): HudStat[] {
    if (!this.player) return [];
    const stats: HudStat[] = [
      { label: 'Health', meter: { value: Math.max(0, this.player.health), max: this.player.maxHealth } },
      { label: 'Wave', value: `${Math.min(this.wave, TOTAL_WAVES)}/${TOTAL_WAVES}` },
      { label: 'Rescued', value: this.civiliansRescued },
    ];
    if (this.player.shielded) stats.push({ label: 'Shield', value: 'ON' });
    const kamikazeCount = this.enemies.filter(e => e.alive && e.kamikazeMode).length;
    if (kamikazeCount > 0) stats.push({ label: 'Kamikaze', value: kamikazeCount, tone: 'danger' });
    return stats;
  }

  private drawUI() {
    // Enemy health bars (for visible enemies)
    this.enemies.forEach(enemy => {
      if (enemy.alive && enemy.health < enemy.maxHealth) {
        const screenX = enemy.position.x - this.camera.x;
        if (screenX >= 0 && screenX <= this.width) {
          this.drawEnemyHealthBar(enemy, screenX, enemy.position.y - 30);
        }
      }
    });
    
    if (this.waveBannerTimer > 0) {
      const subtitle = this.wave > 1 ? 'HULL REPAIRED' : 'PROTECT THE INNOCENT';
      this.drawText(`WAVE ${this.wave}/${TOTAL_WAVES}`, this.width / 2, this.height * 0.3, 32, '#FFD93D', 'center');
      this.drawText(subtitle, this.width / 2, this.height * 0.3 + 30, 16, '#FFF', 'center');
    }

    // Guardian protocol
    this.drawText('Guardian Protocol: Protect the innocent with honor and courage', this.width / 2, this.height - 20, 14, '#FFF', 'center');
  }

  private drawEnemyHealthBar(enemy: Enemy, x: number, y: number) {
    const barWidth = 40;
    const barHeight = 6;
    const healthPercent = enemy.health / enemy.maxHealth;
    
    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(x - barWidth/2, y, barWidth, barHeight);
    
    // Health bar
    const healthColor = healthPercent > 0.6 ? '#00FF00' : healthPercent > 0.3 ? '#FFD700' : '#FF0000';
    this.ctx.fillStyle = healthColor;
    this.ctx.fillRect(x - barWidth/2, y, barWidth * healthPercent, barHeight);
    
    // Border
    this.ctx.strokeStyle = '#FFF';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - barWidth/2, y, barWidth, barHeight);
  }

  handleInput(event: KeyboardEvent) {
    if (!event) return; // Safety check for tests

    if (event.type === 'keydown') {
      this.keys.add(event.code);
    } else if (event.type === 'keyup') {
      this.keys.delete(event.code);
    }
  }

  // Touch/pointer controls for mobile
  handlePointerDown(x: number, _y: number) {
    // Left side of screen = move left, right side = move right
    if (x < this.width * 0.5) {
      this.keys.add('ArrowLeft');
      this.keys.add('KeyA');
    } else {
      this.keys.add('ArrowRight');
      this.keys.add('KeyD');
    }
    
    // Touch shooting: tap anywhere to shoot horizontally
    this.shootPlayerBullet();
  }

  handlePointerUp() {
    // Remove movement keys when touch ends
    this.keys.delete('ArrowLeft');
    this.keys.delete('KeyA');
    this.keys.delete('ArrowRight');
    this.keys.delete('KeyD');
  }

  handlePointerMove(_x: number, _y: number) {
    // Optional: Add touch movement tracking here if needed
    // For now, we'll keep it simple with just tap-to-shoot
  }

  private playShootSound() {
    this.playStinger('defender_shoot');
  }

  private playExplosionSound() {
    this.playStinger('defender_explosion');
  }

  protected cleanup() {
    super.cleanup();
    this.stopWhispers();
  }
}
