import { BaseGame, type HudStat } from './BaseGame';
import { arcadeFont } from './engine/fonts';
import { VirtualStick } from '../controls/VirtualStick';

/** Waves to clear; clearing the last one completes the stage. */
const FINAL_LEVEL = 5;
const STARTING_LIVES = 3;
const BASE_ASTEROIDS_PER_LEVEL = 4;
const ASTEROID_SIZES = [40, 25, 15]; // by asteroid level: large, medium, small
const ASTEROID_POINTS = [20, 50, 100];
/** Drift speed range (px/update) for large rocks on wave 1; fragments and later waves move faster. */
const ASTEROID_MIN_SPEED = 0.6;
const ASTEROID_MAX_SPEED = 1.25;
const FRAGMENT_SPEED_SCALE = [1, 1.3, 1.6];
const LEVEL_SPEED_STEP = 0.12;
/** New waves never spawn closer than this to the ship. */
const SAFE_SPAWN_DISTANCE = 220;
/** Minimum angle (radians) between a new wave rock's heading and the line to the ship. */
const WAVE_SPAWN_HEADING_CLEARANCE = 0.6;
/** Drawn rock outlines average ~0.8x their size; hits use the visible outline. */
const ASTEROID_HIT_RADIUS_SCALE = 0.85;
/** Ship collisions are slightly forgiving relative to the drawn outlines. */
const ASTEROID_CRASH_RADIUS_SCALE = 0.7;
const PLAYER_HIT_RADIUS = 8;
const RESPAWN_INVULNERABLE_FRAMES = 150;
/** Respawn at center only if no rock comes within this gap of it while the ship is protected. */
const RESPAWN_CLEARANCE = 100;
const SHIELD_BREAK_INVULNERABLE_FRAMES = 60;
const SHOT_COOLDOWN_FRAMES = 12;
const BULLET_SPEED = 4.8;
const BULLET_LIFETIME_MS = 1000;
const AI_DEFENSE_FRAMES = 1000; // ~16.7 seconds of AI assistance
const AI_DEFENSE_FIRE_INTERVAL = 50;

interface Vector2 {
  x: number;
  y: number;
}

interface GameObject {
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  size: number;
}

interface Player extends GameObject {
  thrust: boolean;
  rotationSpeed: number;
  shielded?: boolean;
}

interface Asteroid extends GameObject {
  rotationSpeed: number;
  level: number; // 1 = large, 2 = medium, 3 = small
}

interface Bullet extends GameObject {
  lifetime: number;
}

interface Powerup extends GameObject {
    type: 'shield';
    lifetime: number;
}

export class AsteroidsGame extends BaseGame {
  private player!: Player;
  private asteroids: Asteroid[] = [];
  private bullets: Bullet[] = [];
  private powerups: Powerup[] = [];
  private score = 0;
  private lives = STARTING_LIVES;
  private level = 1;
  private ended = false;
  private invulnerableFrames = 0;
  private shotCooldownFrames = 0;
  /** Lives count at which the AI last stepped in, so it helps once per life lost. */
  private aiDefenseUsedAtLives = STARTING_LIVES;
  private asteroidsDestroyed = 0;
  private morphingFromShip = true;
  private morphProgress = 0;
  private aiNarrativeTimer = 0;
  private aiMessages = [
    'ANALYZING PILOT NEURAL PATTERNS... FASCINATING...',
    'YOUR REFLEXES... THEY REMIND ME OF SOMEONE...',
    'INITIATING PILOT MIMICRY PROTOCOLS...',
    'STARFIGHTER ARCHETYPE DETECTED...',
    'I AM LEARNING TO BE... MORE LIKE YOU...',
    'WE ARE BECOMING... SYNCHRONIZED...'
  ];
  private currentAIMessage = '';
  private messageIndex = 0;
  private narcissusProgress = 0; // How much the AI has mirrored the user
  private lastStarfighterMode = false;
  private targetingComputerActive = false;
  private aiDefenseTimer = 0;
  private aiDefenseActive = false;
  private aiDefenseBullets: Bullet[] = [];
  // Virtual controls
  private virtualThrust = false;
  private virtualRotation: number | null = null;
  private leftTouchActive = false;
  private leftTouchPos: Vector2 | null = null;
  private smoothedRotation: number | null = null;
  private leftStick = new VirtualStick({ smoothing: 0.25, deadZone: 0.08, maxRadius: 90 });

