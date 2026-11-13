import { BaseGame, type HudStat } from './BaseGame';
import { arcadeFont } from './engine/fonts';
import { FlashExplosions } from './engine/FlashExplosions';

interface Player {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  rotation: number;
  targetRotation: number;
  size: number;
  health: number;
  maxHealth: number;
  shield: number;
  weaponCooldown: number;
  alive: boolean;
  thrust: number;
  maxSpeed: number;
}

interface EnemyShip {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  rotation: number;
  size: number;
  health: number;
  maxHealth: number;
  type: 'fighter' | 'interceptor' | 'bomber';
  shootCooldown: number;
  movePattern: number;
  patternTimer: number;
  alive: boolean;
  /** Formation slot the ship flies in to; null once it has arrived. */
  entryTargetY: number | null;
  entryDelay: number;
}

interface StarDestroyer {
  position: { x: number; y: number };
  health: number;
  maxHealth: number;
  phase: number;
  shootCooldown: number;
  specialAttackTimer: number;
  weakPoints: Array<{x: number, y: number, health: number, destroyed: boolean}>;
  alive: boolean;
  size: number;
}

interface Bullet {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  owner: 'player' | 'enemy' | 'boss';
  size: number;
  damage: number;
  color: string;
  trail: Array<{x: number, y: number}>;
  // New properties for advanced bullets
  guided?: boolean;
  target?: { x: number; y: number };
  tripleShot?: boolean;
  gravitron?: boolean;
  lifetime?: number;
}

type PowerupType = 'shield' | 'rapid' | 'spread' | 'speed' | 'invincible' | 'guided' | 'triple' | 'gravitron';

// All rates are per 60 Hz update.
// Held-key flight: thrust / (1 - friction) sets the cruising speed (~4.9, capped at max speed).
const PLAYER_THRUST = 0.24;
const PLAYER_REVERSE_THRUST = 0.16;
const PLAYER_ROTATION_SPEED = 0.075;
const PLAYER_FRICTION = 0.951;
const PLAYER_MAX_SPEED = 4.8;
const BOOSTED_MAX_SPEED = 7.2;
/** Touch handlers apply thrust per pointer event / stick sample rather than per update. */
const TOUCH_THRUST = 0.18;
const TOUCH_ROTATION_EASE = 0.093;
const FIRE_COOLDOWN = 17;
const RAPID_FIRE_COOLDOWN = 8;
const SHIELD_REGEN = 0.025;
const SHIELD_REGEN_DELAY_FRAMES = 180;
/** Brief invulnerability after a hit, so a whole volley can't land at once. */
const HIT_GRACE_FRAMES = 20;

// Opening: ships fly in from above, then open fire one at a time with a visible charge-up.
const ENTRY_DISTANCE = 360;
const ENTRY_SPEED = 3;
const ENTRY_STAGGER_FRAMES = 8;
const FIRST_SHOT_FRAMES = 270;
const FIRST_SHOT_STAGGER_FRAMES = 35;
const FIRE_TELEGRAPH_FRAMES = 30;
const ENEMY_FIRE_INTERVAL_MIN = 95;
const ENEMY_FIRE_INTERVAL_SPREAD = 180;
const ENEMY_BULLET_SPEED = 3.1;
const ENEMY_BULLET_DAMAGE = 12;
const ENEMY_HIT_SCORE = 10;
/** At the last ship, fire intervals shrink to this fraction. */
const ENEMY_FIRE_MIN_SCALE = 0.5;
/**
 * Player shots deal 20, so fighters take 6 hits, interceptors 4, bombers 8. Speed scales the
 * flight pattern; shotSpeed scales ENEMY_BULLET_SPEED; bombers fire a 3-shot fan `spread` rad apart.
 */
const ENEMY_STATS = {
  fighter: { size: 18, health: 120, score: 100, speed: 1.4, shotSpeed: 1, spread: 0 },
  interceptor: { size: 15, health: 80, score: 200, speed: 1.8, shotSpeed: 1.3, spread: 0 },
  bomber: { size: 20, health: 160, score: 300, speed: 1, shotSpeed: 0.85, spread: 0.3 },
} as const;
/** Diving ships circle the player at this range instead of parking on top of it. */
const DIVER_STANDOFF = 170;

// Command vessel
const BOSS_HEALTH = 5600;
const BOSS_ENTRY_SPEED = 1.5;
const BOSS_STATION_Y = 100;
const BOSS_FIRST_VOLLEY_FRAMES = 90;
/** Volley interval by vessel phase (one more phase per destroyed weak point). */
const BOSS_VOLLEY_INTERVALS = [68, 55, 44];
const BOSS_BULLET_SPEED = 3.3;
const BOSS_BULLET_DAMAGE = 15;
const BOSS_SWEEP_AMPLITUDE = 220;
/** ~14 s per full sweep. */
const BOSS_SWEEP_RATE = 0.0075;
/** Radial burst interval by vessel phase. */
const BOSS_RING_INTERVALS = [480, 400, 320];
const BOSS_RING_SHOTS = 16;
const BOSS_RING_SPEED = 2.2;
const BOSS_RING_DAMAGE = 14;
/** Each weak point soaks 27 standard shots; hits there count triple against the vessel. */
const WEAK_POINT_HEALTH = 540;
const WEAK_POINT_DAMAGE_MULTIPLIER = 3;
const WEAK_POINT_HIT_RADIUS = 14;
/** Armored hull: shots that miss the weak points barely scratch it. */
const HULL_HIT_DAMAGE = 12;
/** Hull outline relative to the vessel's position: apex, then the two stern corners. */
const BOSS_HULL: Array<{ x: number; y: number }> = [{ x: 0, y: -20 }, { x: -60, y: 80 }, { x: 60, y: 80 }];
/** Longest path across the hull, for tracing shots over it. */
const BOSS_HULL_DEPTH = 120;

const TRANSITION_FRAMES = 200;
const VICTORY_FRAMES = 500;
const POWERUP_INTERVAL_MIN = 600;
const POWERUP_INTERVAL_SPREAD = 400;
/** Shorter than the spawn interval, so weapon upgrades are bursts rather than always on. */
const WEAPON_POWERUP_FRAMES = 600;
const SPEED_POWERUP_FRAMES = 1000;
const INVINCIBLE_POWERUP_FRAMES = 400;

interface Powerup {
  position: { x: number; y: number };
  type: PowerupType;
  radius: number;
  ttl: number;
}

export class StarWarsGame extends BaseGame {
  protected score = 0;
  private player!: Player;
  private enemies: EnemyShip[] = [];
  private starDestroyer!: StarDestroyer;
  private bullets: Bullet[] = [];
  private explosions = new FlashExplosions();
  private stars: Array<{x: number, y: number, speed: number}> = [];
  private powerups: Powerup[] = [];
  private powerupSpawnTimer = 0;
  private nextPowerupInterval = POWERUP_INTERVAL_MIN;
  private hitGraceTimer = 0;
  private shieldRegenDelay = 0;
  private bossSweepTimer = 0;
  private bossVolleyCount = 0;
  private ended = false;
  private rapidFireTimer = 0;
  private spreadTimer = 0;
  private speedBoostTimer = 0;
  private invincibleTimer = 0;
  private guidedMissileTimer = 0;
  private tripleShotTimer = 0;
  private gravitronTimer = 0;

