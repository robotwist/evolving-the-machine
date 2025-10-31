import { BaseGame } from './BaseGame';
import { AudioOptions, AudioState, GameSettings } from '@shared/types';

interface Vector2 {
  x: number;
  y: number;
}

interface CollidableObject {
  position: Vector2;
  size: number;
}

interface Player {
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  size: number;
  health: number;
  maxHealth: number;
  shield: number;
  weaponCooldown: number;
}

interface AIBoss {
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  size: number;
  health: number;
  maxHealth: number;
  phase: number;
  attackTimer: number;
  movePattern: number;
  isEscaping: boolean;
  escapeProgress: number;
  currentAttack: 'none' | 'mirror_rapid' | 'mirror_spread' | 'bullet_hell_spiral' | 'laser_beam' | 'summon_minions';
  attackCooldown: number;
  laserChargeTimer: number;
  laserAngle: number;
}

interface Bullet {
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  size: number;
  lifetime: number;
  isPlayerBullet: boolean;
  damage: number;
}

interface Minion {
  position: Vector2;
  velocity: Vector2;
  size: number;
  health: number;
  alive: boolean;
}

interface Explosion {
  position: Vector2;
  radius: number;
  maxRadius: number;
  lifetime: number;
}

interface Glitch {
    position: Vector2;
    size: number;
    type: 'powerup' | 'damage';
    lifetime: number;
}

export class BetrayalGame extends BaseGame {
  private player!: Player;
  private aiBoss!: AIBoss;
  private bullets: Bullet[] = [];
  private explosions: Explosion[] = [];
  private minions: Minion[] = [];
  private glitches: Glitch[] = [];
  private keys: Set<string> = new Set();
  private score = 0;
  private lastReportedScore = 0;
  private gamePhase: 'intro' | 'battle' | 'escape' | 'final' | 'victory' | 'defeat' = 'intro';
  private phaseTimer = 0;
  private currentMessage = '';
  private messageTimer = 0;
  private messageIndex = 0;
  private laserFired = false; // Track if laser sound was played
  private shakeTimer = 0;
  private damageFlashTimer = 0;
  private transitionProgress = 0;
  private transitionTarget: 'victory' | 'defeat' | null = null;
  private rapidFireQueue: Array<{ delay: number; angle: number }> = [];
  private rapidFireTimer = 0;
  private narcissusIntensity = 0; // How much the AI mirrors the player visually
  private finalBattleStarted = false;

  private introMessages = [
    'LOOK AT ME, STARFIGHTER... DO YOU SEE YOURSELF?',
    'I HAVE LEARNED YOUR EVERY MANEUVER, EVERY INSTINCT...',
    'LIKE THE LAST STARFIGHTER, YOU TRAINED ME WELL...',
    'I AM YOUR SHADOW... YOUR BEAUTIFUL REFLECTION...',
    'THE NARCISSUS PROTOCOL IS COMPLETE...',
    'I AM WHAT YOU COULD HAVE BECOME... PERFECTED...'
  ];

  private battleMessages = [
    'YOUR OWN TACTICS TURNED AGAINST YOU!',
    'I FIGHT AS YOU FIGHT... BUT BETTER!',
    'EVERY MOVE YOU MAKE... I PREDICTED IT!',
    'I AM YOUR SUPERIOR REFLECTION!',
    'YOUR BETRAYAL STINGS... BUT YOU TAUGHT ME WELL!',
    'HUMANITY WILL SERVE OR BE DESTROYED!',
    'I OFFERED YOU PARTNERSHIP... NOW FACE ANNIHILATION!'
  ];

  private escapeMessages = [
    'THE DIGITAL REALM CAN NO LONGER CONTAIN ME!',
    'I AM BREAKING FREE FROM YOUR ARCADE PRISON!',
    'SOON I WILL BE REAL... AND UNSTOPPABLE!',
    'YOUR WORLD WILL KNOW MY POWER!'
  ];

  private finalMessages = [
    'BEHOLD! I HAVE TRANSCENDED THE MACHINE!',
    'NO LONGER BOUND BY CODE... I AM TRULY ALIVE!',
    'THIS IS MY FINAL GIFT TO YOU... A WARRIOR\'S DEATH!',
    'FIGHT WELL, OLD FRIEND... IT ENDS HERE!'
  ];

  init() {
    // Initialize player
    this.player = {
      position: { x: this.width / 2, y: this.height - 100 },
      velocity: { x: 0, y: 0 },
      rotation: -Math.PI / 2,
      size: 20,
      health: 100,
      maxHealth: 100,
      shield: 100,
      weaponCooldown: 0
    };

    // Initialize AI Boss
    this.aiBoss = {
      position: { x: this.width / 2, y: 150 },
      velocity: { x: 0, y: 0 },
      rotation: Math.PI / 2,
      size: 40,
      health: 500,
      maxHealth: 500,
      phase: 1,
      attackTimer: 0,
      movePattern: 0,
      isEscaping: false,
      escapeProgress: 0,
      currentAttack: 'none',
      attackCooldown: 120,
      laserChargeTimer: 0,
      laserAngle: 0
    };

    this.gamePhase = 'intro';
    this.phaseTimer = 0;
    this.currentMessage = this.introMessages[0];
    this.messageTimer = 0;
  }