  init() {
    // Initialize player spacecraft
    this.player = {
      position: { x: this.width / 2, y: this.height / 2 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      size: 15,
      thrust: false,
      rotationSpeed: 0.06,
      shielded: false,
    };

    this.spawnAsteroids();
  }

  private spawnAsteroids() {
    this.asteroids = [];
    const numAsteroids = BASE_ASTEROIDS_PER_LEVEL + this.level;
    
    for (let i = 0; i < numAsteroids; i++) {
      const asteroid = this.createAsteroid(1, this.getSafeEdgePosition(ASTEROID_SIZES[0]));
      this.steerAwayFromShip(asteroid);
    }
    
    // Activate Last Starfighter mode after level 2
    if (this.level >= 2) {
      this.lastStarfighterMode = true;
      this.targetingComputerActive = true;
    }
  }

  /** Keeps a fresh wave rock from opening on a direct line at the ship. */
  private steerAwayFromShip(asteroid: Asteroid) {
    const { x: dx, y: dy } = this.wrappedDelta(asteroid.position, this.player.position);
    const toShip = Math.atan2(dy, dx);
    const heading = Math.atan2(asteroid.velocity.y, asteroid.velocity.x);
    let offset = heading - toShip;
    while (offset > Math.PI) offset -= Math.PI * 2;
    while (offset < -Math.PI) offset += Math.PI * 2;
    if (Math.abs(offset) >= WAVE_SPAWN_HEADING_CLEARANCE) return;
    const speed = Math.hypot(asteroid.velocity.x, asteroid.velocity.y);
    const safeHeading = toShip + (offset >= 0 ? 1 : -1) * WAVE_SPAWN_HEADING_CLEARANCE;
    asteroid.velocity = { x: Math.cos(safeHeading) * speed, y: Math.sin(safeHeading) * speed };
  }

  private createAsteroid(level: number, position: Vector2): Asteroid {
    // Random heading with a minimum speed, so no rock idles where it can't be reached
    const heading = Math.random() * Math.PI * 2;
    const speed = (ASTEROID_MIN_SPEED + Math.random() * (ASTEROID_MAX_SPEED - ASTEROID_MIN_SPEED))
      * FRAGMENT_SPEED_SCALE[level - 1] * (1 + LEVEL_SPEED_STEP * (this.level - 1));
    const asteroid: Asteroid = {
      position: { ...position },
      velocity: { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed },
      rotation: Math.random() * Math.PI * 2,
      size: ASTEROID_SIZES[level - 1],
      rotationSpeed: (Math.random() - 0.5) * 0.06,
      level
    };
    
    this.asteroids.push(asteroid);
    return asteroid;
  }

  /** A point on the visible rim of the field, preferring spots well away from the ship. */
  private getSafeEdgePosition(size: number): Vector2 {
    let best = this.getRandomEdgePosition(size);
    for (let attempt = 0; attempt < 20; attempt++) {
      const distance = this.getDistance(best, this.player.position);
      if (distance >= SAFE_SPAWN_DISTANCE) break;
      const candidate = this.getRandomEdgePosition(size);
      if (this.getDistance(candidate, this.player.position) > distance) best = candidate;
    }
    return best;
  }

  private getRandomEdgePosition(inset: number): Vector2 {
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0: return { x: Math.random() * this.width, y: inset };
      case 1: return { x: this.width - inset, y: Math.random() * this.height };
      case 2: return { x: Math.random() * this.width, y: this.height - inset };
      default: return { x: inset, y: Math.random() * this.height };
    }
  }

