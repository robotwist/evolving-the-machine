import { BaseGame } from './BaseGame';
import { ParticleSystem } from '../utils/ParticleSystem';
import { GameSettings, WindowExtensions } from '@shared/types';

interface Vector2 {
  x: number;
  y: number;
}

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
  type: 'invader' | 'bomber';
  shootTimer: number;
  health: number;
  maxHealth: number;
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
  private keys: Set<string> = new Set();
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
  private shakeTimer = 0;
  private playerShootCooldown = 0;
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
    const enemyCount = 5 + this.wave * 2;
    
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

      const enemy: Enemy = {
        position: {
          x: Math.random() * this.worldWidth,
          y: y
        },
        velocity: {
          x: (Math.random() - 0.5) * 2,
          y: 0
        },
        size: { x: 25, y: 15 },
        alive: true,
        type: Math.random() > 0.7 ? 'bomber' : 'invader',
        shootTimer: Math.random() * 60,
        health: Math.random() > 0.7 ? 150 : 75, // Bombers have more health
        maxHealth: Math.random() > 0.7 ? 150 : 75
      };
      
      this.enemies.push(enemy);
    }
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
    // Handle input
    this.handleMovement();

    // Update player
    this.updatePlayer();

    // Update enemies
    this.enemies.forEach(enemy => {
      if (enemy.alive) {
        this.updateEnemy(enemy);
      }
    });

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

    // Check collisions
    this.checkCollisions();

    // Update camera to follow player
    this.updateCamera();

    // Check wave completion
    if (this.enemies.filter(e => e.alive).length === 0) {
      this.wave++;
      this.spawnWave();
      if (this.wave > 10) { // Complete after 10 waves
        // Play success sound through window global
        const audioState = (window as unknown as WindowExtensions).__CULTURAL_ARCADE_AUDIO__;
        if (audioState && !audioState.isMuted) {
          audioState.playSuccess();
        }
      }
    }

    // Only update score when it actually changes to prevent infinite loop
    if (this.score !== this.lastScore) {
      this.onScoreUpdate?.(this.score);
      this.lastScore = this.score;
    }
  }

  private handleMovement() {
    const speed = 5;
    
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      this.player.velocity.x = -speed;
      this.player.direction = -1;
    } else if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      this.player.velocity.x = speed;
      this.player.direction = 1;
    } else {
      this.player.velocity.x *= 0.8; // Friction
    }

    if ((this.keys.has('KeyW') || this.keys.has('ArrowUp')) && this.player.onGround) {
      this.player.velocity.y = -12; // Increased jump height
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
        this.playerShootCooldown = 10; // 10 frame cooldown
      }
    }
  }

  private updatePlayer() {
    // Apply gravity
    if (!this.player.onGround) {
      this.player.velocity.y += 0.3;
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
    enemy.position.x += enemy.velocity.x;
    
    // Bounce off world boundaries
    if (enemy.position.x <= 0 || enemy.position.x >= this.worldWidth) {
      enemy.velocity.x = -enemy.velocity.x;
    }

    // Shoot at player occasionally
    enemy.shootTimer--;
    if (enemy.shootTimer <= 0) {
      this.shootEnemyBullet(enemy);
      enemy.shootTimer = 60 + Math.random() * 60;
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
      civilian.velocity.x = direction * 2;
    } else {
      civilian.velocity.x *= 0.9; // Slow down
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
    let bulletDx = this.player.direction * 8;
    let bulletDy = 0;

    // If player is jumping, give bullets upward trajectory
    if (!this.player.onGround && this.player.velocity.y < 0) {
      bulletDy = -4; // Slight upward angle when jumping
    } else if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      // If W/Up is pressed, shoot upward
      bulletDy = -6;
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
      lifetime: 120,
      damage: 25
    };
    
    this.playerBullets.push(bullet);
    this.playerShootCooldown = 5; // Set cooldown after shooting
    
    // Debug: log bullet creation
    console.log('Bullet created:', bullet.position, 'Velocity:', bullet.velocity, 'Total bullets:', this.playerBullets.length);
  }

  private shootEnemyBullet(enemy: Enemy) {
    const bullet: Projectile = {
      position: { ...enemy.position },
      velocity: { x: 0, y: 3 },
      size: { x: 3, y: 6 },
      alive: true,
      owner: 'enemy',
      lifetime: 200,
      damage: 15
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
      velocity: { x: 0, y: -8 }, // Straight up
      size: { x: 3, y: 8 }, // Taller bullet for vertical shots
      alive: true,
      owner: 'player',
      lifetime: 150, // Longer lifetime for vertical shots
      damage: 30 // More damage for vertical shots
    };
    
    this.playerBullets.push(bullet);
    this.playerShootCooldown = 8; // Slightly longer cooldown for vertical shots
    
    // Debug: log vertical bullet creation
    console.log('Vertical bullet created:', bullet.position, 'Velocity:', bullet.velocity);
  }

  private updateProjectiles() {
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
    if (Math.random() < 0.002 && this.powerups.length === 0) {
        this.powerups.push({
            position: { x: Math.random() * this.worldWidth, y: this.height / 2 },
            velocity: { x: 0, y: 0 },
            size: { x: 20, y: 20 },
            alive: true,
            type: 'shield',
            lifetime: 600, // 10 seconds
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

  private activateShield() {
      this.player.shielded = true;
      // Lasts for one hit
      this.playStinger('arcade_powerup');
  }

  private checkCollisions() {
    // Player bullets vs enemies
    this.playerBullets.forEach(bullet => {
      this.enemies.forEach(enemy => {
        if (enemy.alive && this.isColliding(bullet, enemy)) {
          // Apply damage instead of instant kill
          enemy.health -= bullet.damage;
          bullet.alive = false;
          
          // Effects
          const reduce = (window as unknown as GameSettings).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
          const allowShake = (window as unknown as GameSettings).__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true;
          const allowParticles = (window as unknown as GameSettings).__CULTURAL_ARCADE_PARTICLES__ ?? true;
          if (!reduce && allowShake) this.shakeTimer = 5;
          if (allowParticles && this.particles) this.particles.addExplosion(enemy.position.x, enemy.position.y, 12, '#FF4444', 'dramatic');
          this.playHitSound();
          
          // Check if enemy is destroyed
          if (enemy.health <= 0) {
            enemy.alive = false;
            this.score += enemy.type === 'bomber' ? 200 : 100;
            this.playExplosionSound();
            if (allowParticles && this.particles) this.particles.addExplosion(enemy.position.x, enemy.position.y, 25, '#FF0000', 'epic');
          }
        }
      });
    });

    // Enemy bullets vs player
    this.enemyBullets.forEach(bullet => {
      if (this.isColliding(bullet, this.player)) {
        if (this.player.shielded) {
            this.player.shielded = false;
            bullet.alive = false;
            this.playStinger('pop');
        } else {
            // Apply damage to player
            this.player.health -= bullet.damage;
            bullet.alive = false;
            
            // Effects
            const reduce = (window as unknown as GameSettings).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
            const allowShake = (window as unknown as GameSettings).__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true;
            const allowParticles = (window as unknown as GameSettings).__CULTURAL_ARCADE_PARTICLES__ ?? true;
            if (!reduce && allowShake) this.shakeTimer = 7;
            if (allowParticles && this.particles) this.particles.addExplosion(this.player.position.x, this.player.position.y, 20, '#FF0000', 'dramatic');
            this.playHitSound();
            
            // Check if player is destroyed
            if (this.player.health <= 0) {
              this.player.alive = false;
              this.onGameOver?.();
              this.playExplosionSound();
            }
        }
      }
      // Trails for enemy bullets
      const allowParticles = (window as unknown as GameSettings).__CULTURAL_ARCADE_PARTICLES__ ?? true;
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
        // Play success sound through window global
        const audioState = (window as unknown as WindowExtensions).__CULTURAL_ARCADE_AUDIO__;
        if (audioState && !audioState.isMuted) {
          audioState.playSuccess();
        }
      }
    });
  }

  private isColliding(obj1: Entity, obj2: Entity): boolean {
    return obj1.position.x < obj2.position.x + obj2.size.x &&
           obj1.position.x + obj1.size.x > obj2.position.x &&
           obj1.position.y < obj2.position.y + obj2.size.y &&
           obj1.position.y + obj1.size.y > obj2.position.y;
  }

  private findNearestEnemy(position: Vector2): Enemy | null {
    let nearest: Enemy | null = null;
    let minDistance = Infinity;
    
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
    // Follow player
    this.camera.x = this.player.position.x - this.width / 2;
    this.camera.x = Math.max(0, Math.min(this.worldWidth - this.width, this.camera.x));
  }

  render() {
    // screenshake
    const reduce = (window as unknown as GameSettings).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
    const allowShake = (window as unknown as GameSettings).__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true;
    const shake = !reduce && allowShake && this.shakeTimer > 0 ? this.shakeTimer : 0;
    if (shake > 0) this.shakeTimer--;
    const ox = shake ? (Math.random() - 0.5) * 6 : 0;
    const oy = shake ? (Math.random() - 0.5) * 4 : 0;
    this.ctx.save();
    this.ctx.translate(ox, oy);
    this.clearCanvas();

    // Save context for camera transform
    this.ctx.save();
    this.ctx.translate(-this.camera.x, 0);

    // Draw Japanese-inspired landscape
    this.drawJapaneseBackground();

    // Draw player (Samurai)
    this.drawPlayer();

    // Draw enemies
    this.enemies.forEach(enemy => {
      if (enemy.alive) {
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
    const allowParticles = (window as unknown as GameSettings).__CULTURAL_ARCADE_PARTICLES__ ?? true;
    if (allowParticles && this.particles) {
      this.particles.update();
      this.particles.render();
    }

    // Spooky vignette and fear aura overlays (Sinistar vibes)
    this.drawSpookyOverlays();

    // Draw UI (not affected by camera)
    this.drawUI();
  }

  private drawSpookyOverlays() {
    const reduce = (window as unknown as GameSettings).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
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
      if ((window as unknown as WindowExtensions).__CULTURAL_ARCADE_AUDIO__?.isMuted) return;
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

  private drawJapaneseBackground() {
    // Sky gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#FF6B6B');
    gradient.addColorStop(0.3, '#FFD93D');
    gradient.addColorStop(1, '#6BCF7F');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.worldWidth, this.height * 0.7);

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
    
    if (enemy.type === 'bomber') {
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

  private drawUI() {
    this.drawText(`Score: ${this.score}`, 20, 30, 20, '#FFD700');
    this.drawText(`Wave: ${this.wave}`, 20, 60, 20, '#FFD700');
    this.drawText(`Rescued: ${this.civiliansRescued}`, 20, 90, 20, '#FFD700');
    
    // Player health bar
    this.drawHealthBar(this.player, 20, 120);
    
    // Enemy health bars (for visible enemies)
    this.enemies.forEach((enemy, index) => {
      if (enemy.alive && enemy.health < enemy.maxHealth) {
        const screenX = enemy.position.x - this.camera.x;
        if (screenX >= 0 && screenX <= this.width) {
          this.drawEnemyHealthBar(enemy, screenX, enemy.position.y - 30);
        }
      }
    });
    
    // Cultural learning element
    this.drawText('Bushido Code: Protect the innocent with honor and courage', this.width / 2, this.height - 20, 14, '#FFF', 'center');
  }

  private drawHealthBar(entity: Player | Enemy, x: number, y: number) {
    const barWidth = 200;
    const barHeight = 20;
    const healthPercent = entity.health / entity.maxHealth;
    
    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(x, y, barWidth, barHeight);
    
    // Health bar
    const healthColor = healthPercent > 0.6 ? '#00FF00' : healthPercent > 0.3 ? '#FFD700' : '#FF0000';
    this.ctx.fillStyle = healthColor;
    this.ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
    
    // Border
    this.ctx.strokeStyle = '#FFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, barWidth, barHeight);
    
    // Text
    this.ctx.fillStyle = '#FFF';
    this.ctx.font = '14px monospace';
    this.ctx.textAlign = 'left';
    const label = 'health' in entity ? 'Player Health' : 'Enemy Health';
    this.ctx.fillText(`${label}: ${Math.round(entity.health)}/${entity.maxHealth}`, x, y - 5);
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
  }

  handlePointerUp() {
    // Remove movement keys when touch ends
    this.keys.delete('ArrowLeft');
    this.keys.delete('KeyA');
    this.keys.delete('ArrowRight');
    this.keys.delete('KeyD');
  }

  private playHitSound() {
    const audio = (window as unknown as WindowExtensions).__CULTURAL_ARCADE_AUDIO__;
    if (audio) {
      audio.playHit();
    }
  }

  private playShootSound() {
    try {
      const audioState = (window as unknown as WindowExtensions).__CULTURAL_ARCADE_AUDIO__;
      if (!audioState?.isMuted) {
        audioState?.playStinger('defender_shoot');
      }
    } catch (e) {
      console.warn('Shoot sound failed:', e);
    }
  }

  private playExplosionSound() {
    try {
      const audioState = (window as unknown as WindowExtensions).__CULTURAL_ARCADE_AUDIO__;
      if (!audioState?.isMuted) {
        audioState?.playStinger('defender_explosion');
      }
    } catch (e) {
      console.warn('Explosion sound failed:', e);
    }
  }

  private playStinger(stinger: string) {
    try {
        const audioState = (window as unknown as WindowExtensions).__CULTURAL_ARCADE_AUDIO__;
        if (audioState && !audioState.isMuted) {
            audioState.playStinger(stinger);
        }
    } catch (e) {
        console.warn(`${stinger} sound failed:`, e);
    }
  }

  protected setupEventListeners() {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (this.isRunning && !this.isPaused) {
        this.keys.add(e.code);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    this.cleanup = () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      this.stopWhispers();
    };
  }
}