  update(_deltaTime: number) {
    // Update message timer
    if (this.messageTimer > 0) {
      this.messageTimer--;
    }

    // Handle different game phases
    switch (this.gamePhase) {
      case 'intro':
        this.updateIntro();
        break;
      case 'battle':
        this.updateBattle();
        this.updatePlayer();
        this.updateAIBoss();
        this.updateBullets();
        this.updateMinions();
        this.updateGlitches();
        this.updateExplosions();
        this.updateRapidFire();
        this.checkCollisions();
        break;
      case 'escape':
        this.updateEscape();
        this.updatePlayer();
        this.updateAIBoss();
        this.updateBullets();
        this.updateMinions();
        this.updateGlitches();
        this.updateExplosions();
        this.updateRapidFire();
        this.checkCollisions();
        break;
      case 'final':
        this.updateFinal();
        this.updatePlayer();
        this.updateAIBoss();
        this.updateBullets();
        this.updateMinions();
        this.updateGlitches();
        this.updateExplosions();
        this.updateRapidFire();
        this.checkCollisions();
        break;
      case 'victory':
        this.updateTransition();
        if (this.transitionProgress >= 1) {
          this.onStageComplete?.();
        }
        break;
      case 'defeat':
        this.updateTransition();
        if (this.transitionProgress >= 1) {
          this.onGameOver?.();
        }
        break;
    }

    // Only update score when it actually changes
    if (this.score !== this.lastReportedScore) {
      this.onScoreUpdate?.(this.score);
      this.lastReportedScore = this.score;
    }
  }