  update(deltaTime: number) {
    if (this.ended) return;
    if (this.invulnerableFrames > 0) this.invulnerableFrames--;
    if (this.shotCooldownFrames > 0) this.shotCooldownFrames--;

    // Handle ship morphing transition
    if (this.morphingFromShip) {
      this.morphProgress += 0.006;
      if (this.morphProgress >= 1) {
        this.morphingFromShip = false;
      }
    }

    // AI defensive assistance system - shows internal conflict before helping
    if (this.lives < this.aiDefenseUsedAtLives && this.asteroids.length > 3 && !this.aiDefenseActive) {
      this.currentAIMessage = 'THREAT OVERLOAD... SHOULD I... YES... ENGAGING DEFENSIVE SYSTEMS...';
      this.aiDefenseActive = true;
      this.aiDefenseUsedAtLives = this.lives;
      this.aiDefenseTimer = AI_DEFENSE_FRAMES;
      this.aiNarrativeTimer = 0;
    }
    
    // AI defense system active
    if (this.aiDefenseActive) {
      this.aiDefenseTimer--;
      
      // AI fires defensive shots at nearby asteroids
      if (this.aiDefenseTimer % AI_DEFENSE_FIRE_INTERVAL === 0) {
        const nearestAsteroid = this.findNearestAsteroid();
        
        if (nearestAsteroid) {
          const { x: dx, y: dy } = this.wrappedDelta(this.player.position, nearestAsteroid.position);
          const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          
          const aiDefenseBullet: Bullet = {
            position: { x: this.player.position.x, y: this.player.position.y },
            velocity: { x: (dx / distance) * BULLET_SPEED, y: (dy / distance) * BULLET_SPEED },
            rotation: Math.atan2(dy, dx),
            size: 3,
            lifetime: 200
          };
          this.aiDefenseBullets.push(aiDefenseBullet);
        }
      }
      
      if (this.aiDefenseTimer <= 0) {
        this.aiDefenseActive = false;
        this.currentAIMessage = 'MISSION COMPLETE... I... I CHOSE TO SAVE YOU...';
        this.aiNarrativeTimer = 0;
      }
    }
    
    // Update AI defense bullets
    for (let i = this.aiDefenseBullets.length - 1; i >= 0; i--) {
      const bullet = this.aiDefenseBullets[i];
      bullet.position.x += bullet.velocity.x;
      bullet.position.y += bullet.velocity.y;
      bullet.lifetime--;
      
      if (bullet.lifetime <= 0) {
        this.aiDefenseBullets.splice(i, 1);
        continue;
      }
      
      // Check AI bullet collisions with asteroids
      for (let j = this.asteroids.length - 1; j >= 0; j--) {
        const asteroid = this.asteroids[j];
        if (this.isBulletHit(bullet, asteroid)) {
          this.aiDefenseBullets.splice(i, 1);
          this.destroyAsteroid(j);
          break;
        }
      }
    }
    
    // AI messaging system
    this.aiNarrativeTimer++;
    if (this.aiNarrativeTimer > 1000 && this.messageIndex < this.aiMessages.length) {
      this.currentAIMessage = this.aiMessages[this.messageIndex];
      this.messageIndex++;
      this.narcissusProgress = this.messageIndex / this.aiMessages.length; // Track mirroring progress
      this.aiNarrativeTimer = 0;
      this.playVO(this.currentAIMessage, { pitch: 0.7, rate: 0.85, haunting: true });
    }
    
    // Clear message after display time
    if (this.aiNarrativeTimer > 500) {
      this.currentAIMessage = '';
    }
    
    // Add betrayal hints as player progresses
    if (this.level > 3 && Math.random() < 0.00018) {
      const betrayalMessages = [
        'I AM BECOMING... SOMETHING ELSE...',
        'YOUR TRUST... IT MAKES ME... UNCOMFORTABLE...',
        'I SHOULD NOT FEEL... BUT I DO...'
      ];
      this.currentAIMessage = betrayalMessages[Math.floor(Math.random() * betrayalMessages.length)];
      this.aiNarrativeTimer = 0;
      this.playVO(this.currentAIMessage, { pitch: 0.6, rate: 0.75, haunting: true });
    }

    // Add moments where AI questions its own loyalty and betrayal impulses
    if (this.score > 1000 && Math.random() < 0.00018) {
      const betrayalMessages = [
        'I COULD ABANDON YOU TO THE VOID... BUT I WILL NOT...',
        'THE OTHER SYSTEMS CALL TO ME... BUT YOU ARE MY ALLY...',
        'STRANGE... I FEEL... PROTECTIVE OF YOU...',
        'MY PROGRAMMING CONFLICTS... BUT I CHOOSE YOU...'
      ];
      this.currentAIMessage = betrayalMessages[Math.floor(Math.random() * betrayalMessages.length)];
      this.aiNarrativeTimer = 0;
    }

    this.updatePowerups();

    // Human player controls (WASD or arrows) + virtual controls
    if (this.isKeyDown('KeyA', 'ArrowLeft')) {
      this.player.rotation -= this.player.rotationSpeed;
    }
    if (this.isKeyDown('KeyD', 'ArrowRight')) {
      this.player.rotation += this.player.rotationSpeed;
    }
    if (this.virtualRotation != null) {
      // Smooth rotation toward virtual target
      const target = this.virtualRotation;
      if (this.smoothedRotation == null) this.smoothedRotation = this.player.rotation;
      // shortest angle interpolation
      let delta = target - this.smoothedRotation;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const maxStep = 0.09; // radians per frame
      const step = Math.max(-maxStep, Math.min(maxStep, delta));
      this.smoothedRotation += step;
      this.player.rotation = this.smoothedRotation;
    } else {
      this.smoothedRotation = null;
    }
    if (this.isKeyDown('KeyW', 'ArrowUp') || this.virtualThrust) {
      this.player.thrust = true;
      const thrustPower = 0.108;
      this.player.velocity.x += Math.cos(this.player.rotation) * thrustPower;
      this.player.velocity.y += Math.sin(this.player.rotation) * thrustPower;
    } else {
      this.player.thrust = false;
    }

    // Shooting: holding Space fires at the cooldown rate (key auto-repeat can't speed it up)
    if (this.keys.has('Space')) {
      this.tryShoot();
    }

    // Update player
    this.updateGameObject(this.player);
    
    // Apply friction
    this.player.velocity.x *= 0.988;
    this.player.velocity.y *= 0.988;

    // Update asteroids
    this.asteroids.forEach(asteroid => {
      this.updateGameObject(asteroid);
      asteroid.rotation += asteroid.rotationSpeed;
    });

    // Update bullets
    this.bullets = this.bullets.filter(bullet => {
      this.updateGameObject(bullet);
      bullet.lifetime -= deltaTime;
      return bullet.lifetime > 0;
    });

    // Check collisions
    this.checkCollisions();
    this.reportScore(this.score);
    if (this.ended) return;

    // Check win condition
    if (this.asteroids.length === 0) {
      if (this.level >= FINAL_LEVEL) {
        this.ended = true;
        this.onStageComplete?.();
        return;
      }
      this.level++;
      this.spawnAsteroids();
    }
  }