  // Enhanced touch control variables
  private touchStartX = 0;
  private touchStartY = 0;
  private touchActive = false;
  private lastTouchX = 0;
  private lastTouchY = 0;

  private phase: 'enemy-ships' | 'star-destroyer' | 'victory' = 'enemy-ships';
  private enemiesDestroyed = 0;
  private readonly TOTAL_ENEMIES = 12;
  
  private gameTimer = 0;
  private transitioning = false;
  private transitionTimer = 0;
  private victoryTimer = 0;
  
  // AI Companion voice lines (before betrayal)
  private companionLines = [
    "Excellent flying, pilot! Stay on target!",
    "Watch your six! Enemy on your tail!",
    "Great shot! You're becoming quite the ace!",
    "Use the Force, Luke... I mean, pilot!",
    "That's no moon... wait, wrong battle!",
    "I'm detecting massive enemy signatures ahead!",
    "Your skills have grown beyond my calculations...",
    "Together we are unstoppable, my friend!",
    "Perfect teamwork! Nothing can stop us now!",
    "You fight with the spirit of a true warrior!"
  ];

  init() {
    // Initialize fighter ship
    this.player = {
      position: { x: this.width / 2, y: this.height - 100 },
      velocity: { x: 0, y: 0 },
      rotation: -Math.PI / 2,
      targetRotation: -Math.PI / 2,
      size: 25,
      health: 100,
      maxHealth: 100,
      shield: 100,
      weaponCooldown: 0,
      alive: true,
      thrust: PLAYER_THRUST,
      maxSpeed: PLAYER_MAX_SPEED
    };
    this.ended = false;
    this.nextPowerupInterval = POWERUP_INTERVAL_MIN + Math.floor(Math.random() * POWERUP_INTERVAL_SPREAD);

    // Create starfield
    this.createStarField();
    
    // Spawn initial enemy wave
    this.spawnEnemyWave();
    
    // Initialize command vessel (inactive until phase 2)
    this.starDestroyer = {
      position: { x: this.width / 2, y: -200 },
      health: BOSS_HEALTH,
      maxHealth: BOSS_HEALTH,
      phase: 1,
      shootCooldown: BOSS_FIRST_VOLLEY_FRAMES,
      specialAttackTimer: 0,
      // Exposed along the hull's edges so shots can reach them before striking armor
      weakPoints: [
        {x: -36, y: 52, health: WEAK_POINT_HEALTH, destroyed: false},
        {x: 36, y: 52, health: WEAK_POINT_HEALTH, destroyed: false},
        {x: 0, y: 72, health: WEAK_POINT_HEALTH, destroyed: false}
      ],
      alive: true,
      size: 150
    };
  }