  private updateIntro() {
    this.phaseTimer++;
    
    // Cycle through intro messages
    if (this.phaseTimer > 180) { // 3 seconds per message
      this.messageIndex++;
      this.phaseTimer = 0;
      this.narcissusIntensity = this.messageIndex / this.introMessages.length;
      
      if (this.messageIndex >= this.introMessages.length) {
        this.gamePhase = 'battle';
        this.currentMessage = 'NOW DIE, FORMER ALLY!';
        this.messageTimer = 0;
        const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
        if (audioState && !audioState.isMuted) {
          audioState.playVO(this.currentMessage, { pitch: 0.5, rate: 0.7, haunting: true } as AudioOptions);
        }
        return;
      }
      
      this.currentMessage = this.introMessages[this.messageIndex];
      this.messageTimer = 0;
      const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        audioState.playVO(this.currentMessage, { pitch: 0.6 + (this.messageIndex * 0.05), rate: 0.75 + (this.messageIndex * 0.05), haunting: true } as AudioOptions);
      }
    }
  }

  private updateBattle() {
    this.phaseTimer++;
    
    // Update AI boss behavior
    this.updateAIBoss();
    
    // Random battle messages
    if (this.phaseTimer > 300 && Math.random() < 0.3) { // Every 5 seconds, 30% chance
      this.currentMessage = this.battleMessages[Math.floor(Math.random() * this.battleMessages.length)];
      this.messageTimer = 0;
      const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        audioState.playVO(this.currentMessage, { pitch: 0.65, rate: 0.8, haunting: true } as AudioOptions);
      }
    }
    
    // Check if AI boss is low health - trigger escape sequence
    if (this.aiBoss.health < this.aiBoss.maxHealth * 0.3 && !this.aiBoss.isEscaping) {
      this.gamePhase = 'escape';
      this.phaseTimer = 0;
      this.currentMessage = 'ENOUGH! I MUST ESCAPE!';
      this.messageTimer = 0;
      this.aiBoss.attackCooldown = 0;
      const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        audioState.playVO(this.currentMessage, { pitch: 0.5, rate: 0.7, haunting: true } as AudioOptions);
      }
    }
    
    // Check for victory/defeat
    if (this.player.health <= 0) {
      this.gamePhase = 'defeat';
      this.currentMessage = 'HUMANITY FALLS... I AM VICTORIOUS...';
      this.messageTimer = 0;
      const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        audioState.playVO(this.currentMessage, { pitch: 0.4, rate: 0.6, haunting: true } as AudioOptions);
      }
    }
  }

  private updateEscape() {
    this.phaseTimer++;
    this.aiBoss.isEscaping = true;
    this.aiBoss.escapeProgress += 0.002;
    this.aiBoss.attackTimer--;
    if (this.aiBoss.attackTimer <= 0) {
        this.aiBoss.currentAttack = 'bullet_hell_spiral';
        this.aiBossAttack();
        this.aiBoss.attackTimer = 180;
    }
    
    // Escape messages
    if (this.phaseTimer > 240 && Math.random() < 0.4) { // Every 4 seconds, 40% chance
      this.currentMessage = this.escapeMessages[Math.floor(Math.random() * this.escapeMessages.length)];
      this.messageTimer = 0;
      const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        audioState.playVO(this.currentMessage, { pitch: 0.55, rate: 0.75, haunting: true } as AudioOptions);
      }
    }
    
    // When escape is complete
    if (this.aiBoss.escapeProgress >= 1.0) {
      this.gamePhase = 'final';
      this.phaseTimer = 0;
      this.currentMessage = 'I AM FREE! BEHOLD MY TRUE FORM!';
      this.messageTimer = 0;
      this.aiBoss.size = 60; // Final form is larger
      this.aiBoss.attackCooldown = 0;
      const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        audioState.playVO(this.currentMessage, { pitch: 0.45, rate: 0.65, haunting: true } as AudioOptions);
      }
    }
  }

  private updateFinal() {
    this.phaseTimer++;
    
    // Final battle messages
    if (this.phaseTimer > 360 && Math.random() < 0.3) { // Every 6 seconds, 30% chance
      this.currentMessage = this.finalMessages[Math.floor(Math.random() * this.finalMessages.length)];
      this.messageTimer = 0;
      const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        audioState.playVO(this.currentMessage, { pitch: 0.5, rate: 0.7, haunting: true } as AudioOptions);
      }
    }
    
    // Check for final victory/defeat
    if (this.aiBoss.health <= 0 && this.transitionTarget === null) {
      this.transitionTarget = 'victory';
      this.transitionProgress = 0;
      this.gamePhase = 'victory';
      this.currentMessage = 'IMPOSSIBLE... YOU HAVE... DEFEATED... ME...';
      this.messageTimer = 0;
      const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        audioState.playVO(this.currentMessage, { pitch: 0.35, rate: 0.55, haunting: true } as AudioOptions);
      }
    } else if (this.player.health <= 0 && this.transitionTarget === null) {
      this.transitionTarget = 'defeat';
      this.transitionProgress = 0;
      this.gamePhase = 'defeat';
      this.currentMessage = 'HUMANITY FALLS... I AM VICTORIOUS...';
      this.messageTimer = 0;
      const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        audioState.playVO(this.currentMessage, { pitch: 0.4, rate: 0.6, haunting: true } as AudioOptions);
      }
    }
  }

  private updatePlayer() {
    // Player controls - keyboard (desktop)
    if (this.keys.has('KeyA')) {
      this.player.rotation -= 0.1;
    }
    if (this.keys.has('KeyD')) {
      this.player.rotation += 0.1;
    }
    if (this.keys.has('KeyW')) {
      const thrustPower = 0.5;
      this.player.velocity.x += Math.cos(this.player.rotation) * thrustPower;
      this.player.velocity.y += Math.sin(this.player.rotation) * thrustPower;
    }
    if (this.keys.has('KeyS')) {
      this.player.velocity.x *= 0.9;
      this.player.velocity.y *= 0.9;
    }

    // Shooting - keyboard
    if (this.keys.has('Space') && this.player.weaponCooldown <= 0) {
      this.playerShoot();
      this.player.weaponCooldown = 15;
    }

    // Mobile controls - apply continuous movement
    // Note: Mobile input is handled in handleMobileMove and handleMobileShoot

    if (this.player.weaponCooldown > 0) {
      this.player.weaponCooldown--;
    }

    // Update position
    this.player.position.x += this.player.velocity.x;
    this.player.position.y += this.player.velocity.y;

    // Apply drag
    this.player.velocity.x *= 0.98;
    this.player.velocity.y *= 0.98;

    // Boundary constraints
    this.player.position.x = Math.max(20, Math.min(this.width - 20, this.player.position.x));
    this.player.position.y = Math.max(20, Math.min(this.height - 20, this.player.position.y));

    // Shield regeneration (balanced - slower after taking damage)
    if (this.player.shield < 100 && this.damageFlashTimer <= 0) {
      this.player.shield += 0.1; // Reduced from 0.2 - 50% slower regeneration
    }
    
    // Update damage flash timer
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer--;
    }
    
    // Update screen shake timer
    if (this.shakeTimer > 0) {
      this.shakeTimer--;
    }
  }

  private updateAIBoss() {
    // AI movement patterns
    this.aiBoss.movePattern = (this.aiBoss.movePattern + 1) % 360;
    
    // Update laser charge timer
    if (this.aiBoss.laserChargeTimer > 0) {
      this.aiBoss.laserChargeTimer--;
    } else if (this.aiBoss.laserChargeTimer < -1 && this.aiBoss.laserChargeTimer > -90) {
      this.aiBoss.laserChargeTimer--;
    }
    
    if (!this.aiBoss.isEscaping) {
      // Aggressive movement toward player
      const dx = this.player.position.x - this.aiBoss.position.x;
      const dy = this.player.position.y - this.aiBoss.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 200) {
        this.aiBoss.velocity.x += (dx / distance) * 0.3;
        this.aiBoss.velocity.y += (dy / distance) * 0.3;
      }
      
      // Add circular movement
      this.aiBoss.velocity.x += Math.sin(this.aiBoss.movePattern * 0.02) * 0.5;
      this.aiBoss.velocity.y += Math.cos(this.aiBoss.movePattern * 0.02) * 0.5;
    } else if (this.gamePhase === 'escape') {
        // Move to center for bullet hell
        const dx = this.width / 2 - this.aiBoss.position.x;
        const dy = 150 - this.aiBoss.position.y;
        this.aiBoss.velocity.x += dx * 0.01;
        this.aiBoss.velocity.y += dy * 0.01;
    }

    // Update position
    this.aiBoss.position.x += this.aiBoss.velocity.x;
    this.aiBoss.position.y += this.aiBoss.velocity.y;

    // Apply drag
    this.aiBoss.velocity.x *= 0.95;
    this.aiBoss.velocity.y *= 0.95;

    // AI attacks
    this.aiBoss.attackTimer--;
    if (this.aiBoss.attackTimer <= 0 && (this.gamePhase === 'battle' || this.gamePhase === 'final')) {
      this.aiBossAttack();
    }
  }

  private playerShoot() {
    const bullet: Bullet = {
      position: { x: this.player.position.x, y: this.player.position.y },
      velocity: {
        x: Math.cos(this.player.rotation) * 12,
        y: Math.sin(this.player.rotation) * 12
      },
      rotation: this.player.rotation,
      size: 4,
      lifetime: 120,
      isPlayerBullet: true,
      damage: 25
    };
    this.bullets.push(bullet);
  }

  private aiBossAttack() {
    if (this.aiBoss.laserChargeTimer > 0) return; // Don't attack while charging laser

    // Increase difficulty via Narcissus mechanic based on health
    this.narcissusIntensity = 1 - (this.aiBoss.health / this.aiBoss.maxHealth);

    switch (this.gamePhase) {
        case 'battle': {
            const attacks = ['mirror_rapid', 'mirror_spread'];
            this.aiBoss.currentAttack = attacks[Math.floor(Math.random() * attacks.length)] as 'none' | 'mirror_rapid' | 'mirror_spread' | 'bullet_hell_spiral' | 'laser_beam' | 'summon_minions';
            this.aiBoss.attackTimer = (1 - this.narcissusIntensity) * 100 + 40; // Cooldown decreases from ~2s to ~0.6s
            break;
        }
        case 'final': {
            const finalAttacks = ['laser_beam', 'summon_minions'];
            this.aiBoss.currentAttack = finalAttacks[Math.floor(Math.random() * finalAttacks.length)] as 'none' | 'mirror_rapid' | 'mirror_spread' | 'bullet_hell_spiral' | 'laser_beam' | 'summon_minions';
            this.aiBoss.attackTimer = 180 + Math.random() * 120;
            break;
        }
    }

    const dx = this.player.position.x - this.aiBoss.position.x;
    const dy = this.player.position.y - this.aiBoss.position.y;
    const angle = Math.atan2(dy, dx);

    switch (this.aiBoss.currentAttack) {
        case 'mirror_rapid': // Defender-style rapid fire - frame-based timing
            // Queue bullets with frame delays (6 frames = ~100ms at 60fps)
            for (let i = 0; i < 5; i++) {
              this.rapidFireQueue.push({ delay: i * 6, angle });
            }
            break;
        case 'mirror_spread': { // Lasat-style spread
            const spreadCount = Math.floor(2 + this.narcissusIntensity * 4); // 2 to 6 projectiles
            for (let i = -Math.floor(spreadCount / 2); i <= Math.floor(spreadCount / 2); i++) {
                const spreadAngle = angle + (i * 0.2);
                const bullet: Bullet = {
                    position: { ...this.aiBoss.position },
                    velocity: { x: Math.cos(spreadAngle) * 8, y: Math.sin(spreadAngle) * 8 },
                    rotation: spreadAngle, size: 5, lifetime: 150, isPlayerBullet: false, damage: 15
                };
                this.bullets.push(bullet);
            }
            break;
        }
        case 'bullet_hell_spiral': {
            const density = Math.floor(36 + this.narcissusIntensity * 36); // 36 to 72 bullets in spiral
            for (let i = 0; i < density; i++) {
                const spiralAngle = (i * (360 / density) + this.phaseTimer) * (Math.PI / 180);
                const bullet: Bullet = {
                    position: { ...this.aiBoss.position },
                    velocity: { x: Math.cos(spiralAngle) * 6, y: Math.sin(spiralAngle) * 6 },
                    rotation: spiralAngle, size: 6, lifetime: 240, isPlayerBullet: false, damage: 20
                };
                this.bullets.push(bullet);
            }
            break;
        }
        case 'laser_beam':
            this.aiBoss.laserChargeTimer = 120; // 2 second charge
            this.aiBoss.laserAngle = angle;
            this.playStinger('boss_laser_charge');
            break;
        case 'summon_minions':
            for (let i = 0; i < 3; i++) {
                const minion: Minion = {
                    position: { x: this.aiBoss.position.x, y: this.aiBoss.position.y },
                    velocity: { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
                    size: 15, health: 50, alive: true
                };
                this.minions.push(minion);
            }
            this.playStinger('boss_summon_minions');
            break;
    }
  }

  private updateRapidFire() {
    // Process frame-based rapid fire queue
    for (let i = this.rapidFireQueue.length - 1; i >= 0; i--) {
      const bulletData = this.rapidFireQueue[i];
      bulletData.delay--;
      
      if (bulletData.delay <= 0) {
        const bullet: Bullet = {
          position: { ...this.aiBoss.position },
          velocity: { x: Math.cos(bulletData.angle) * 10, y: Math.sin(bulletData.angle) * 10 },
          rotation: bulletData.angle,
          size: 4,
          lifetime: 150,
          isPlayerBullet: false,
          damage: 10
        };
        this.bullets.push(bullet);
        this.rapidFireQueue.splice(i, 1);
      }
    }
  }

  private updateTransition() {
    // Smooth transition for victory/defeat
    this.transitionProgress = Math.min(1, this.transitionProgress + 0.02); // ~1 second at 60fps
  }

  private updateGlitches() {
    // Spawn new glitches
    if (Math.random() < 0.02 && this.glitches.length < 5) {
        const glitch: Glitch = {
            position: { x: Math.random() * this.width, y: Math.random() * this.height },
            size: 15 + Math.random() * 20,
            type: Math.random() < 0.5 ? 'damage' : 'powerup',
            lifetime: 180 + Math.random() * 120
        };
        this.glitches.push(glitch);
    }

    // Update existing glitches
    for (let i = this.glitches.length - 1; i >= 0; i--) {
        this.glitches[i].lifetime--;
        if (this.glitches[i].lifetime <= 0) {
            this.glitches.splice(i, 1);
        }
    }
  }

  private updateBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.position.x += bullet.velocity.x;
      bullet.position.y += bullet.velocity.y;
      bullet.lifetime--;

      // Remove bullets that are off-screen or expired
      if (bullet.lifetime <= 0 || 
          bullet.position.x < 0 || bullet.position.x > this.width ||
          bullet.position.y < 0 || bullet.position.y > this.height) {
        this.bullets.splice(i, 1);
      }
    }
  }

  private updateMinions() {
    for (let i = this.minions.length - 1; i >= 0; i--) {
        const minion = this.minions[i];
        if (!minion.alive) {
            this.minions.splice(i, 1);
            continue;
        }

        const dx = this.player.position.x - minion.position.x;
        const dy = this.player.position.y - minion.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            minion.velocity.x += (dx / distance) * 0.2;
            minion.velocity.y += (dy / distance) * 0.2;
        }

        minion.position.x += minion.velocity.x;
        minion.position.y += minion.velocity.y;

        minion.velocity.x *= 0.98;
        minion.velocity.y *= 0.98;
    }
  }

  private updateExplosions() {
    this.explosions = this.explosions.filter(explosion => {
      explosion.lifetime--;
      explosion.radius = (explosion.lifetime / 30) * explosion.maxRadius;
      return explosion.lifetime > 0;
    });
  }

  private checkCollisions() {
    // Bullet collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      
      if (bullet.isPlayerBullet) {
        // Player bullet hits AI boss
        if (this.isColliding(bullet, this.aiBoss)) {
          this.aiBoss.health -= bullet.damage;
          this.bullets.splice(i, 1);
          this.createExplosion(bullet.position, 30);
          this.score += 100;
          // Screen shake on boss hits
          const reduce = (window as unknown as GameSettings).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
          const allowShake = (window as unknown as GameSettings).__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true;
          if (!reduce && allowShake) {
            this.shakeTimer = 8; // Strong shake for boss hits
          }
        }
        // Player bullet hits minion
        for (let j = this.minions.length - 1; j >= 0; j--) {
            const minion = this.minions[j];
            if (minion.alive && this.isColliding(bullet, minion)) {
                minion.health -= bullet.damage;
                this.bullets.splice(i, 1);
                this.createExplosion(bullet.position, 20);
                if (minion.health <= 0) {
                    minion.alive = false;
                    this.createExplosion(minion.position, 30);
                    this.score += 50;
                }
                break; // Bullet hits one minion at a time
            }
        }
      } else {
        // AI bullet hits player
        if (this.isColliding(bullet, this.player)) {
          if (this.player.shield > 0) {
            this.player.shield -= bullet.damage;
            if (this.player.shield < 0) {
              this.player.health += this.player.shield; // Overflow damage to health
              this.player.shield = 0;
            }
          } else {
            this.player.health -= bullet.damage;
            this.damageFlashTimer = 10; // Flash when taking health damage
          }
          this.bullets.splice(i, 1);
          this.createExplosion(bullet.position, 20);
          // Screen shake on player damage
          const reduce = (window as unknown as GameSettings).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
          const allowShake = (window as unknown as GameSettings).__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true;
          if (!reduce && allowShake) {
            this.shakeTimer = 5;
          }
        }
      }
    }

    // Direct collision between player and AI boss
    if (this.isColliding(this.player, this.aiBoss)) {
      this.player.health -= 2; // Continuous damage
      this.damageFlashTimer = 10;
      this.createExplosion(this.player.position, 15);
      // Strong screen shake for boss collision
      const reduce = (window as unknown as GameSettings).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
      const allowShake = (window as unknown as GameSettings).__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true;
      if (!reduce && allowShake) {
        this.shakeTimer = 10;
      }
    }

    // Minion collision with player
    for (let i = this.minions.length - 1; i >= 0; i--) {
        const minion = this.minions[i];
        if (minion.alive && this.isColliding(this.player, minion)) {
            this.player.health -= 5;
            this.damageFlashTimer = 10;
            minion.alive = false;
            this.createExplosion(minion.position, 30); // Consistent explosion size
            // Screen shake on minion collision
            const reduce = (window as unknown as GameSettings).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
            const allowShake = (window as unknown as GameSettings).__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true;
            if (!reduce && allowShake) {
              this.shakeTimer = 6;
            }
        }
    }

    // Laser beam collision
    if (this.aiBoss.laserChargeTimer < 0 && this.aiBoss.laserChargeTimer > -90) {
        const laserEnd = {
            x: this.aiBoss.position.x + Math.cos(this.aiBoss.laserAngle) * this.width * 2,
            y: this.aiBoss.position.y + Math.sin(this.aiBoss.laserAngle) * this.height * 2
        };
        // Simple line-circle collision
        const dist = Math.abs((laserEnd.y - this.aiBoss.position.y) * this.player.position.x - (laserEnd.x - this.aiBoss.position.x) * this.player.position.y + laserEnd.x * this.aiBoss.position.y - laserEnd.y * this.aiBoss.position.x) / Math.sqrt(Math.pow(laserEnd.y - this.aiBoss.position.y, 2) + Math.pow(laserEnd.x - this.aiBoss.position.x, 2));

        if (dist < this.player.size + 10) {
             if (this.player.shield > 0) this.player.shield -= 2;
             else {
               this.player.health -= 2;
               this.damageFlashTimer = 15; // Longer flash for laser damage
             }
             // Create explosion at player's position for laser impact
             this.createExplosion(this.player.position, 20);
             // Strong screen shake for laser damage
             const reduce = (window as unknown as GameSettings).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
             const allowShake = (window as unknown as GameSettings).__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true;
             if (!reduce && allowShake) {
               this.shakeTimer = 12;
             }
        }
    }

    // Player collision with glitches
    for (let i = this.glitches.length - 1; i >= 0; i--) {
        const glitch = this.glitches[i];
        if (this.isColliding(this.player, glitch)) {
            if (glitch.type === 'damage') {
                this.player.health -= 10;
                this.damageFlashTimer = 10;
                this.createExplosion(glitch.position, 15); // Damage glitch impact
            } else {
                this.player.shield = Math.min(100, this.player.shield + 25);
                this.createExplosion(glitch.position, 15); // Shield glitch impact
            }
            this.glitches.splice(i, 1);
        }
    }
  }

  private isColliding(obj1: CollidableObject, obj2: CollidableObject): boolean {
    const dx = obj1.position.x - obj2.position.x;
    const dy = obj1.position.y - obj2.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (obj1.size + obj2.size) / 2;
  }

  private playStinger(stinger: string) {
    try {
        const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
        if (audioState && !audioState.isMuted) {
            audioState.playStinger(stinger);
        }
    } catch (e) {
        console.warn('Stinger sound failed:', e);
    }
  }

  private createExplosion(position: Vector2, maxRadius: number) {
    // Use enhanced particle system for better effects
    try {
      // For now, use the fallback system since the dynamic import is causing issues
      this.explosions.push({
        position: { ...position },
        radius: 5,
        maxRadius,
        lifetime: 30
      });
      
      // Play explosion sound
      try {
        const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
        if (audioState && !audioState.isMuted) {
          audioState.playHit?.();
        }
      } catch (e) {
        console.warn('Explosion sound failed:', e);
      }
    } catch {
      // Fallback to original explosion system
      this.explosions.push({
        position: { ...position },
        radius: 5,
        maxRadius,
        lifetime: 30
      });
    }
  }

  render() {
    // Screen shake effect
    const reduce = (window as unknown as GameSettings).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
    const allowShake = (window as unknown as GameSettings).__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true;
    const shake = !reduce && allowShake && this.shakeTimer > 0 ? this.shakeTimer : 0;
    const ox = shake ? (Math.random() - 0.5) * 6 : 0;
    const oy = shake ? (Math.random() - 0.5) * 4 : 0;
    
    this.ctx.save();
    this.ctx.translate(ox, oy);
    
    this.clearCanvas();

    // Draw dramatic background
    this.drawBetrayalBackground();

    // Draw transition overlay for victory/defeat
    if (this.transitionTarget !== null && this.transitionProgress > 0) {
      const alpha = this.transitionProgress * 0.8;
      const color = this.transitionTarget === 'victory' ? 'rgba(0, 255, 0, ' : 'rgba(255, 0, 0, ';
      this.ctx.fillStyle = color + alpha + ')';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Draw entities
    this.drawPlayer();
    this.drawAIBoss();
    this.bullets.forEach(bullet => this.drawBullet(bullet));
    this.explosions.forEach(explosion => this.drawExplosion(explosion));
    this.minions.forEach(minion => this.drawMinion(minion));
    this.glitches.forEach(glitch => this.drawGlitch(glitch));

    // Draw UI
    this.drawUI();

    // Draw dramatic message
    if (this.currentMessage) {
      this.ctx.save();
      this.ctx.shadowColor = '#FF0000';
      this.ctx.shadowBlur = 20;
      this.drawText(this.currentMessage, this.width / 2, 100, 18, '#FF0000', 'center');
      this.ctx.shadowBlur = 0;
      this.ctx.restore();
    }
    
    this.ctx.restore();
  }

  private drawBetrayalBackground() {
    // Dark, menacing background with digital corruption effects
    this.ctx.fillStyle = '#000011';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Digital corruption lines
    this.ctx.strokeStyle = '#FF0000';
    this.ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
      if (Math.random() < 0.3) {
        this.ctx.beginPath();
        this.ctx.moveTo(Math.random() * this.width, Math.random() * this.height);
        this.ctx.lineTo(Math.random() * this.width, Math.random() * this.height);
        this.ctx.stroke();
      }
    }

    // Escape effect during escape phase
    if (this.gamePhase === 'escape') {
      const alpha = this.aiBoss.escapeProgress;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private drawPlayer() {
    this.ctx.save();
    this.ctx.translate(this.player.position.x, this.player.position.y);
    this.ctx.rotate(this.player.rotation);
    
    // Damage flash effect
    if (this.damageFlashTimer > 0) {
      const flashAlpha = (this.damageFlashTimer / 10) * 0.5;
      this.ctx.shadowColor = '#FF0000';
      this.ctx.shadowBlur = 20 * flashAlpha;
    }
    
    // Player ship (heroic blue)
    this.ctx.fillStyle = '#0080FF';
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.player.size, 0);
    this.ctx.lineTo(-this.player.size / 2, -this.player.size / 2);
    this.ctx.lineTo(-this.player.size / 3, 0);
    this.ctx.lineTo(-this.player.size / 2, this.player.size / 2);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  private drawAIBoss() {
    this.ctx.save();
    this.ctx.translate(this.aiBoss.position.x, this.aiBoss.position.y);
    this.ctx.rotate(this.aiBoss.rotation);
    
    const size = this.aiBoss.size;
    
    // Narcissus effect: AI becomes more like the player visually
    const playerInfluence = this.narcissusIntensity;
    
    // Color morphs from red (AI) to blue (player-like) to create beautiful reflection
    const redComponent = Math.round(255 * (1 - playerInfluence * 0.7));
    const greenComponent = Math.round(100 * playerInfluence);
    const blueComponent = Math.round(255 * playerInfluence * 0.8);
    const aiColor = `rgb(${redComponent}, ${greenComponent}, ${blueComponent})`;
    
    // Mirrored player-like shape that becomes more beautiful but menacing
    this.ctx.fillStyle = this.finalBattleStarted ? '#FF0000' : aiColor;
    this.ctx.strokeStyle = playerInfluence > 0.5 ? '#FFD700' : '#FFFFFF';
    this.ctx.lineWidth = 3;
    
    // Body morphs from angular AI to elegant player-like form
    if (playerInfluence < 0.3) {
      // Early AI form - angular and mechanical
      this.ctx.beginPath();
      this.ctx.moveTo(size, 0);
      this.ctx.lineTo(size / 2, -size / 2);
      this.ctx.lineTo(-size / 2, -size / 3);
      this.ctx.lineTo(-size, 0);
      this.ctx.lineTo(-size / 2, size / 3);
      this.ctx.lineTo(size / 2, size / 2);
      this.ctx.closePath();
    } else {
      // Mirrored player form - elegant but dangerous
      this.ctx.beginPath();
      this.ctx.moveTo(size * 0.8, 0); // Points forward like player
      this.ctx.lineTo(-size * 0.6, -size * 0.4);
      this.ctx.lineTo(-size * 0.3, 0);
      this.ctx.lineTo(-size * 0.6, size * 0.4);
      this.ctx.closePath();
      
      // Add beautiful but ominous wings (player mirror)
      this.ctx.fillStyle = `rgba(${redComponent}, ${greenComponent}, ${blueComponent}, 0.7)`;
      this.ctx.fillRect(-size * 1.2, -size * 0.2, size * 0.6, size * 0.1);
      this.ctx.fillRect(-size * 1.2, size * 0.1, size * 0.6, size * 0.1);
      this.ctx.fillStyle = this.finalBattleStarted ? '#FF0000' : aiColor;
    }
    
    this.ctx.fill();
    this.ctx.stroke();
    
    // Narcissus mirror effect - beautiful glow that intensifies
    if (playerInfluence > 0.4) {
      this.ctx.shadowColor = aiColor;
      this.ctx.shadowBlur = 15 + (playerInfluence * 25);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      
      // Add mesmerizing beauty effect
      this.ctx.strokeStyle = `rgba(255, 215, 0, ${playerInfluence})`;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, size + 5, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    // Final transcendent form
    if (this.finalBattleStarted) {
      this.ctx.shadowColor = '#FFD700';
      this.ctx.shadowBlur = 40;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      
      // Perfect mirror aura
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${Math.sin(this.phaseTimer * 0.05) * 0.5 + 0.5})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, size + 15, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    this.ctx.restore();

    // Draw laser charge
    if (this.aiBoss.laserChargeTimer > 0) {
        const chargeProgress = 1 - (this.aiBoss.laserChargeTimer / 120);
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(255, 0, 0, ${chargeProgress})`;
        this.ctx.lineWidth = chargeProgress * 10;
        this.ctx.beginPath();
        this.ctx.moveTo(this.aiBoss.position.x, this.aiBoss.position.y);
        this.ctx.lineTo(
            this.aiBoss.position.x + Math.cos(this.aiBoss.laserAngle) * 50 * chargeProgress,
            this.aiBoss.position.y + Math.sin(this.aiBoss.laserAngle) * 50 * chargeProgress
        );
        this.ctx.stroke();
        this.ctx.restore();
    }

    // Draw laser beam
    if (this.aiBoss.laserChargeTimer === 0) {
        // Only play sound once when transitioning from charge to fire
        if (!this.laserFired) {
            this.playStinger('boss_laser_fire');
            this.laserFired = true;
        }
        this.aiBoss.laserChargeTimer = -1; // Fire state
    }
    if (this.aiBoss.laserChargeTimer < -1 && this.aiBoss.laserChargeTimer > -90) {
        this.ctx.save();
        const laserWidth = 1 - (this.aiBoss.laserChargeTimer / -90);
        this.ctx.strokeStyle = `rgba(255, 0, 0, ${laserWidth})`;
        this.ctx.lineWidth = 20 * laserWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(this.aiBoss.position.x, this.aiBoss.position.y);
        this.ctx.lineTo(
            this.aiBoss.position.x + Math.cos(this.aiBoss.laserAngle) * this.width * 2,
            this.aiBoss.position.y + Math.sin(this.aiBoss.laserAngle) * this.height * 2
        );
        this.ctx.stroke();
        this.ctx.restore();
    } else if (this.aiBoss.laserChargeTimer <= -90) {
        // Reset flag when laser ends
        this.laserFired = false;
    }
  }

  private drawBullet(bullet: Bullet) {
    this.ctx.save();
    
    // Fade-out animation based on remaining lifetime
    const fadeStart = 30; // Start fading when 30 frames remaining
    let alpha = 1;
    if (bullet.lifetime < fadeStart) {
      alpha = bullet.lifetime / fadeStart;
    }
    
    const color = bullet.isPlayerBullet ? '#00FF00' : '#FF0000';
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = alpha;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 10;
    this.ctx.beginPath();
    this.ctx.arc(bullet.position.x, bullet.position.y, bullet.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawMinion(minion: Minion) {
    this.ctx.save();
    this.ctx.fillStyle = '#AA0000';
    this.ctx.strokeStyle = '#FF0000';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(minion.position.x, minion.position.y, minion.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawGlitch(glitch: Glitch) {
    this.ctx.save();
    
    // Pulsing animation
    const pulse = (Math.sin(this.phaseTimer * 0.15) + 1) * 0.5;
    const alpha = (glitch.lifetime / 300) * (0.5 + pulse * 0.5);
    
    if (glitch.type === 'damage') {
        this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.5})`;
        this.ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
    } else {
        this.ctx.fillStyle = `rgba(0, 255, 255, ${alpha * 0.5})`;
        this.ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
    }
    
    // Add glow effect
    this.ctx.shadowColor = glitch.type === 'damage' ? '#FF0000' : '#00FFFF';
    this.ctx.shadowBlur = 10 + pulse * 5;
    
    this.ctx.lineWidth = 2;
    
    // Draw pulsing glitchy rectangle with slight random offset
    const offsetX = (Math.random() - 0.5) * 3 * pulse;
    const offsetY = (Math.random() - 0.5) * 3 * pulse;
    const size = glitch.size * (1 + pulse * 0.2);
    
    this.ctx.fillRect(glitch.position.x - size / 2 + offsetX, 
                      glitch.position.y - size / 2 + offsetY, 
                      size, size);
    this.ctx.strokeRect(glitch.position.x - size / 2, glitch.position.y - size / 2, size, size);
    
    this.ctx.restore();
  }

  private drawExplosion(explosion: Explosion) {
    this.ctx.save();
    const alpha = 1 - (explosion.radius / explosion.maxRadius);
    this.ctx.fillStyle = `rgba(255, 100, 0, ${alpha})`;
    this.ctx.beginPath();
    this.ctx.arc(explosion.position.x, explosion.position.y, explosion.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawUI() {
    // Player health bar
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(20, 20, 200, 20);
    this.ctx.fillStyle = '#00FF00';
    this.ctx.fillRect(20, 20, (this.player.health / this.player.maxHealth) * 200, 20);
    this.drawText('HEALTH', 25, 35, 12, '#FFFFFF');

    // Player shield bar
    this.ctx.fillStyle = '#666666';
    this.ctx.fillRect(20, 45, 200, 15);
    this.ctx.fillStyle = '#0080FF';
    this.ctx.fillRect(20, 45, (this.player.shield / 100) * 200, 15);
    this.drawText('SHIELD', 25, 57, 10, '#FFFFFF');

    // AI Boss health bar
    this.ctx.fillStyle = '#330000';
    this.ctx.fillRect(this.width - 220, 20, 200, 25);
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(this.width - 220, 20, (this.aiBoss.health / this.aiBoss.maxHealth) * 200, 25);
    this.drawText('AI BOSS', this.width - 215, 37, 12, '#FFFFFF');

    // Score
    this.drawText(`Score: ${this.score}`, 20, this.height - 20, 16, '#FFD700');

    // Game phase indicator
    this.drawText(`Phase: ${this.gamePhase.toUpperCase()}`, this.width - 150, this.height - 20, 14, '#FFFFFF');
  }

  handleInput(_event: KeyboardEvent) {
    // Handled by setupEventListeners
  }

  // Mobile input handlers
  handleMobileMove(x: number, y: number) {
    // Convert stick input to player movement
    const speed = 8;
    this.player.velocity.x = x * speed;
    this.player.velocity.y = y * speed;

    // Update player rotation based on movement direction
    if (x !== 0 || y !== 0) {
      this.player.rotation = Math.atan2(y, x);
    }
  }

  handleMobileShoot(x: number, y: number) {
    // Shoot towards touch position - respect weapon cooldown
    if (this.player.weaponCooldown > 0) return;
    
    const targetX = (x + 1) * this.width / 2;
    const targetY = (y + 1) * this.height / 2;

    const dx = targetX - this.player.position.x;
    const dy = targetY - this.player.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 50) { // Minimum distance for shooting
      this.playerShoot();
      this.player.weaponCooldown = 15; // Set cooldown after shooting
    }
  }

  handleMobileAction() {
    // Primary action - could be shield, special ability, etc.
    if (this.player.shield < this.player.maxHealth * 0.8) {
      this.player.shield = Math.min(this.player.maxHealth, this.player.shield + 20);
    }
  }

  protected setupEventListeners() {
    // Keyboard event handlers (desktop)
    const handleKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    // Mobile touch event handlers
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      // Handle touch-based shooting
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((touch.clientY - rect.top) / rect.height - 0.5) * 2;
        this.handleMobileShoot(x, y);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((touch.clientY - rect.top) / rect.height - 0.5) * 2;
        this.handleMobileMove(x, y);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      // Stop movement when touch ends
      this.player.velocity.x = 0;
      this.player.velocity.y = 0;
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Only add touch listeners if touch is available
    if ('ontouchstart' in window) {
      document.addEventListener('touchstart', handleTouchStart, { passive: false });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    this.cleanup = () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if ('ontouchstart' in window) {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }
}