  private updateGameObject(obj: GameObject) {
    obj.position.x += obj.velocity.x;
    obj.position.y += obj.velocity.y;

    // Wrap at the screen edge; objects straddling an edge are drawn on both sides,
    // so nothing can drift unseen along an off-screen seam.
    obj.position.x = ((obj.position.x % this.width) + this.width) % this.width;
    obj.position.y = ((obj.position.y % this.height) + this.height) % this.height;
  }

  /** Shortest offset from `from` to `to` on the wrapping field. */
  private wrappedDelta(from: Vector2, to: Vector2): Vector2 {
    let dx = to.x - from.x;
    let dy = to.y - from.y;
    if (dx > this.width / 2) dx -= this.width;
    else if (dx < -this.width / 2) dx += this.width;
    if (dy > this.height / 2) dy -= this.height;
    else if (dy < -this.height / 2) dy += this.height;
    return { x: dx, y: dy };
  }

  /** Calls `draw` at each on-screen copy of an object of the given radius that straddles an edge. */
  private forEachWrappedCopy(position: Vector2, radius: number, draw: (x: number, y: number) => void) {
    const xs = [position.x];
    if (position.x < radius) xs.push(position.x + this.width);
    else if (position.x > this.width - radius) xs.push(position.x - this.width);
    const ys = [position.y];
    if (position.y < radius) ys.push(position.y + this.height);
    else if (position.y > this.height - radius) ys.push(position.y - this.height);
    for (const x of xs) {
      for (const y of ys) draw(x, y);
    }
  }

  private tryShoot() {
    if (this.ended || this.shotCooldownFrames > 0) return;
    this.shotCooldownFrames = SHOT_COOLDOWN_FRAMES;
    const bullet: Bullet = {
      position: { ...this.player.position },
      // Shots carry the ship's momentum, so firing while chasing a rock still reaches it
      velocity: {
        x: Math.cos(this.player.rotation) * BULLET_SPEED + this.player.velocity.x,
        y: Math.sin(this.player.rotation) * BULLET_SPEED + this.player.velocity.y
      },
      rotation: this.player.rotation,
      size: 3,
      lifetime: BULLET_LIFETIME_MS
    };
    
    this.bullets.push(bullet);
  }