  private createStarField() {
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speed: 0.6 + Math.random() * 1.8
      });
    }
  }

  private spawnEnemyWave() {
    this.enemies = [];
    
    // Create formation of 12 ships
    const formations = [
      // V-Formation (4 ships)
      {x: this.width / 2, y: 100, type: 'fighter'},
      {x: this.width / 2 - 50, y: 150, type: 'fighter'},
      {x: this.width / 2 + 50, y: 150, type: 'fighter'},
      {x: this.width / 2 - 100, y: 200, type: 'interceptor'},
      
      // Side formations (4 ships each)
      {x: 100, y: 150, type: 'interceptor'},
      {x: 150, y: 100, type: 'fighter'},
      {x: 120, y: 200, type: 'bomber'},
      {x: 80, y: 250, type: 'fighter'},
      
      {x: this.width - 100, y: 150, type: 'interceptor'},
      {x: this.width - 150, y: 100, type: 'fighter'},
      {x: this.width - 120, y: 200, type: 'bomber'},
      {x: this.width - 80, y: 250, type: 'fighter'}
    ];

    // Ships open fire one at a time, in a random order
    const fireOrder = formations.map((_, i) => i);
    for (let i = fireOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fireOrder[i], fireOrder[j]] = [fireOrder[j], fireOrder[i]];
    }

    formations.forEach((formation, index) => {
      const type = formation.type as EnemyShip['type'];
      const ship: EnemyShip = {
        position: { x: formation.x, y: formation.y - ENTRY_DISTANCE },
        velocity: { x: 0, y: 0 },
        rotation: Math.PI / 2,
        size: ENEMY_STATS[type].size,
        health: ENEMY_STATS[type].health,
        maxHealth: ENEMY_STATS[type].health,
        type,
        shootCooldown: FIRST_SHOT_FRAMES + fireOrder[index] * FIRST_SHOT_STAGGER_FRAMES + Math.random() * FIRST_SHOT_STAGGER_FRAMES,
        movePattern: index % 3,
        patternTimer: 0,
        alive: true,
        entryTargetY: formation.y,
        entryDelay: index * ENTRY_STAGGER_FRAMES
      };
      this.enemies.push(ship);
    });
  }

  update(_deltaTime: number) {
    this.reportScore(this.score);
    if (this.transitioning) {
      this.updateTransition();
      return;
    }

    this.gameTimer++;
    
    // Update player
    this.updatePlayer();
    
    // Update based on phase
    if (this.phase === 'enemy-ships') {
      this.updateEnemyShips();
      if (this.enemiesDestroyed >= this.TOTAL_ENEMIES) {
        this.startStarDestroyerPhase();
      }
    } else if (this.phase === 'star-destroyer') {
      this.updateStarDestroyer();
      if (!this.starDestroyer.alive) {
        this.startVictorySequence();
      }
    } else if (this.phase === 'victory') {
      this.updateVictory();
    }
    
    // Powerups lifecycle
    if (this.phase !== 'victory') {
      this.spawnPowerups();
      this.updatePowerups();
    }

    // Update bullets and explosions
    this.updateBullets();
    this.updateExplosions();
    this.updateStarField();
    
    // Check game over
    if (!this.player.alive && !this.ended) {
      this.ended = true;
      this.onGameOver?.();
    }
  }

  private updatePlayer() {
    if (!this.player.alive) return;

    this.applyKeyboardControls();

    // Limit velocity to max speed
    const currentSpeed = Math.sqrt(this.player.velocity.x ** 2 + this.player.velocity.y ** 2);
    if (currentSpeed > this.player.maxSpeed) {
      this.player.velocity.x = (this.player.velocity.x / currentSpeed) * this.player.maxSpeed;
      this.player.velocity.y = (this.player.velocity.y / currentSpeed) * this.player.maxSpeed;
    }
    
    // Apply velocity to position
    this.player.position.x += this.player.velocity.x;
    this.player.position.y += this.player.velocity.y;
    
    // Apply friction to velocity for smooth movement
    this.player.velocity.x *= PLAYER_FRICTION;
    this.player.velocity.y *= PLAYER_FRICTION;
    
    // Smooth rotation towards target (set by touch controls)
    const rotationDiff = this.player.targetRotation - this.player.rotation;
    const normalizedDiff = ((rotationDiff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const shortestRotation = normalizedDiff > Math.PI ? normalizedDiff - Math.PI * 2 : normalizedDiff;
    
    this.player.rotation += shortestRotation * TOUCH_ROTATION_EASE;
    
    // Normalize rotation to 0-2π range
    this.player.rotation = ((this.player.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    
    // Weapon cooldown
    if (this.player.weaponCooldown > 0) {
      this.player.weaponCooldown--;
    }
    if (this.hitGraceTimer > 0) this.hitGraceTimer--;
    
    // Shield regeneration, after a short lull in incoming fire
    if (this.shieldRegenDelay > 0) {
      this.shieldRegenDelay--;
    } else if (this.player.shield < 100) {
      this.player.shield = Math.min(100, this.player.shield + SHIELD_REGEN);
    }
    
    // Keep player on screen
    this.player.position.x = Math.max(25, Math.min(this.width - 25, this.player.position.x));
    this.player.position.y = Math.max(25, Math.min(this.height - 25, this.player.position.y));
  }

  /** Held keys: W/↑ thrust, S/↓ reverse, A/D or ←/→ rotate, Space fire. */
  private applyKeyboardControls() {
    const p = this.player;
    const turn = (this.isKeyDown('KeyD', 'ArrowRight') ? 1 : 0) - (this.isKeyDown('KeyA', 'ArrowLeft') ? 1 : 0);
    if (turn !== 0) {
      p.rotation += turn * PLAYER_ROTATION_SPEED;
      p.targetRotation = p.rotation;
    }
    const push = (this.isKeyDown('KeyW', 'ArrowUp') ? p.thrust : 0) - (this.isKeyDown('KeyS', 'ArrowDown') ? PLAYER_REVERSE_THRUST : 0);
    if (push !== 0) {
      p.velocity.x += Math.cos(p.rotation) * push;
      p.velocity.y += Math.sin(p.rotation) * push;
    }
    if (this.isKeyDown('Space')) this.tryFire();
  }

  private tryFire() {
    if (this.player.weaponCooldown > 0) return;
    this.shootPlayerBullet();
    this.player.weaponCooldown = this.rapidFireTimer > 0 ? RAPID_FIRE_COOLDOWN : FIRE_COOLDOWN;
  }

  private updateEnemyShips() {
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;

      // Fly in to the formation slot before engaging
      if (enemy.entryTargetY !== null) {
        if (enemy.entryDelay > 0) {
          enemy.entryDelay--;
        } else {
          enemy.position.y = Math.min(enemy.entryTargetY, enemy.position.y + ENTRY_SPEED);
          if (enemy.position.y >= enemy.entryTargetY) enemy.entryTargetY = null;
        }
        enemy.shootCooldown--;
        return;
      }
      
      enemy.patternTimer++;
      
      // Different movement patterns
      switch (enemy.movePattern) {
        case 0: // Weaving pattern
          enemy.velocity.x = Math.sin(enemy.patternTimer * 0.012) * 1.2;
          enemy.velocity.y = 0.6;
          break;
        case 1: { // Circular pattern
          const _radius = 60;
          enemy.velocity.x = Math.cos(enemy.patternTimer * 0.018) * 0.9;
          enemy.velocity.y = Math.sin(enemy.patternTimer * 0.018) * 0.9 + 0.3;
          break;
        }
        case 2: { // Aggressive dive
          const dx = this.player.position.x - enemy.position.x;
          const dy = this.player.position.y - enemy.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > DIVER_STANDOFF) {
            enemy.velocity.x = (dx / distance) * 0.9;
            enemy.velocity.y = (dy / distance) * 0.9;
          } else if (distance > 0) {
            // Strafe around the player at standoff range
            enemy.velocity.x = (-dy / distance) * 0.9 - (dx / distance) * 0.3;
            enemy.velocity.y = (dx / distance) * 0.9 - (dy / distance) * 0.3;
          }
          break;
        }
      }
      
      const speed = ENEMY_STATS[enemy.type].speed;
      enemy.position.x += enemy.velocity.x * speed;
      enemy.position.y += enemy.velocity.y * speed;
      enemy.position.x = Math.max(enemy.size, Math.min(this.width - enemy.size, enemy.position.x));
      
      // Shoot at player, only while visible on screen
      enemy.shootCooldown--;
      if (enemy.shootCooldown <= 0) {
        if (this.canEnemyFire(enemy)) {
          this.enemyShoot(enemy);
          enemy.shootCooldown = this.enemyFireInterval();
        } else {
          // Re-arm so the charge-up glow plays in view before the shot
          enemy.shootCooldown = FIRE_TELEGRAPH_FRAMES;
        }
      }
      
      // Ships that leave the bottom loop back in from the top
      if (enemy.position.y > this.height + 50) {
        enemy.position.y = -50;
        enemy.position.x = enemy.size + Math.random() * (this.width - enemy.size * 2);
      }
    });
  }

  private canEnemyFire(enemy: EnemyShip): boolean {
    return enemy.entryTargetY === null && enemy.position.y >= enemy.size && enemy.position.y <= this.height - enemy.size;
  }

  private startStarDestroyerPhase() {
    this.phase = 'star-destroyer';
    this.transitioning = true;
    this.transitionTimer = TRANSITION_FRAMES;
    this.clearHostileBullets();
  }

  private clearHostileBullets() {
    this.bullets = this.bullets.filter(bullet => bullet.owner === 'player');
  }

  private updateStarDestroyer() {
    if (!this.starDestroyer.alive) return;
    
    // Move command vessel into position; it holds fire until on station
    if (this.starDestroyer.position.y < BOSS_STATION_Y) {
      this.starDestroyer.position.y = Math.min(BOSS_STATION_Y, this.starDestroyer.position.y + BOSS_ENTRY_SPEED);
      return;
    }

    // Slow broadside sweep, so no flank stays safe for long
    this.bossSweepTimer++;
    const sweep = Math.min(BOSS_SWEEP_AMPLITUDE, this.width / 2 - 90);
    this.starDestroyer.position.x = this.width / 2 + Math.sin(this.bossSweepTimer * BOSS_SWEEP_RATE) * sweep;
    
    // Shooting pattern
    this.starDestroyer.shootCooldown--;
    if (this.starDestroyer.shootCooldown <= 0) {
      this.starDestroyerShoot();
      this.starDestroyer.shootCooldown = BOSS_VOLLEY_INTERVALS[this.starDestroyer.phase - 1];
    }
    
    // Special attacks
    this.starDestroyer.specialAttackTimer++;
    if (this.starDestroyer.specialAttackTimer >= BOSS_RING_INTERVALS[this.starDestroyer.phase - 1]) {
      this.starDestroyerSpecialAttack();
      this.starDestroyer.specialAttackTimer = 0;
    }
    
    // Check phase transitions
    const destroyedWeakPoints = this.starDestroyer.weakPoints.filter(wp => wp.destroyed).length;
    this.starDestroyer.phase = Math.min(3, destroyedWeakPoints + 1);
  }

  private startVictorySequence() {
    this.phase = 'victory';
    this.victoryTimer = 0;
    this.clearHostileBullets();
  }

  private updateVictory() {
    this.victoryTimer++;
    if (this.victoryTimer >= VICTORY_FRAMES && !this.ended) {
      this.ended = true;
      this.onStageComplete?.();
    }
  }

  private updateTransition() {
    this.transitionTimer--;
    if (this.transitionTimer <= 0) {
      this.transitioning = false;
    }
  }

  private enemyShoot(enemy: EnemyShip) {
    const dx = this.player.position.x - enemy.position.x;
    const dy = this.player.position.y - enemy.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= 0) return;
    const { shotSpeed, spread } = ENEMY_STATS[enemy.type];
    const aim = Math.atan2(dy, dx);
    const angles = spread > 0 ? [aim - spread, aim, aim + spread] : [aim];
    for (const angle of angles) {
      this.bullets.push({
        position: { x: enemy.position.x, y: enemy.position.y + enemy.size },
        velocity: { 
          x: Math.cos(angle) * ENEMY_BULLET_SPEED * shotSpeed, 
          y: Math.sin(angle) * ENEMY_BULLET_SPEED * shotSpeed 
        },
        owner: 'enemy',
        size: 3,
        damage: ENEMY_BULLET_DAMAGE,
        color: '#FF0000',
        trail: []
      });
    }
  }

  /** The remaining ships fire more often as their squadron thins, so pressure holds through the phase. */
  private enemyFireInterval(): number {
    const alive = this.enemies.filter(e => e.alive).length;
    const scale = ENEMY_FIRE_MIN_SCALE + (1 - ENEMY_FIRE_MIN_SCALE) * (alive / this.TOTAL_ENEMIES);
    return (ENEMY_FIRE_INTERVAL_MIN + Math.random() * ENEMY_FIRE_INTERVAL_SPREAD) * scale;
  }

  private starDestroyerShoot() {
    // Multiple laser banks
    const positions = [
      {x: -30, y: 60},
      {x: 30, y: 60},
      {x: -15, y: 80},
      {x: 15, y: 80}
    ];
    
    // Alternate volleys: all banks converge on the player, then fire in parallel as a wall to sidestep
    this.bossVolleyCount++;
    const wall = this.bossVolleyCount % 2 === 0;
    positions.forEach(pos => {
      const originY = wall ? 70 : pos.y;
      const dx = this.player.position.x - (this.starDestroyer.position.x + (wall ? 0 : pos.x));
      const dy = this.player.position.y - (this.starDestroyer.position.y + originY);
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0) {
        const bullet: Bullet = {
          position: { 
            x: this.starDestroyer.position.x + pos.x, 
            y: this.starDestroyer.position.y + pos.y 
          },
          velocity: { 
            x: (dx / distance) * BOSS_BULLET_SPEED, 
            y: (dy / distance) * BOSS_BULLET_SPEED 
          },
          owner: 'boss',
          size: 5,
          damage: BOSS_BULLET_DAMAGE,
          color: '#00FF00',
          trail: []
        };
        this.bullets.push(bullet);
      }
    });
  }

  private starDestroyerSpecialAttack() {
    // Spread shot pattern
    for (let i = 0; i < BOSS_RING_SHOTS; i++) {
      const angle = (i / BOSS_RING_SHOTS) * Math.PI * 2;
      const bullet: Bullet = {
        position: { x: this.starDestroyer.position.x, y: this.starDestroyer.position.y + 40 },
        velocity: { 
          x: Math.cos(angle) * BOSS_RING_SPEED, 
          y: Math.sin(angle) * BOSS_RING_SPEED 
        },
        owner: 'boss',
        size: 4,
        damage: BOSS_RING_DAMAGE,
        color: '#FFFF00',
        trail: []
      };
      this.bullets.push(bullet);
    }
  }

  private updateBullets() {
    this.bullets = this.bullets.filter(bullet => {
      // Guided missile homing logic
      if (bullet.guided && bullet.target) {
        const dx = bullet.target.x - bullet.position.x;
        const dy = bullet.target.y - bullet.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          // Homing acceleration (gradually steer toward target)
          const homingForce = 0.18;
          const targetAngle = Math.atan2(dy, dx);
          const currentAngle = Math.atan2(bullet.velocity.y, bullet.velocity.x);

          // Calculate shortest rotation direction
          let angleDiff = targetAngle - currentAngle;
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

          // Apply steering force
          const steerAngle = currentAngle + Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), homingForce);

          // Update velocity with some momentum preservation
          const speed = Math.sqrt(bullet.velocity.x * bullet.velocity.x + bullet.velocity.y * bullet.velocity.y);
          bullet.velocity.x = Math.cos(steerAngle) * speed;
          bullet.velocity.y = Math.sin(steerAngle) * speed;
        }
      }

      bullet.position.x += bullet.velocity.x;
      bullet.position.y += bullet.velocity.y;

      // Add trail
      bullet.trail.push({x: bullet.position.x, y: bullet.position.y});
      if (bullet.trail.length > 5) bullet.trail.shift();
      
      // Check collisions
      if (bullet.lifetime !== undefined && --bullet.lifetime <= 0) return false;

      if (bullet.owner === 'player') {
        // Check enemy collisions
        for (const enemy of this.enemies) {
          if (enemy.alive && this.checkCollision(bullet.position, bullet.size, enemy.position, enemy.size)) {
            this.createExplosion(bullet.position.x, bullet.position.y, 20);
            this.playExplosionSound();
            bullet.size = 0; // Mark for removal
            this.damageEnemy(enemy, bullet.damage);
            break;
          }
        }
        
        // Check command vessel collisions
        if (bullet.size > 0 && this.phase === 'star-destroyer' && this.starDestroyer.alive) {
          const sd = this.starDestroyer;
          // Top-down view: a shot reaching the hull strikes any weak point its path crosses on the way over it
          const inHull = this.hitsBossHull(bullet.position);
          const speed = Math.hypot(bullet.velocity.x, bullet.velocity.y);
          const reach = inHull && speed > 0 ? BOSS_HULL_DEPTH / speed : 0;
          const from = { x: bullet.position.x - bullet.velocity.x, y: bullet.position.y - bullet.velocity.y };
          const to = { x: bullet.position.x + bullet.velocity.x * reach, y: bullet.position.y + bullet.velocity.y * reach };
          const wp = sd.weakPoints.find(w => !w.destroyed &&
            this.segmentPointDistance(from, to, { x: sd.position.x + w.x, y: sd.position.y + w.y }) < WEAK_POINT_HIT_RADIUS);
          if (wp) {
            bullet.size = 0;
            wp.health -= bullet.damage;
            this.createExplosion(sd.position.x + wp.x, sd.position.y + wp.y, wp.health > 0 ? 20 : 30);
            this.playExplosionSound();
            this.score += 50;
            if (wp.health <= 0) {
              wp.destroyed = true;
              this.score += 500;
            }
            this.damageBoss(bullet.damage * WEAK_POINT_DAMAGE_MULTIPLIER);
          } else if (inHull) {
            this.createExplosion(bullet.position.x, bullet.position.y, 25);
            this.playExplosionSound();
            bullet.size = 0;
            this.score += 50; // Smaller score for hull hits
            this.damageBoss(HULL_HIT_DAMAGE);
          }
        }
      } else {
        // Enemy bullet vs player
        if (this.player.alive && this.phase !== 'victory' && this.checkCollision(bullet.position, bullet.size, this.player.position, this.player.size)) {
          this.createExplosion(bullet.position.x, bullet.position.y, 15);
          bullet.size = 0;
          if (this.invincibleTimer <= 0 && this.hitGraceTimer <= 0) this.damagePlayer(bullet.damage);
        }
      }
      
      // Remove bullets that are off screen or marked for removal
      return bullet.size > 0 && 
             bullet.position.x > -50 && bullet.position.x < this.width + 50 &&
             bullet.position.y > -50 && bullet.position.y < this.height + 50;
    });
  }

  private spawnPowerups() {
    // Spawn a powerup every ~10-17 seconds during combat
    this.powerupSpawnTimer++;
    if (this.powerupSpawnTimer >= this.nextPowerupInterval) {
      this.powerupSpawnTimer = 0;
      this.nextPowerupInterval = POWERUP_INTERVAL_MIN + Math.floor(Math.random() * POWERUP_INTERVAL_SPREAD);

      // Different powerups based on phase
      let availableTypes: PowerupType[];
      if (this.phase === 'star-destroyer') {
        // Final phase gets the most powerful powerups
        availableTypes = ['shield', 'rapid', 'spread', 'speed', 'invincible', 'guided', 'triple', 'gravitron'];
      } else {
        // Earlier phases get basic powerups
        availableTypes = ['shield', 'rapid', 'spread', 'speed'];
      }

      const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      this.powerups.push({
        position: { x: Math.random() * (this.width - 80) + 40, y: Math.random() * (this.height - 160) + 80 },
        type,
        radius: 10,
        ttl: 1000
      });
    }
  }

  private updatePowerups() {
    // Update timers
    if (this.rapidFireTimer > 0) this.rapidFireTimer--;
    if (this.spreadTimer > 0) this.spreadTimer--;
    if (this.speedBoostTimer > 0) this.speedBoostTimer--;
    if (this.invincibleTimer > 0) this.invincibleTimer--;
    if (this.guidedMissileTimer > 0) this.guidedMissileTimer--;
    if (this.tripleShotTimer > 0) this.tripleShotTimer--;
    if (this.gravitronTimer > 0) this.gravitronTimer--;

    // Apply speed boost effect
    this.player.maxSpeed = this.speedBoostTimer > 0 ? BOOSTED_MAX_SPEED : PLAYER_MAX_SPEED;

    // Powerup TTL and collection
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.ttl--;
      if (p.ttl <= 0) {
        this.powerups.splice(i, 1);
        continue;
      }
      if (this.checkCollision(p.position, p.radius * 2, this.player.position, this.player.size)) {
        this.applyPowerup(p.type);
        this.createExplosion(p.position.x, p.position.y, 20);
        this.powerups.splice(i, 1);
      }
    }
  }

  private applyPowerup(type: PowerupType) {
    switch (type) {
      case 'shield':
        this.player.shield = Math.min(100, this.player.shield + 40);
        break;
      case 'rapid':
        this.rapidFireTimer = WEAPON_POWERUP_FRAMES;
        break;
      case 'spread':
        this.spreadTimer = WEAPON_POWERUP_FRAMES;
        break;
      case 'speed':
        this.speedBoostTimer = SPEED_POWERUP_FRAMES;
        break;
      case 'invincible':
        this.invincibleTimer = INVINCIBLE_POWERUP_FRAMES;
        break;
      case 'guided':
        this.guidedMissileTimer = WEAPON_POWERUP_FRAMES;
        break;
      case 'triple':
        this.tripleShotTimer = WEAPON_POWERUP_FRAMES;
        break;
      case 'gravitron':
        this.gravitronTimer = 1; // Instant effect
        this.activateGravitronBomb();
        break;
    }
  }

  private activateGravitronBomb() {
    // Create a massive gravitational effect that affects all enemies on screen
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    // Visual effect - large gravitron explosion
    this.createExplosion(centerX, centerY, 120);

    // Apply gravitron effect to all enemies
    this.enemies.forEach(enemy => {
      if (enemy.alive) {
        const dx = centerX - enemy.position.x;
        const dy = centerY - enemy.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          // Pull enemies toward center with massive force
          const pullForce = 8;
          enemy.velocity.x += (dx / distance) * pullForce;
          enemy.velocity.y += (dy / distance) * pullForce;

          // Deal damage based on proximity
          const damage = Math.max(10, 50 - (distance / 10));

          // Create smaller explosions on affected enemies
          this.createExplosion(enemy.position.x, enemy.position.y, 15);
          this.damageEnemy(enemy, damage);
        }

        // Cap enemy velocity to prevent them from flying off screen
        const maxSpeed = 15;
        const currentSpeed = Math.sqrt(enemy.velocity.x * enemy.velocity.x + enemy.velocity.y * enemy.velocity.y);
        if (currentSpeed > maxSpeed) {
          enemy.velocity.x = (enemy.velocity.x / currentSpeed) * maxSpeed;
          enemy.velocity.y = (enemy.velocity.y / currentSpeed) * maxSpeed;
        }
      }
    });

    // Also affect command vessel if in final phase
    if (this.phase === 'star-destroyer' && this.starDestroyer.alive) {
      const dx = centerX - this.starDestroyer.position.x;
      const dy = centerY - this.starDestroyer.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        // Command vessel resists the pull but takes more damage
        const damage = Math.max(20, 100 - (distance / 5));
        this.createExplosion(this.starDestroyer.position.x, this.starDestroyer.position.y, 25);
        this.damageBoss(damage);
      }
    }

    this.score += 500; // Bonus points for gravitron bomb
  }

  private updateExplosions() {
    this.explosions.update();
  }

  private updateStarField() {
    this.stars.forEach(star => {
      star.y += star.speed;
      if (star.y > this.height) {
        star.y = 0;
        star.x = Math.random() * this.width;
      }
    });
  }

  private createExplosion(x: number, y: number, maxSize: number) {
    this.explosions.spawn(x, y, maxSize);
  }

  private damageEnemy(enemy: EnemyShip, damage: number) {
    if (!enemy.alive) return;
    enemy.health -= damage;
    this.score += ENEMY_HIT_SCORE;
    if (enemy.health > 0) return;
    enemy.alive = false;
    this.enemiesDestroyed++;
    this.createExplosion(enemy.position.x, enemy.position.y, 40);
    this.playExplosionSound();
    this.score += ENEMY_STATS[enemy.type].score;
  }

  private damageBoss(damage: number) {
    const sd = this.starDestroyer;
    if (!sd.alive) return;
    sd.health -= damage;
    if (sd.health > 0) return;
    sd.health = 0;
    sd.alive = false;
    this.createExplosion(sd.position.x, sd.position.y, 80);
    this.score += 2000;
  }

  private damagePlayer(damage: number) {
    const p = this.player;
    this.hitGraceTimer = HIT_GRACE_FRAMES;
    this.shieldRegenDelay = SHIELD_REGEN_DELAY_FRAMES;
    const absorbed = Math.min(p.shield, damage);
    p.shield -= absorbed;
    p.health -= damage - absorbed;
    if (p.health <= 0) {
      p.health = 0;
      p.alive = false;
      this.createExplosion(p.position.x, p.position.y, 50);
    }
  }

  private hitsBossHull(point: { x: number; y: number }): boolean {
    const px = point.x - this.starDestroyer.position.x;
    const py = point.y - this.starDestroyer.position.y;
    const [a, b, c] = BOSS_HULL;
    const side = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
      (p2.x - p1.x) * (py - p1.y) - (p2.y - p1.y) * (px - p1.x);
    const d1 = side(a, b), d2 = side(b, c), d3 = side(c, a);
    return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
  }

  private segmentPointDistance(a: { x: number; y: number }, b: { x: number; y: number }, p: { x: number; y: number }): number {
    const abx = b.x - a.x, aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2)) : 0;
    return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y);
  }

  private checkCollision(pos1: {x: number, y: number}, size1: number, pos2: {x: number, y: number}, size2: number): boolean {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (size1 + size2) / 2;
  }

  render() {
    this.clearCanvas();
    
    // Draw starfield
    this.drawStarField();
    
    // Draw based on phase
    if (this.phase === 'star-destroyer' || this.phase === 'victory') {
      this.drawStarDestroyer();
    }
    
    // Draw enemies
    this.drawEnemies();
    
    // Draw player
    this.drawPlayer();
    
    // Draw powerups
    this.drawPowerups();

    // Draw bullets and explosions
    this.drawBullets();
    this.drawExplosions();
    
    // Draw touch control zones (mobile only)
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
      this.drawTouchZones();
    }

    // Draw UI
    this.drawUI();
    
    // Draw transition effects
    if (this.transitioning) {
      this.drawTransition();
    }
  }

  private drawPowerups() {
    this.powerups.forEach(p => {
      this.ctx.save();
      this.ctx.translate(p.position.x, p.position.y);
      const pulse = (Math.sin(this.gameTimer * 0.06) + 1) * 0.5;
      switch (p.type) {
        case 'shield': this.ctx.fillStyle = `rgba(0,200,255,${0.6 + 0.4 * pulse})`; break;
        case 'rapid': this.ctx.fillStyle = `rgba(0,255,0,${0.6 + 0.4 * pulse})`; break;
        case 'spread': this.ctx.fillStyle = `rgba(255,200,0,${0.6 + 0.4 * pulse})`; break;
        case 'speed': this.ctx.fillStyle = `rgba(255,100,0,${0.6 + 0.4 * pulse})`; break;
        case 'invincible': this.ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * pulse})`; break;
        case 'guided': this.ctx.fillStyle = `rgba(255,0,255,${0.6 + 0.4 * pulse})`; break; // Magenta for guided missiles
        case 'triple': this.ctx.fillStyle = `rgba(0,255,255,${0.6 + 0.4 * pulse})`; break; // Cyan for triple shot
        case 'gravitron': this.ctx.fillStyle = `rgba(128,0,128,${0.6 + 0.4 * pulse})`; break; // Purple for gravitron
      }
      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  private drawTouchZones() {
    this.ctx.save();
    this.ctx.globalAlpha = 0.2; // Semi-transparent

    const screenWidth = this.width;
    const screenHeight = this.height;

    // Left zone: Movement (Blue)
    this.ctx.fillStyle = '#0088FF';
    this.ctx.fillRect(0, 0, screenWidth * 0.4, screenHeight);

    // Center zone: Action (Yellow)
    this.ctx.fillStyle = '#FFFF00';
    this.ctx.fillRect(screenWidth * 0.4, 0, screenWidth * 0.2, screenHeight);

    // Right zone: Shooting (Red)
    this.ctx.fillStyle = '#FF4444';
    this.ctx.fillRect(screenWidth * 0.6, 0, screenWidth * 0.4, screenHeight);

    // Add zone labels
    this.ctx.globalAlpha = 0.8;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = arcadeFont(16, 'body');
    this.ctx.textAlign = 'center';

    // Movement label
    this.ctx.fillText('DRAG TO MOVE', screenWidth * 0.2, screenHeight * 0.1);

    // Shoot label
    this.ctx.fillText('TAP TO SHOOT', screenWidth * 0.8, screenHeight * 0.1);

    // Action label
    this.ctx.fillText('ACTION', screenWidth * 0.5, screenHeight * 0.1);

    // Show current touch state if active
    if (this.touchActive) {
      this.ctx.fillStyle = '#00FF00';
      this.ctx.beginPath();
      this.ctx.arc(this.touchStartX, this.touchStartY, 10, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw drag vector
      const deltaX = this.lastTouchX - this.touchStartX;
      const deltaY = this.lastTouchY - this.touchStartY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > 20) {
        this.ctx.strokeStyle = '#00FF00';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.touchStartX, this.touchStartY);
        this.ctx.lineTo(this.lastTouchX, this.lastTouchY);
        this.ctx.stroke();

        // Draw arrow head
        const angle = Math.atan2(deltaY, deltaX);
        const arrowLength = 15;
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastTouchX, this.lastTouchY);
        this.ctx.lineTo(
          this.lastTouchX - arrowLength * Math.cos(angle - Math.PI/6),
          this.lastTouchY - arrowLength * Math.sin(angle - Math.PI/6)
        );
        this.ctx.moveTo(this.lastTouchX, this.lastTouchY);
        this.ctx.lineTo(
          this.lastTouchX - arrowLength * Math.cos(angle + Math.PI/6),
          this.lastTouchY - arrowLength * Math.sin(angle + Math.PI/6)
        );
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  private drawStarField() {
    this.ctx.fillStyle = '#000011';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    this.stars.forEach(star => {
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillRect(star.x, star.y, 1, 1);
    });
  }

  private drawPlayer() {
    if (!this.player.alive) return;
    
    this.ctx.save();
    if (this.hitGraceTimer > 0 && Math.floor(this.hitGraceTimer / 4) % 2 === 0) this.ctx.globalAlpha = 0.4;
    this.ctx.translate(this.player.position.x, this.player.position.y);
    this.ctx.rotate(this.player.rotation);
    
    // Fighter ship design
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.fillStyle = '#CCCCCC';
    this.ctx.lineWidth = 2;
    
    // Main body
    this.ctx.fillRect(-3, -15, 6, 30);
    this.ctx.strokeRect(-3, -15, 6, 30);
    
    // Wings in X formation
    this.ctx.beginPath();
    this.ctx.moveTo(-15, -15);
    this.ctx.lineTo(-5, -5);
    this.ctx.moveTo(15, -15);
    this.ctx.lineTo(5, -5);
    this.ctx.moveTo(-15, 15);
    this.ctx.lineTo(-5, 5);
    this.ctx.moveTo(15, 15);
    this.ctx.lineTo(5, 5);
    this.ctx.stroke();
    
    // Engine glow
    this.ctx.fillStyle = '#00AAFF';
    this.ctx.fillRect(-2, 15, 4, 8);
    
    this.ctx.restore();
  }

  private drawEnemies() {
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;
      
      this.ctx.save();
      this.ctx.translate(enemy.position.x, enemy.position.y);
      this.ctx.rotate(enemy.rotation);
      
      // Different designs for different ship types
      switch (enemy.type) {
        case 'fighter':
          this.drawFighter();
          break;
        case 'interceptor':
          this.drawInterceptor();
          break;
        case 'bomber':
          this.drawBomber();
          break;
      }
      
      this.ctx.restore();

      // Charge-up glow: this ship is about to fire
      if (enemy.entryTargetY === null && enemy.shootCooldown <= FIRE_TELEGRAPH_FRAMES) {
        const charge = 1 - Math.max(0, enemy.shootCooldown) / FIRE_TELEGRAPH_FRAMES;
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(255, 60, 60, ${0.3 + 0.6 * charge})`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(enemy.position.x, enemy.position.y + enemy.size, 3 + 6 * (1 - charge), 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }
      
      // Health bar
      if (enemy.health < enemy.maxHealth) {
        this.drawHealthBar(enemy.position.x, enemy.position.y - enemy.size - 10, enemy.health, enemy.maxHealth);
      }
    });
  }

  private drawFighter() {
    // Fighter classic design
    this.ctx.fillStyle = '#333333';
    this.ctx.strokeStyle = '#666666';
    this.ctx.lineWidth = 1;
    
    // Solar panels
    this.ctx.fillRect(-15, -10, 8, 20);
    this.ctx.fillRect(7, -10, 8, 20);
    this.ctx.strokeRect(-15, -10, 8, 20);
    this.ctx.strokeRect(7, -10, 8, 20);
    
    // Cockpit
    this.ctx.fillStyle = '#555555';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawInterceptor() {
    // Interceptor with angled panels
    this.ctx.fillStyle = '#222222';
    this.ctx.strokeStyle = '#555555';
    this.ctx.lineWidth = 1;
    
    // Angled solar panels
    this.ctx.beginPath();
    this.ctx.moveTo(-18, -12);
    this.ctx.lineTo(-8, -8);
    this.ctx.lineTo(-8, 8);
    this.ctx.lineTo(-18, 12);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.beginPath();
    this.ctx.moveTo(18, -12);
    this.ctx.lineTo(8, -8);
    this.ctx.lineTo(8, 8);
    this.ctx.lineTo(18, 12);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Cockpit
    this.ctx.fillStyle = '#444444';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawBomber() {
    // Bomber with double hull
    this.ctx.fillStyle = '#2a2a2a';
    this.ctx.strokeStyle = '#555555';
    this.ctx.lineWidth = 1;
    
    // Solar panels
    this.ctx.fillRect(-12, -8, 6, 16);
    this.ctx.fillRect(6, -8, 6, 16);
    this.ctx.strokeRect(-12, -8, 6, 16);
    this.ctx.strokeRect(6, -8, 6, 16);
    
    // Double cockpit pods
    this.ctx.fillStyle = '#444444';
    this.ctx.beginPath();
    this.ctx.arc(-3, 0, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.beginPath();
    this.ctx.arc(3, 0, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawStarDestroyer() {
    if (!this.starDestroyer.alive && this.phase !== 'victory') return;
    
    this.ctx.save();
    this.ctx.translate(this.starDestroyer.position.x, this.starDestroyer.position.y);
    
    // Main hull (triangular)
    this.ctx.fillStyle = '#666666';
    this.ctx.strokeStyle = '#999999';
    this.ctx.lineWidth = 2;
    
    this.ctx.beginPath();
    this.ctx.moveTo(0, -20);
    this.ctx.lineTo(-60, 80);
    this.ctx.lineTo(60, 80);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Command tower
    this.ctx.fillStyle = '#555555';
    this.ctx.fillRect(-15, 20, 30, 40);
    this.ctx.strokeRect(-15, 20, 30, 40);
    
    // Bridge
    this.ctx.fillStyle = '#888888';
    this.ctx.fillRect(-10, 15, 20, 10);
    this.ctx.strokeRect(-10, 15, 20, 10);
    
    // Weak points (if not destroyed)
    this.starDestroyer.weakPoints.forEach(wp => {
      if (!wp.destroyed) {
        this.ctx.fillStyle = '#FF4444';
        this.ctx.strokeStyle = '#FFAAAA';
        this.ctx.beginPath();
        this.ctx.arc(wp.x, wp.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        // Integrity ring shrinks as the weak point takes hits
        this.ctx.strokeStyle = '#FFAA00';
        this.ctx.beginPath();
        this.ctx.arc(wp.x, wp.y, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (wp.health / WEAK_POINT_HEALTH));
        this.ctx.stroke();
      }
    });
    
    this.ctx.restore();
    
    // Health bar
    this.drawHealthBar(this.starDestroyer.position.x, this.starDestroyer.position.y - 100, this.starDestroyer.health, this.starDestroyer.maxHealth);
  }

  private drawBullets() {
    this.bullets.forEach(bullet => {
      // Draw trail
      this.ctx.strokeStyle = bullet.color + '44';
      this.ctx.lineWidth = bullet.size;
      this.ctx.beginPath();
      bullet.trail.forEach((point, index) => {
        if (index === 0) {
          this.ctx.moveTo(point.x, point.y);
        } else {
          this.ctx.lineTo(point.x, point.y);
        }
      });
      this.ctx.stroke();
      
      // Draw bullet
      this.ctx.fillStyle = bullet.color;
      this.ctx.beginPath();
      this.ctx.arc(bullet.position.x, bullet.position.y, bullet.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private drawExplosions() {
    this.explosions.render(this.ctx, { core: true });
  }

  private drawHealthBar(x: number, y: number, health: number, maxHealth: number) {
    const width = 40;
    const height = 4;
    const healthPercent = health / maxHealth;
    
    this.ctx.fillStyle = '#333333';
    this.ctx.fillRect(x - width/2, y, width, height);
    
    this.ctx.fillStyle = healthPercent > 0.6 ? '#00FF00' : healthPercent > 0.3 ? '#FFFF00' : '#FF0000';
    this.ctx.fillRect(x - width/2, y, width * healthPercent, height);
  }

  getHudStats(): HudStat[] {
    if (!this.player) return [];
    const stats: HudStat[] = [
      { label: 'Health', meter: { value: Math.max(0, this.player.health), max: this.player.maxHealth } },
      { label: 'Shield', meter: { value: Math.max(0, this.player.shield), max: 100 } },
    ];
    if (this.phase === 'enemy-ships') {
      stats.push({ label: 'Enemies', value: this.TOTAL_ENEMIES - this.enemiesDestroyed });
    } else if (this.phase === 'star-destroyer') {
      const sd = this.starDestroyer;
      stats.push({ label: 'Vessel', meter: { value: Math.max(0, sd.health), max: sd.maxHealth }, tone: 'danger' });
      stats.push({ label: 'Weak Points', value: sd.weakPoints.filter(wp => !wp.destroyed).length });
    }
    const powers: Array<[string, number]> = [
      ['Rapid', this.rapidFireTimer], ['Spread', this.spreadTimer], ['Triple', this.tripleShotTimer],
      ['Guided', this.guidedMissileTimer], ['Speed', this.speedBoostTimer], ['Invincible', this.invincibleTimer],
    ];
    const active = powers.filter(([, frames]) => frames > 0);
    if (active.length > 0) {
      stats.push({ label: 'Power', value: active.map(([name, frames]) => `${name} ${Math.ceil(frames / 60)}s`).join(' · ') });
    }
    return stats;
  }

  private drawUI() {
    // Phase info
    if (this.phase === 'star-destroyer') {
      this.drawText('COMMAND VESSEL BATTLE', this.width / 2, 30, 20, '#FF4444', 'center');
      const weakPointsLeft = this.starDestroyer.weakPoints.filter(wp => !wp.destroyed).length;
      this.drawText(`Weak Points: ${weakPointsLeft}`, this.width / 2, 55, 14, '#FFAA00', 'center');
    } else if (this.phase === 'victory') {
      this.drawText('VICTORY! Enemy Fleet Retreats!', this.width / 2, this.height / 2, 24, '#00FF00', 'center');
    }
  }

  private drawTransition() {
    const alpha = 1 - (this.transitionTimer / TRANSITION_FRAMES);
    this.ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.7})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    if (this.phase === 'star-destroyer') {
      this.drawText('MASSIVE SHIP APPROACHING!', this.width / 2, this.height / 2, 24, '#FF4444', 'center');
      this.drawText('Prepare for the final battle!', this.width / 2, this.height / 2 + 30, 16, '#FFFFFF', 'center');
    }
  }

  /** Movement and held fire are polled from `keys` each update; a keydown only fires a quick Space tap. */
  handleInput(event: KeyboardEvent) {
    if (!this.player.alive || this.transitioning || this.phase === 'victory') return;
    if (event.code === 'Space') this.tryFire();
  }

  private shootPlayerBullet() {
    // Helper to fire a bullet at angle
    const fireAtAngle = (angle: number, guided = false, target?: { x: number; y: number }) => {
      const noseX = this.player.position.x + Math.cos(angle) * this.player.size;
      const noseY = this.player.position.y + Math.sin(angle) * this.player.size;
      const bulletSpeed = 14.4;
      const bullet: Bullet = {
        position: { x: noseX, y: noseY },
        velocity: { x: Math.cos(angle) * bulletSpeed, y: Math.sin(angle) * bulletSpeed },
        owner: 'player',
        size: 4,
        damage: 20,
        color: '#00FF00',
        trail: [],
        guided,
        target,
        lifetime: guided ? 500 : undefined // Guided missiles live longer
      };
      this.bullets.push(bullet);
    };

    // Triple shot takes precedence over spread shot
    if (this.tripleShotTimer > 0) {
      const a = this.player.rotation;
      fireAtAngle(a - 0.2);
      fireAtAngle(a);
      fireAtAngle(a + 0.2);
    } else if (this.spreadTimer > 0) {
      const a = this.player.rotation;
      fireAtAngle(a - 0.15);
      fireAtAngle(a);
      fireAtAngle(a + 0.15);
    } else {
      fireAtAngle(this.player.rotation);
    }

    // Add guided missile support
    if (this.guidedMissileTimer > 0) {
      // Find nearest enemy for guided missile
      let nearestEnemy: EnemyShip | StarDestroyer | null = null;
      let nearestDistance = Infinity;

      // Check enemy ships
      for (const enemy of this.enemies) {
        if (enemy.alive) {
          const dx = enemy.position.x - this.player.position.x;
          const dy = enemy.position.y - this.player.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestEnemy = enemy;
          }
        }
      }

      // Check command vessel if in final phase
      if (this.phase === 'star-destroyer' && this.starDestroyer.alive) {
        const dx = this.starDestroyer.position.x - this.player.position.x;
        const dy = this.starDestroyer.position.y - this.player.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < nearestDistance) {
          nearestEnemy = this.starDestroyer;
        }
      }

      if (nearestEnemy) {
        const angle = this.player.rotation;
        fireAtAngle(angle, true, nearestEnemy.position);
      }
    }

    // Play laser sound
    this.playLaserSound();
  }

  private playLaserSound() {
    this.playStinger('starwars_laser');
  }

  private playExplosionSound() {
    this.playStinger('starwars_explosion');
  }

  // Touch/pointer controls for mobile
  handlePointerDown(x: number, y: number) {
    if (!this.player.alive) return;

    // Enhanced touch controls - divide screen into zones
    const screenWidth = this.width;
    const screenHeight = this.height;

    // Left side: movement zone
    if (x < screenWidth * 0.4) {
      // Movement controls - store touch start for drag
      this.touchStartX = x;
      this.touchStartY = y;
      this.touchActive = true;
      this.lastTouchX = x;
      this.lastTouchY = y;
      return;
    }

    // Right side: shooting zone
    if (x > screenWidth * 0.6) {
      if (this.player.weaponCooldown <= 0) {
        this.shootPlayerBullet();
        // Reduced cooldown for better responsiveness on mobile
        this.player.weaponCooldown = this.rapidFireTimer > 0 ? 5 : 10;

        this.vibrate('hit');
      }
    }

    // Center zone: action button
    if (x >= screenWidth * 0.4 && x <= screenWidth * 0.6) {
      // Could add special action here if needed
    }
  }

  handlePointerMove(x: number, y: number) {
    if (!this.player.alive) return;

    // Enhanced touch movement - only respond if touch started in movement zone
    if (!this.touchActive) return;

    // Calculate drag distance and direction from initial touch point
    const deltaX = x - this.touchStartX;
    const deltaY = y - this.touchStartY;

    // Normalize to screen size for consistent movement
    const normalizedX = deltaX / (this.width * 0.3); // Scale to movement zone width
    const normalizedY = deltaY / (this.height * 0.3); // Scale to movement zone height

    // Calculate distance from start to determine movement intent
    const distanceFromStart = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const deadZone = 20; // Minimum drag distance before movement starts

    if (distanceFromStart > deadZone) {
      // Set target rotation based on drag direction
      this.player.targetRotation = Math.atan2(normalizedY, normalizedX);

      // Apply smooth thrust based on drag distance (further drag = more thrust)
      const maxThrust = TOUCH_THRUST;
      const thrustMultiplier = Math.min(1, distanceFromStart / (this.width * 0.15));
      const thrust = maxThrust * thrustMultiplier;

      this.player.velocity.x += Math.cos(this.player.targetRotation) * thrust;
      this.player.velocity.y += Math.sin(this.player.targetRotation) * thrust;

      // Apply friction to prevent excessive sliding
      this.player.velocity.x *= 0.95;
      this.player.velocity.y *= 0.95;

      // Limit velocity
      const currentSpeed = Math.sqrt(this.player.velocity.x ** 2 + this.player.velocity.y ** 2);
      if (currentSpeed > this.player.maxSpeed) {
        this.player.velocity.x = (this.player.velocity.x / currentSpeed) * this.player.maxSpeed;
        this.player.velocity.y = (this.player.velocity.y / currentSpeed) * this.player.maxSpeed;
      }
    }
  }

  handlePointerUp() {
    // Reset touch control state
    this.touchActive = false;

    // Apply some drag when touch ends to prevent abrupt stops
    this.player.velocity.x *= 0.7;
    this.player.velocity.y *= 0.7;
  }

  // Mobile-specific controls
  handleMobileMove(x: number, y: number) {
    // Convert virtual stick input to ship movement
    const thrust = TOUCH_THRUST;
    const maxSpeed = this.player.maxSpeed;
    
    // Apply thrust based on stick input
    this.player.velocity.x += x * thrust;
    this.player.velocity.y += y * thrust;
    
    // Update target rotation based on movement direction
    if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
      this.player.targetRotation = Math.atan2(y, x);
    }
    
    // Limit velocity to max speed
    const currentSpeed = Math.sqrt(this.player.velocity.x ** 2 + this.player.velocity.y ** 2);
    if (currentSpeed > maxSpeed) {
      this.player.velocity.x = (this.player.velocity.x / currentSpeed) * maxSpeed;
      this.player.velocity.y = (this.player.velocity.y / currentSpeed) * maxSpeed;
    }
  }

  handleMobileShoot(_x: number, _y: number) {
    if (!this.player.alive) return;
    
    if (this.player.weaponCooldown <= 0) {
      this.shootPlayerBullet();
      this.player.weaponCooldown = FIRE_COOLDOWN;
    }
  }

  handleMobileAction() {
    // Mobile action button - shoot
    this.handleMobileShoot(0, 0);
  }
}