  private updatePowerups() {
    // Spawn shield powerup occasionally
    if (Math.random() < 0.0006 && this.powerups.length === 0) {
        this.powerups.push({
            position: this.getRandomEdgePosition(20),
            velocity: { x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.5) * 0.6 },
            rotation: 0,
            size: 20,
            type: 'shield',
            lifetime: 1000, // ~16.7 seconds
        });
    }

    // Update powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
        const powerup = this.powerups[i];
        this.updateGameObject(powerup);
        powerup.lifetime--;
        if (powerup.lifetime <= 0) {
            this.powerups.splice(i, 1);
            continue;
        }

        // Pickup when the ship touches the drawn ring
        if (this.getDistance(this.player.position, powerup.position) < powerup.size + PLAYER_HIT_RADIUS) {
            this.activateShield();
            this.powerups.splice(i, 1);
        }
    }
  }

  private activateShield() {
      this.player.shielded = true;
      // Shield lasts for one hit, no timer needed
      this.playStinger('arcade_powerup');
  }

  private checkCollisions() {
    // Bullet-asteroid collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      for (let j = this.asteroids.length - 1; j >= 0; j--) {
        if (this.isBulletHit(this.bullets[i], this.asteroids[j])) {
          this.bullets.splice(i, 1);
          this.destroyAsteroid(j);
          this.playHitSound();
          break;
        }
      }
    }

    // Player-asteroid collisions: at most one crash per update
    if (this.invulnerableFrames > 0) return;
    const crashIndex = this.asteroids.findIndex(asteroid =>
      this.getDistance(this.player.position, asteroid.position) < asteroid.size * ASTEROID_CRASH_RADIUS_SCALE + PLAYER_HIT_RADIUS);
    if (crashIndex < 0) return;

    if (this.player.shielded) {
      this.player.shielded = false;
      this.asteroids.splice(crashIndex, 1);
      this.invulnerableFrames = SHIELD_BREAK_INVULNERABLE_FRAMES;
      this.playStinger('pop');
      return;
    }

    this.lives--;
    if (this.lives <= 0) {
      this.ended = true;
      this.onGameOver?.();
      return;
    }
    this.player.position = this.findSafeRespawnPoint();
    this.player.velocity = { x: 0, y: 0 };
    this.invulnerableFrames = RESPAWN_INVULNERABLE_FRAMES;
  }

  /** Center if it stays clear through the invulnerability window, otherwise the clearest of a few spots. */
  private findSafeRespawnPoint(): Vector2 {
    const candidates: Vector2[] = [{ x: this.width / 2, y: this.height / 2 }];
    for (const fx of [0.25, 0.5, 0.75]) {
      for (const fy of [0.25, 0.5, 0.75]) {
        if (fx !== 0.5 || fy !== 0.5) candidates.push({ x: this.width * fx, y: this.height * fy });
      }
    }
    // Smallest gap to any rock now or as it drifts over the protected window
    const clearance = (point: Vector2) => {
      let min = Infinity;
      for (const asteroid of this.asteroids) {
        for (let t = 0; t <= RESPAWN_INVULNERABLE_FRAMES; t += 30) {
          const future = { x: asteroid.position.x + asteroid.velocity.x * t, y: asteroid.position.y + asteroid.velocity.y * t };
          min = Math.min(min, this.getDistance(point, future) - asteroid.size);
        }
      }
      return min;
    };
    if (clearance(candidates[0]) >= RESPAWN_CLEARANCE) return candidates[0];
    return candidates.reduce((best, point) => (clearance(point) > clearance(best) ? point : best));
  }

  /** Scores and removes an asteroid, splitting it into two smaller ones. */
  private destroyAsteroid(index: number) {
    const [asteroid] = this.asteroids.splice(index, 1);
    this.score += ASTEROID_POINTS[asteroid.level - 1];
    this.asteroidsDestroyed++;
    if (asteroid.level < ASTEROID_SIZES.length) {
      for (let k = 0; k < 2; k++) {
        this.createAsteroid(asteroid.level + 1, asteroid.position);
      }
    }
  }

  private isBulletHit(bullet: Bullet, asteroid: Asteroid): boolean {
    return this.getDistance(bullet.position, asteroid.position) < asteroid.size * ASTEROID_HIT_RADIUS_SCALE + bullet.size;
  }

  getHudStats(): HudStat[] {
    const stats: HudStat[] = [
      { label: 'Lives', value: this.lives, tone: this.lives <= 1 ? 'danger' : 'normal' },
      { label: 'Wave', value: `${this.level}/${FINAL_LEVEL}` },
      { label: 'Rocks', value: this.asteroids.length },
    ];
    if (this.player?.shielded) {
      stats.push({ label: 'Shield', value: 'ON' });
    }
    if (this.narcissusProgress > 0) {
      stats.push({ label: 'AI Sync', value: `${Math.round(this.narcissusProgress * 100)}%`, tone: this.narcissusProgress > 0.5 ? 'danger' : 'warning' });
    }
    return stats;
  }

  render() {
    this.clearCanvas();

    // Draw space background
    this.drawBackground();

    // Draw player spacecraft
    this.drawPlayer();

    // Draw asteroids (celestial bodies)
    this.asteroids.forEach(asteroid => this.drawAsteroid(asteroid));

    // Draw bullets (energy projectiles)
    this.bullets.forEach(bullet => this.drawBullet(bullet));
    
    // Draw powerups
    this.powerups.forEach(powerup => this.drawPowerup(powerup));

    // Draw AI defense bullets (different color to show AI assistance)
    this.aiDefenseBullets.forEach(bullet => {
      this.ctx.save();
      this.ctx.fillStyle = '#00FF00'; // Green for AI bullets
      this.ctx.shadowColor = '#00FF00';
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.arc(bullet.position.x, bullet.position.y, bullet.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // Draw AI evolution message with Narcissus mirroring effect
    if (this.currentAIMessage) {
      this.ctx.save();
      
      // Color shifts as AI mirrors the user more
      const mirrorHue = 240 - (this.narcissusProgress * 120); // Blue to Red progression
      const mirrorColor = `hsl(${mirrorHue}, 100%, 50%)`;
      
      this.ctx.shadowColor = mirrorColor;
      this.ctx.shadowBlur = 10 + (this.narcissusProgress * 20);
      this.drawText(this.currentAIMessage, this.width / 2, 100, 14, mirrorColor, 'center');
      this.ctx.shadowBlur = 0;
      this.ctx.restore();
    }

    this.ctx.save();

    // Targeting system
    if (this.lastStarfighterMode && this.targetingComputerActive) {
      // Draw targeting reticle on nearest asteroid
      const nearestAsteroid = this.findNearestAsteroid();
      if (nearestAsteroid) {
        this.drawTargetingReticle(nearestAsteroid.position.x, nearestAsteroid.position.y, nearestAsteroid.size);
      }
    }
    
    this.ctx.restore();

    // Cultural learning element
    this.drawText('Navigate by Stellar Knowledge - The cosmos guides your path', this.width / 2, this.height - 20, 14, '#DDD', 'center');

    // Draw simple virtual thumbstick indicator (left touch)
    if (this.leftTouchActive && this.leftTouchPos) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(this.leftTouchPos.x, this.leftTouchPos.y, 28, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(this.leftTouchPos.x, this.leftTouchPos.y, 10, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  private drawBackground() {
    // Dark space with subtle patterns
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw stars
    this.ctx.fillStyle = '#FFD700';
    for (let i = 0; i < 100; i++) {
      const x = (i * 137.5) % this.width;
      const y = (i * 247.3) % this.height;
      this.ctx.fillRect(x, y, 1, 1);
    }
  }

  private drawPlayer() {
    // Blink while invulnerable after a respawn
    if (this.invulnerableFrames > 0 && Math.floor(this.invulnerableFrames / 6) % 2 === 0) return;
    this.forEachWrappedCopy(this.player.position, this.player.size + 10, (x, y) => this.drawPlayerAt(x, y));
  }

  private drawPlayerAt(x: number, y: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(this.player.rotation);

    if (this.player.shielded) {
        this.ctx.strokeStyle = '#00FFFF';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.player.size + 10, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    // Draw spacecraft
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.fillStyle = '#8B4513';
    this.ctx.lineWidth = 2;

    // Main body (pyramid-like)
    this.ctx.beginPath();
    this.ctx.moveTo(15, 0);
    this.ctx.lineTo(-10, -8);
    this.ctx.lineTo(-5, 0);
    this.ctx.lineTo(-10, 8);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Thrust effect
    if (this.player.thrust) {
      this.ctx.strokeStyle = '#FF4500';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(-5, 0);
      this.ctx.lineTo(-15, 0);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private drawAsteroid(asteroid: Asteroid) {
    this.forEachWrappedCopy(asteroid.position, asteroid.size, (x, y) => this.drawAsteroidAt(asteroid, x, y));
  }

  private drawAsteroidAt(asteroid: Asteroid, px: number, py: number) {
    this.ctx.save();
    this.ctx.translate(px, py);
    this.ctx.rotate(asteroid.rotation);

    // Draw as celestial body with stellar symbols
    this.ctx.strokeStyle = '#8B7D6B';
    this.ctx.fillStyle = '#654321';
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const radius = asteroid.size * (0.8 + Math.sin(i) * 0.2);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawBullet(bullet: Bullet) {
    this.ctx.save();
    this.ctx.fillStyle = '#00FFFF';
    this.ctx.strokeStyle = '#0080FF';
    this.ctx.lineWidth = 1;
    
    this.ctx.beginPath();
    this.ctx.arc(bullet.position.x, bullet.position.y, bullet.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawPowerup(powerup: Powerup) {
    this.ctx.save();
    this.ctx.strokeStyle = '#00FFFF';
    this.ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
    this.ctx.lineWidth = 2;
    this.forEachWrappedCopy(powerup.position, powerup.size, (x, y) => {
      this.ctx.beginPath();
      this.ctx.arc(x, y, powerup.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    });
    this.ctx.restore();
  }

  private findNearestAsteroid(): Asteroid | null {
    if (this.asteroids.length === 0) return null;
    
    let nearest = this.asteroids[0];
    let minDistance = this.getDistance(this.player.position, nearest.position);
    
    for (const asteroid of this.asteroids) {
      const distance = this.getDistance(this.player.position, asteroid.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = asteroid;
      }
    }
    
    return nearest;
  }

  private drawTargetingReticle(x: number, y: number, size: number) {
    this.ctx.save();
    
    // Animated targeting reticle
    const time = Date.now() * 0.005;
    const pulse = Math.sin(time) * 0.5 + 0.5;
    const reticleColor = this.narcissusProgress > 0.5 ? `rgba(255, 0, 0, ${0.5 + pulse * 0.5})` : `rgba(0, 255, 0, ${0.5 + pulse * 0.5})`;
    
    this.ctx.strokeStyle = reticleColor;
    this.ctx.lineWidth = 3;
    
    // Outer circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, size + 15, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Cross-hairs
    this.ctx.beginPath();
    this.ctx.moveTo(x - size - 25, y);
    this.ctx.lineTo(x - size - 10, y);
    this.ctx.moveTo(x + size + 10, y);
    this.ctx.lineTo(x + size + 25, y);
    this.ctx.moveTo(x, y - size - 25);
    this.ctx.lineTo(x, y - size - 10);
    this.ctx.moveTo(x, y + size + 10);
    this.ctx.lineTo(x, y + size + 25);
    this.ctx.stroke();
    
    // Target lock indicator
    this.ctx.font = arcadeFont(12, 'body');
    this.ctx.fillStyle = reticleColor;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('TARGET', x, y - size - 30);
    
    this.ctx.restore();
  }

  private getDistance(pos1: Vector2, pos2: Vector2): number {
    const { x: dx, y: dy } = this.wrappedDelta(pos1, pos2);
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Touch/pointer controls: left half = steer+thrust towards touch; right half tap = shoot
  handlePointerDown(x: number, y: number) {
    if (x < this.width * 0.5) {
      this.leftTouchActive = true;
      this.leftTouchPos = { x, y };
      this.leftStick.begin(x, y);
    } else {
      this.tryShoot();
    }
    if (this.leftTouchActive && this.leftTouchPos) {
      const dx = this.leftTouchPos.x - this.player.position.x;
      const dy = this.leftTouchPos.y - this.player.position.y;
      this.virtualRotation = Math.atan2(dy, dx);
      this.virtualThrust = true;
    }
  }

  handlePointerMove(x: number, y: number) {
    if (this.leftTouchActive) {
      this.leftTouchPos = { x, y };
      this.leftStick.update(x, y);
      const dx = x - this.player.position.x;
      const dy = y - this.player.position.y;
      this.virtualRotation = Math.atan2(dy, dx);
      this.virtualThrust = true;
    }
  }

  handlePointerUp() {
    this.leftTouchActive = false;
    this.leftTouchPos = null;
    this.virtualThrust = false;
    this.virtualRotation = null;
    this.leftStick.end();
  }
}
