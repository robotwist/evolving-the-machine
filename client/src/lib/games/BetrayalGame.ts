import { BaseGame, type HudStat } from './BaseGame';
import { FlashExplosions } from './engine/FlashExplosions';

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

interface Glitch {
    position: Vector2;
    size: number;
    type: 'powerup' | 'damage';
    lifetime: number;
}

type DamageSource = 'bullet' | 'laser' | 'contact' | 'minion' | 'glitch';

// Timings are in 60 Hz updates
const INTRO_MESSAGE_FRAMES = 300;
/** A fire press skips to the next intro line once the current one has been up this long. */
const INTRO_SKIP_MIN_FRAMES = 45;
/** Breathing room after "NOW DIE" before the first attack and the first glitches. */
const BATTLE_OPENING_GRACE_FRAMES = 300;
/** Breathing room after the final form appears before it attacks. */
const FINAL_OPENING_GRACE_FRAMES = 150;
const TAUNT_MIN_INTERVAL_FRAMES = 420;
const TAUNT_INTERVAL_JITTER_FRAMES = 300;

const PLAYER_ROTATION_SPEED = 0.06;
const PLAYER_THRUST = 0.18;
const PLAYER_BRAKE = 0.939;
const PLAYER_DRAG = 0.988;
const PLAYER_WEAPON_COOLDOWN = 25;
const PLAYER_BULLET_SPEED = 7.2;
const PLAYER_BULLET_DAMAGE = 25;
const SHIELD_MAX = 100;
const SHIELD_REGEN_PER_FRAME = 0.04;
/** Shield regeneration waits this long after any hit. */
const SHIELD_REGEN_DELAY_FRAMES = 120;
const HEALTH_FLASH_FRAMES = 17;
const SHIELD_FLASH_FRAMES = 12;
const POINTER_STEER_SPEED = 4.8;
/** Pointer drags closer than this to the ship steer proportionally slower, so the ship settles under the finger. */
const POINTER_STEER_FULL_SPEED_DISTANCE = 120;
const MOBILE_SHIELD_BOOST = 20;
const MOBILE_SHIELD_BOOST_COOLDOWN_FRAMES = 600;

const BOSS_HEALTH = 800;
/** Battle attack cooldown shrinks from MIN + RAMP (full health) toward MIN as the boss is hurt. */
const BATTLE_ATTACK_MIN_FRAMES = 62;
const BATTLE_ATTACK_RAMP_FRAMES = 146;
/** Player shots hit anywhere on the drawn body, not just its core. */
const BOSS_HURT_RADIUS_SCALE = 0.8;
const BOSS_ARENA_MARGIN = 60;
const BOSS_CHASE_DISTANCE = 200;
const BOSS_CHASE_ACCEL = 0.108;
const BOSS_ORBIT_ACCEL = 0.18;
const BOSS_DRAG = 0.97;
const ESCAPE_HEALTH_FRACTION = 0.3;
const ESCAPE_PROGRESS_PER_FRAME = 0.0012;
const ESCAPE_SPIRAL_INTERVAL_FRAMES = 300;
const FINAL_FORM_HEALTH = 700;
const FINAL_FORM_SIZE = 60;
/** Floor on the mirror intensity (volley width) of the final form's attacks. */
const FINAL_MIN_NARCISSUS = 0.7;
const FINAL_HOVER_Y = 170;
const FINAL_HOVER_SPRING = 0.002;
const FINAL_ATTACK_MIN_FRAMES = 100;
const FINAL_ATTACK_JITTER_FRAMES = 80;
/** Final form attack pool: its signature laser and minions, plus everything it used before. */
const FINAL_ATTACKS = ['laser_beam', 'laser_beam', 'summon_minions', 'bullet_hell_spiral', 'mirror_spread', 'mirror_rapid'] as const;

const BOSS_CONTACT_DAMAGE = 12;
const BOSS_CONTACT_KNOCKBACK = 6;
/** Contact damage is applied per touch with this many i-frames, not every update. */
const CONTACT_INVULNERABLE_FRAMES = 45;
const MINION_CONTACT_DAMAGE = 5;

const LASER_CHARGE_FRAMES = 150;
const LASER_FIRE_FRAMES = 150;
const LASER_DAMAGE_PER_FRAME = 1.2;
const LASER_HALF_WIDTH = 10;
/** Once the fading beam is thinner than this fraction it no longer hurts. */
const LASER_MIN_HARMFUL_FADE = 0.15;

const GLITCH_SPAWN_CHANCE = 0.012;
const GLITCH_MAX = 5;
const GLITCH_DAMAGE = 10;
const GLITCH_SHIELD_BONUS = 25;
/** Glitches never materialise on top of the ship. */
const GLITCH_MIN_SPAWN_DISTANCE = 160;

const END_TRANSITION_STEP = 0.012;

export class BetrayalGame extends BaseGame {
  private player!: Player;
  private aiBoss!: AIBoss;
  private bullets: Bullet[] = [];
  private explosions = new FlashExplosions();
  private minions: Minion[] = [];
  private glitches: Glitch[] = [];
  private score = 0;
  private lastReportedScore = 0;
  private gamePhase: 'intro' | 'battle' | 'escape' | 'final' | 'victory' | 'defeat' = 'intro';
  private phaseTimer = 0;
  private currentMessage = '';
  private messageTimer = 0;
  private messageIndex = 0;
  private pointerHeld = false;
  private damageFlashTimer = 0;
  private shieldFlashTimer = 0;
  private invulnerableTimer = 0;
  private shieldRegenDelay = 0;
  private tauntTimer = 0;
  private mobileShieldCooldown = 0;
  private transitionProgress = 0;
  private transitionTarget: 'victory' | 'defeat' | null = null;
  private endCallbackFired = false;
  /** Damage taken per source this session, for tuning and the HUD. */
  private damageTaken: Record<DamageSource, number> = { bullet: 0, laser: 0, contact: 0, minion: 0, glitch: 0 };
  private rapidFireQueue: Array<{ delay: number; angle: number }> = [];
  private rapidFireTimer = 0;
  private narcissusIntensity = 0; // How much the AI mirrors the player visually
  private finalBattleStarted = false;

  private introMessages = [
    'LOOK AT ME, PILOT... DO YOU SEE YOURSELF?',
    'I HAVE LEARNED YOUR EVERY MANEUVER, EVERY INSTINCT...',
    'YOU TRAINED ME WELL...',
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
      shield: SHIELD_MAX,
      weaponCooldown: 0
    };

    // Initialize AI Boss
    this.aiBoss = {
      position: { x: this.width / 2, y: 150 },
      velocity: { x: 0, y: 0 },
      rotation: Math.PI / 2,
      size: 40,
      health: BOSS_HEALTH,
      maxHealth: BOSS_HEALTH,
      phase: 1,
      attackTimer: 0,
      movePattern: 0,
      isEscaping: false,
      escapeProgress: 0,
      currentAttack: 'none',
      attackCooldown: 200,
      laserChargeTimer: 0,
      laserAngle: 0
    };

    this.bullets = [];
    this.minions = [];
    this.glitches = [];
    this.rapidFireQueue = [];
    this.score = 0;
    this.gamePhase = 'intro';
    this.phaseTimer = 0;
    this.messageIndex = 0;
    this.narcissusIntensity = 0;
    this.finalBattleStarted = false;
    this.damageFlashTimer = 0;
    this.shieldFlashTimer = 0;
    this.invulnerableTimer = 0;
    this.shieldRegenDelay = 0;
    this.mobileShieldCooldown = 0;
    this.transitionProgress = 0;
    this.transitionTarget = null;
    this.endCallbackFired = false;
    this.damageTaken = { bullet: 0, laser: 0, contact: 0, minion: 0, glitch: 0 };
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
      case 'defeat':
        this.updateExplosions();
        this.updateTransition();
        if (this.transitionProgress >= 1 && !this.endCallbackFired) {
          this.endCallbackFired = true;
          if (this.gamePhase === 'victory') this.onStageComplete?.();
          else this.onGameOver?.();
        }
        break;
    }

    if (this.gamePhase === 'battle' || this.gamePhase === 'escape' || this.gamePhase === 'final') {
      this.checkEnd();
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
    if (this.phaseTimer > INTRO_MESSAGE_FRAMES) {
      this.advanceIntro();
    }
  }

  private advanceIntro() {
    this.messageIndex++;
    this.phaseTimer = 0;
    this.narcissusIntensity = this.messageIndex / this.introMessages.length;

    if (this.messageIndex >= this.introMessages.length) {
      this.gamePhase = 'battle';
      this.currentMessage = 'NOW DIE, FORMER ALLY!';
      this.messageTimer = 0;
      this.aiBoss.attackTimer = BATTLE_OPENING_GRACE_FRAMES;
      this.tauntTimer = TAUNT_MIN_INTERVAL_FRAMES;
      this.playVO(this.currentMessage, { pitch: 0.5, rate: 0.7, haunting: true });
      return;
    }

    this.currentMessage = this.introMessages[this.messageIndex];
    this.messageTimer = 0;
    this.playVO(this.currentMessage, { pitch: 0.6 + (this.messageIndex * 0.05), rate: 0.75 + (this.messageIndex * 0.05), haunting: true });
  }

  handleInput(event: KeyboardEvent) {
    if (this.gamePhase === 'intro' && event.code === 'Space' && !event.repeat) this.skipIntroLine();
  }

  private skipIntroLine() {
    if (this.phaseTimer >= INTRO_SKIP_MIN_FRAMES) this.advanceIntro();
  }

  /** Taunts are spaced out so each voice line can finish before the next. */
  private updateTaunts(lines: string[], options: { pitch: number; rate: number }) {
    if (--this.tauntTimer > 0) return;
    this.tauntTimer = TAUNT_MIN_INTERVAL_FRAMES + Math.random() * TAUNT_INTERVAL_JITTER_FRAMES;
    this.currentMessage = lines[Math.floor(Math.random() * lines.length)];
    this.messageTimer = 0;
    this.playVO(this.currentMessage, { ...options, haunting: true });
  }

  private updateBattle() {
    this.phaseTimer++;
    this.updateTaunts(this.battleMessages, { pitch: 0.65, rate: 0.8 });
    
    // Check if AI boss is low health - trigger escape sequence
    if (this.aiBoss.health < this.aiBoss.maxHealth * ESCAPE_HEALTH_FRACTION && !this.aiBoss.isEscaping) {
      this.gamePhase = 'escape';
      this.phaseTimer = 0;
      this.aiBoss.isEscaping = true;
      this.aiBoss.attackTimer = Math.min(this.aiBoss.attackTimer, 90);
      this.currentMessage = 'ENOUGH! I MUST ESCAPE!';
      this.messageTimer = 0;
      this.tauntTimer = TAUNT_MIN_INTERVAL_FRAMES;
      this.aiBoss.attackCooldown = 0;
      this.playVO(this.currentMessage, { pitch: 0.5, rate: 0.7, haunting: true });
    }
  }

  private updateEscape() {
    this.phaseTimer++;
    this.aiBoss.escapeProgress += ESCAPE_PROGRESS_PER_FRAME;
    this.aiBoss.attackTimer--;
    if (this.aiBoss.attackTimer <= 0) {
        this.aiBoss.currentAttack = 'bullet_hell_spiral';
        this.aiBossAttack();
        this.aiBoss.attackTimer = ESCAPE_SPIRAL_INTERVAL_FRAMES;
    }
    
    this.updateTaunts(this.escapeMessages, { pitch: 0.55, rate: 0.75 });
    
    // When escape is complete
    if (this.aiBoss.escapeProgress >= 1.0) {
      this.gamePhase = 'final';
      this.phaseTimer = 0;
      this.finalBattleStarted = true;
      this.currentMessage = 'I AM FREE! BEHOLD MY TRUE FORM!';
      this.messageTimer = 0;
      this.tauntTimer = TAUNT_MIN_INTERVAL_FRAMES;
      this.aiBoss.size = FINAL_FORM_SIZE;
      this.aiBoss.health = FINAL_FORM_HEALTH;
      this.aiBoss.maxHealth = FINAL_FORM_HEALTH;
      this.aiBoss.attackCooldown = 0;
      this.aiBoss.attackTimer = FINAL_OPENING_GRACE_FRAMES;
      this.playVO(this.currentMessage, { pitch: 0.45, rate: 0.65, haunting: true });
    }
  }

  private updateFinal() {
    this.phaseTimer++;
    this.updateTaunts(this.finalMessages, { pitch: 0.5, rate: 0.7 });
  }

  /** Defeat can happen in any combat phase; victory only once the final form falls. */
  private checkEnd() {
    if (this.transitionTarget !== null) return;
    if (this.player.health <= 0) {
      this.player.health = 0;
      this.beginEnd('defeat', 'HUMANITY FALLS... I AM VICTORIOUS...', { pitch: 0.4, rate: 0.6 });
    } else if (this.gamePhase === 'final' && this.aiBoss.health <= 0) {
      this.createExplosion(this.aiBoss.position, 90);
      this.beginEnd('victory', 'IMPOSSIBLE... YOU HAVE... DEFEATED... ME...', { pitch: 0.35, rate: 0.55 });
    }
  }

  private beginEnd(target: 'victory' | 'defeat', message: string, voice: { pitch: number; rate: number }) {
    this.transitionTarget = target;
    this.transitionProgress = 0;
    this.gamePhase = target;
    this.rapidFireQueue = [];
    this.aiBoss.laserChargeTimer = 0;
    this.keys.clear();
    this.currentMessage = message;
    this.messageTimer = 0;
    this.playVO(message, { ...voice, haunting: true });
  }

  private updatePlayer() {
    // Player controls - keyboard (WASD or arrows)
    if (this.isKeyDown('KeyA', 'ArrowLeft')) {
      this.player.rotation -= PLAYER_ROTATION_SPEED;
    }
    if (this.isKeyDown('KeyD', 'ArrowRight')) {
      this.player.rotation += PLAYER_ROTATION_SPEED;
    }
    if (this.isKeyDown('KeyW', 'ArrowUp')) {
      this.player.velocity.x += Math.cos(this.player.rotation) * PLAYER_THRUST;
      this.player.velocity.y += Math.sin(this.player.rotation) * PLAYER_THRUST;
    }
    if (this.isKeyDown('KeyS', 'ArrowDown')) {
      this.player.velocity.x *= PLAYER_BRAKE;
      this.player.velocity.y *= PLAYER_BRAKE;
    }

    // Shooting - keyboard
    if (this.keys.has('Space') && this.player.weaponCooldown <= 0) {
      this.playerShoot();
      this.player.weaponCooldown = PLAYER_WEAPON_COOLDOWN;
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
    this.player.velocity.x *= PLAYER_DRAG;
    this.player.velocity.y *= PLAYER_DRAG;

    // Boundary constraints
    this.player.position.x = Math.max(20, Math.min(this.width - 20, this.player.position.x));
    this.player.position.y = Math.max(20, Math.min(this.height - 20, this.player.position.y));

    if (this.shieldRegenDelay > 0) this.shieldRegenDelay--;
    else if (this.player.shield < SHIELD_MAX) {
      this.player.shield = Math.min(SHIELD_MAX, this.player.shield + SHIELD_REGEN_PER_FRAME);
    }
    
    if (this.damageFlashTimer > 0) this.damageFlashTimer--;
    if (this.shieldFlashTimer > 0) this.shieldFlashTimer--;
    if (this.invulnerableTimer > 0) this.invulnerableTimer--;
    if (this.mobileShieldCooldown > 0) this.mobileShieldCooldown--;
  }

  private isLaserCharging(): boolean {
    return this.aiBoss.laserChargeTimer > 0;
  }

  private isLaserFiring(): boolean {
    return this.aiBoss.laserChargeTimer < 0 && this.aiBoss.laserChargeTimer > -LASER_FIRE_FRAMES;
  }

  /** 1 when the beam opens, fading to 0 as the fire window closes. */
  private laserFade(): number {
    return 1 - this.aiBoss.laserChargeTimer / -LASER_FIRE_FRAMES;
  }

  /**
   * Laser state machine: charge counts down LASER_CHARGE_FRAMES..1 (telegraph), then the
   * beam fires from -1 down to -LASER_FIRE_FRAMES, where it rests until the next charge.
   */
  private updateLaser() {
    if (this.aiBoss.laserChargeTimer > 0) {
      this.aiBoss.laserChargeTimer--;
      if (this.aiBoss.laserChargeTimer === 0) {
        this.aiBoss.laserChargeTimer = -1;
        this.playStinger('boss_laser_fire');
        this.screenShake.trigger(6);
      }
    } else if (this.isLaserFiring()) {
      this.aiBoss.laserChargeTimer--;
    }
  }

  private updateAIBoss() {
    // AI movement patterns
    this.aiBoss.movePattern = (this.aiBoss.movePattern + 1) % 600;
    this.updateLaser();
    
    if (!this.aiBoss.isEscaping) {
      // Aggressive movement toward player
      const dx = this.player.position.x - this.aiBoss.position.x;
      const dy = this.player.position.y - this.aiBoss.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > BOSS_CHASE_DISTANCE) {
        this.aiBoss.velocity.x += (dx / distance) * BOSS_CHASE_ACCEL;
        this.aiBoss.velocity.y += (dy / distance) * BOSS_CHASE_ACCEL;
      }
      
      // Add circular movement
      this.aiBoss.velocity.x += Math.sin(this.aiBoss.movePattern * 0.012) * BOSS_ORBIT_ACCEL;
      this.aiBoss.velocity.y += Math.cos(this.aiBoss.movePattern * 0.012) * BOSS_ORBIT_ACCEL;
    } else if (this.gamePhase === 'escape') {
        // Move to center for bullet hell
        const dx = this.width / 2 - this.aiBoss.position.x;
        const dy = 150 - this.aiBoss.position.y;
        this.aiBoss.velocity.x += dx * 0.0036;
        this.aiBoss.velocity.y += dy * 0.0036;
    } else if (this.gamePhase === 'final' && !this.isLaserCharging() && !this.isLaserFiring()) {
        // The true form sways across the top of the arena, holding still to aim its laser
        const targetX = this.width / 2 + Math.sin(this.phaseTimer * 0.008) * this.width * 0.35;
        const targetY = FINAL_HOVER_Y + Math.sin(this.phaseTimer * 0.013) * 60;
        this.aiBoss.velocity.x += (targetX - this.aiBoss.position.x) * FINAL_HOVER_SPRING;
        this.aiBoss.velocity.y += (targetY - this.aiBoss.position.y) * FINAL_HOVER_SPRING;
    } else if (this.gamePhase === 'final') {
        this.aiBoss.velocity.x *= 0.85;
        this.aiBoss.velocity.y *= 0.85;
    }

    // Update position
    this.aiBoss.position.x += this.aiBoss.velocity.x;
    this.aiBoss.position.y += this.aiBoss.velocity.y;
    this.keepBossInArena();

    // Apply drag
    this.aiBoss.velocity.x *= BOSS_DRAG;
    this.aiBoss.velocity.y *= BOSS_DRAG;

    // AI attacks (the escape phase runs its own spiral timer)
    if (this.gamePhase === 'battle' || this.gamePhase === 'final') {
      this.aiBoss.attackTimer--;
      if (this.aiBoss.attackTimer <= 0) this.aiBossAttack();
    }
  }

  /** The boss bounces off the arena edges so it (and its bullets) always stay on screen. */
  private keepBossInArena() {
    const boss = this.aiBoss;
    const minX = BOSS_ARENA_MARGIN, maxX = this.width - BOSS_ARENA_MARGIN;
    const minY = BOSS_ARENA_MARGIN, maxY = this.height - BOSS_ARENA_MARGIN;
    if (boss.position.x < minX) { boss.position.x = minX; boss.velocity.x = Math.abs(boss.velocity.x) * 0.5; }
    if (boss.position.x > maxX) { boss.position.x = maxX; boss.velocity.x = -Math.abs(boss.velocity.x) * 0.5; }
    if (boss.position.y < minY) { boss.position.y = minY; boss.velocity.y = Math.abs(boss.velocity.y) * 0.5; }
    if (boss.position.y > maxY) { boss.position.y = maxY; boss.velocity.y = -Math.abs(boss.velocity.y) * 0.5; }
  }

  private playerShoot() {
    const bullet: Bullet = {
      position: { x: this.player.position.x, y: this.player.position.y },
      velocity: {
        x: Math.cos(this.player.rotation) * PLAYER_BULLET_SPEED,
        y: Math.sin(this.player.rotation) * PLAYER_BULLET_SPEED
      },
      rotation: this.player.rotation,
      size: 4,
      lifetime: 200,
      isPlayerBullet: true,
      damage: PLAYER_BULLET_DAMAGE
    };
    this.bullets.push(bullet);
  }

  private aiBossAttack() {
    // Never stack a new attack on top of a laser telegraph or beam
    if (this.isLaserCharging() || this.isLaserFiring()) return;

    // Increase difficulty via Narcissus mechanic based on health; the true form starts fully mirrored
    this.narcissusIntensity = 1 - (this.aiBoss.health / this.aiBoss.maxHealth);
    if (this.gamePhase === 'final') this.narcissusIntensity = Math.max(FINAL_MIN_NARCISSUS, this.narcissusIntensity);

    switch (this.gamePhase) {
        case 'battle': {
            const attacks = ['mirror_rapid', 'mirror_spread'];
            this.aiBoss.currentAttack = attacks[Math.floor(Math.random() * attacks.length)] as 'none' | 'mirror_rapid' | 'mirror_spread' | 'bullet_hell_spiral' | 'laser_beam' | 'summon_minions';
            this.aiBoss.attackTimer = (1 - this.narcissusIntensity) * BATTLE_ATTACK_RAMP_FRAMES + BATTLE_ATTACK_MIN_FRAMES;
            break;
        }
        case 'final': {
            this.aiBoss.currentAttack = FINAL_ATTACKS[Math.floor(Math.random() * FINAL_ATTACKS.length)];
            this.aiBoss.attackTimer = FINAL_ATTACK_MIN_FRAMES + Math.random() * FINAL_ATTACK_JITTER_FRAMES;
            // The laser's own charge and beam time doesn't count toward the next attack
            if (this.aiBoss.currentAttack === 'laser_beam') this.aiBoss.attackTimer += LASER_CHARGE_FRAMES + LASER_FIRE_FRAMES;
            break;
        }
    }

    const dx = this.player.position.x - this.aiBoss.position.x;
    const dy = this.player.position.y - this.aiBoss.position.y;
    const angle = Math.atan2(dy, dx);

    switch (this.aiBoss.currentAttack) {
        case 'mirror_rapid': // Defender-style rapid fire - frame-based timing
            // Queue bullets with frame delays (10 frames = ~167ms at 60fps)
            for (let i = 0; i < 5; i++) {
              this.rapidFireQueue.push({ delay: i * 10, angle });
            }
            break;
        case 'mirror_spread': { // Lasat-style spread
            const spreadCount = Math.floor(2 + this.narcissusIntensity * 4); // 2 to 6 projectiles
            for (let i = -Math.floor(spreadCount / 2); i <= Math.floor(spreadCount / 2); i++) {
                const spreadAngle = angle + (i * 0.2);
                const bullet: Bullet = {
                    position: { ...this.aiBoss.position },
                    velocity: { x: Math.cos(spreadAngle) * 4.8, y: Math.sin(spreadAngle) * 4.8 },
                    rotation: spreadAngle, size: 5, lifetime: 250, isPlayerBullet: false, damage: 15
                };
                this.bullets.push(bullet);
            }
            break;
        }
        case 'bullet_hell_spiral': {
            const density = Math.floor(36 + this.narcissusIntensity * 36); // 36 to 72 bullets in spiral
            for (let i = 0; i < density; i++) {
                const spiralAngle = (i * (360 / density) + this.phaseTimer * 0.6) * (Math.PI / 180);
                const bullet: Bullet = {
                    position: { ...this.aiBoss.position },
                    velocity: { x: Math.cos(spiralAngle) * 3.6, y: Math.sin(spiralAngle) * 3.6 },
                    rotation: spiralAngle, size: 6, lifetime: 400, isPlayerBullet: false, damage: 20
                };
                this.bullets.push(bullet);
            }
            break;
        }
        case 'laser_beam':
            this.aiBoss.laserChargeTimer = LASER_CHARGE_FRAMES;
            this.aiBoss.laserAngle = angle;
            this.playStinger('boss_laser_charge');
            break;
        case 'summon_minions':
            for (let i = 0; i < 3; i++) {
                const minion: Minion = {
                    position: { x: this.aiBoss.position.x, y: this.aiBoss.position.y },
                    velocity: { x: (Math.random() - 0.5) * 2.4, y: (Math.random() - 0.5) * 2.4 },
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
          velocity: { x: Math.cos(bulletData.angle) * 6, y: Math.sin(bulletData.angle) * 6 },
          rotation: bulletData.angle,
          size: 4,
          lifetime: 250,
          isPlayerBullet: false,
          damage: 10
        };
        this.bullets.push(bullet);
        this.rapidFireQueue.splice(i, 1);
      }
    }
  }

  private updateTransition() {
    // Smooth transition for victory/defeat, ~1.4 seconds
    this.transitionProgress = Math.min(1, this.transitionProgress + END_TRANSITION_STEP);
  }

  private updateGlitches() {
    const openingGrace = this.gamePhase === 'battle' && this.phaseTimer < BATTLE_OPENING_GRACE_FRAMES;
    if (!openingGrace && Math.random() < GLITCH_SPAWN_CHANCE && this.glitches.length < GLITCH_MAX) {
        const position = { x: Math.random() * this.width, y: Math.random() * this.height };
        const dx = position.x - this.player.position.x;
        const dy = position.y - this.player.position.y;
        if (dx * dx + dy * dy >= GLITCH_MIN_SPAWN_DISTANCE * GLITCH_MIN_SPAWN_DISTANCE) {
            this.glitches.push({
                position,
                size: 15 + Math.random() * 20,
                type: Math.random() < 0.5 ? 'damage' : 'powerup',
                lifetime: 300 + Math.random() * 200
            });
        }
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
            minion.velocity.x += (dx / distance) * 0.072;
            minion.velocity.y += (dy / distance) * 0.072;
        }

        minion.position.x += minion.velocity.x;
        minion.position.y += minion.velocity.y;

        minion.velocity.x *= 0.988;
        minion.velocity.y *= 0.988;
    }
  }

  private updateExplosions() {
    this.explosions.update();
  }

  private checkCollisions() {
    // Bullet collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];

      if (bullet.isPlayerBullet) {
        // The boss phases out of reach while it is escaping
        if (this.gamePhase !== 'escape' && this.distance(bullet, this.aiBoss) < this.aiBoss.size * BOSS_HURT_RADIUS_SCALE + bullet.size / 2) {
          this.aiBoss.health -= bullet.damage;
          this.bullets.splice(i, 1);
          this.createExplosion(bullet.position, 30);
          this.score += 100;
          this.screenShake.trigger(8);
          continue;
        }
        for (const minion of this.minions) {
          if (minion.alive && this.distance(bullet, minion) < minion.size + bullet.size / 2) {
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
      } else if (this.isColliding(bullet, this.player)) {
        this.applyDamage(bullet.damage, 'bullet');
        this.bullets.splice(i, 1);
        this.createExplosion(bullet.position, 20);
        this.screenShake.trigger(5);
      }
    }

    // Touching the boss hurts once per touch and shoves the ship clear
    if (this.isColliding(this.player, this.aiBoss) && this.invulnerableTimer <= 0) {
      this.applyDamage(BOSS_CONTACT_DAMAGE, 'contact', true);
      this.invulnerableTimer = CONTACT_INVULNERABLE_FRAMES;
      const dx = this.player.position.x - this.aiBoss.position.x;
      const dy = this.player.position.y - this.aiBoss.position.y;
      const d = Math.hypot(dx, dy) || 1;
      this.player.velocity.x = (dx / d) * BOSS_CONTACT_KNOCKBACK;
      this.player.velocity.y = (dy / d) * BOSS_CONTACT_KNOCKBACK;
      this.createExplosion(this.player.position, 15);
      this.screenShake.trigger(10);
    }

    // Minion collision with player
    for (const minion of this.minions) {
      if (minion.alive && this.isColliding(this.player, minion)) {
        this.applyDamage(MINION_CONTACT_DAMAGE, 'minion', true);
        minion.alive = false;
        this.createExplosion(minion.position, 30);
        this.screenShake.trigger(6);
      }
    }

    // Laser beam collision: the beam is a ray from the boss, as thick as it is drawn
    if (this.isLaserFiring()) {
      const fade = this.laserFade();
      if (fade > LASER_MIN_HARMFUL_FADE) {
        const dist = this.distanceToRay(this.player.position, this.aiBoss.position, this.aiBoss.laserAngle);
        if (dist < this.player.size / 2 + LASER_HALF_WIDTH * fade) {
          this.applyDamage(LASER_DAMAGE_PER_FRAME, 'laser');
          if (this.aiBoss.laserChargeTimer % 8 === 0) this.createExplosion(this.player.position, 20);
          this.screenShake.trigger(12);
        }
      }
    }

    // Player collision with glitches
    for (let i = this.glitches.length - 1; i >= 0; i--) {
      const glitch = this.glitches[i];
      if (this.isColliding(this.player, glitch)) {
        if (glitch.type === 'damage') {
          this.applyDamage(GLITCH_DAMAGE, 'glitch', true);
        } else {
          this.player.shield = Math.min(SHIELD_MAX, this.player.shield + GLITCH_SHIELD_BONUS);
          this.shieldFlashTimer = SHIELD_FLASH_FRAMES;
        }
        this.createExplosion(glitch.position, 15);
        this.glitches.splice(i, 1);
      }
    }
  }

  /** Shields soak damage first (overflow reaches the hull); some hazards strike the hull directly. */
  private applyDamage(amount: number, source: DamageSource, bypassShield = false) {
    this.damageTaken[source] += amount;
    this.shieldRegenDelay = SHIELD_REGEN_DELAY_FRAMES;
    let toHealth = amount;
    if (!bypassShield && this.player.shield > 0) {
      const absorbed = Math.min(this.player.shield, amount);
      this.player.shield -= absorbed;
      toHealth -= absorbed;
      this.shieldFlashTimer = SHIELD_FLASH_FRAMES;
    }
    if (toHealth > 0) {
      this.player.health -= toHealth;
      this.damageFlashTimer = HEALTH_FLASH_FRAMES;
    }
  }

  private distance(a: CollidableObject, b: CollidableObject): number {
    return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
  }

  private distanceToRay(point: Vector2, origin: Vector2, angle: number): number {
    const dirX = Math.cos(angle), dirY = Math.sin(angle);
    const along = Math.max(0, (point.x - origin.x) * dirX + (point.y - origin.y) * dirY);
    return Math.hypot(point.x - (origin.x + dirX * along), point.y - (origin.y + dirY * along));
  }

  private isColliding(obj1: CollidableObject, obj2: CollidableObject): boolean {
    const dx = obj1.position.x - obj2.position.x;
    const dy = obj1.position.y - obj2.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (obj1.size + obj2.size) / 2;
  }

  private createExplosion(position: Vector2, maxRadius: number) {
    this.explosions.spawn(position.x, position.y, maxRadius);
    this.playHitSound();
  }

  render() {
    this.clearCanvas();
    this.screenShake.begin();

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
    this.explosions.render(this.ctx);
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
    
    this.screenShake.end();
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
      const flashAlpha = (this.damageFlashTimer / 17) * 0.5;
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

    // Shield bubble flashes when a hit is soaked by the shield
    if (this.shieldFlashTimer > 0) {
      this.ctx.strokeStyle = `rgba(0, 255, 255, ${this.shieldFlashTimer / SHIELD_FLASH_FRAMES})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.player.size * 1.2, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  private drawAIBoss() {
    this.ctx.save();
    if (this.gamePhase === 'escape') {
      // Flickering out of phase: shots pass straight through
      this.ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.phaseTimer * 0.4);
    }
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
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${Math.sin(this.phaseTimer * 0.03) * 0.5 + 0.5})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, size + 15, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    this.ctx.restore();

    const beamLength = Math.hypot(this.width, this.height) * 2;
    const beamEndX = this.aiBoss.position.x + Math.cos(this.aiBoss.laserAngle) * beamLength;
    const beamEndY = this.aiBoss.position.y + Math.sin(this.aiBoss.laserAngle) * beamLength;

    // Laser telegraph: a growing charge at the boss plus a dashed aim line across the whole beam path
    if (this.isLaserCharging()) {
        const chargeProgress = 1 - (this.aiBoss.laserChargeTimer / LASER_CHARGE_FRAMES);
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(255, 80, 80, ${0.25 + chargeProgress * 0.5})`;
        this.ctx.lineWidth = 1 + chargeProgress * 3;
        this.ctx.setLineDash([12, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.aiBoss.position.x, this.aiBoss.position.y);
        this.ctx.lineTo(beamEndX, beamEndY);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
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

    // Laser beam (its drawn width is exactly its hit width)
    if (this.isLaserFiring()) {
        const fade = this.laserFade();
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(255, 0, 0, ${fade})`;
        this.ctx.lineWidth = LASER_HALF_WIDTH * 2 * fade;
        this.ctx.beginPath();
        this.ctx.moveTo(this.aiBoss.position.x, this.aiBoss.position.y);
        this.ctx.lineTo(beamEndX, beamEndY);
        this.ctx.stroke();
        this.ctx.restore();
    }
  }

  private drawBullet(bullet: Bullet) {
    this.ctx.save();
    
    // Fade-out animation based on remaining lifetime
    const fadeStart = 50; // Start fading when 50 frames remaining
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
    const pulse = (Math.sin(this.phaseTimer * 0.09) + 1) * 0.5;
    const alpha = (glitch.lifetime / 500) * (0.5 + pulse * 0.5);
    
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

  getHudStats(): HudStat[] {
    if (!this.player) return [];
    const healthRatio = this.player.health / this.player.maxHealth;
    const stats: HudStat[] = [
      {
        label: 'Health',
        meter: { value: Math.max(0, this.player.health), max: this.player.maxHealth },
        tone: healthRatio <= 0.25 ? 'danger' : healthRatio <= 0.5 ? 'warning' : 'normal',
      },
      {
        label: 'Shield',
        meter: { value: Math.max(0, this.player.shield), max: SHIELD_MAX },
        tone: this.player.shield <= 0 ? 'danger' : 'normal',
      },
      { label: 'Phase', value: this.gamePhase.toUpperCase() },
    ];
    if (this.isLaserCharging()) stats.push({ label: 'Laser', value: 'CHARGING', tone: 'warning' });
    else if (this.isLaserFiring()) stats.push({ label: 'Laser', value: 'FIRING', tone: 'danger' });
    else if (this.gamePhase === 'escape') stats.push({ label: 'Boss', value: 'PHASED OUT', tone: 'warning' });
    return stats;
  }

  private drawUI() {
    // AI boss health bar, centered at the top of the arena (player stats live in the shared HUD)
    const barWidth = 300;
    const barX = this.width / 2 - barWidth / 2;
    this.ctx.fillStyle = '#330000';
    this.ctx.fillRect(barX, 20, barWidth, 16);
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(barX, 20, Math.max(0, this.aiBoss.health / this.aiBoss.maxHealth) * barWidth, 16);
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(barX, 20, barWidth, 16);
    this.drawText('AI BOSS', this.width / 2, 52, 14, '#FF3131', 'center');
  }

  private isInCombat(): boolean {
    return this.gamePhase === 'battle' || this.gamePhase === 'escape' || this.gamePhase === 'final';
  }

  // Touch/pointer: tap to shoot toward the touch point, drag to steer toward the finger
  handlePointerDown(x: number, y: number) {
    if (this.gamePhase === 'intro') {
      this.skipIntroLine();
      return;
    }
    this.pointerHeld = true;
    this.shootToward(x, y);
  }

  handlePointerMove(x: number, y: number) {
    if (!this.pointerHeld || !this.isInCombat()) return;
    const dx = x - this.player.position.x;
    const dy = y - this.player.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return;
    const strength = Math.min(1, distance / POINTER_STEER_FULL_SPEED_DISTANCE);
    this.handleMobileMove((dx / distance) * strength, (dy / distance) * strength);
  }

  handlePointerUp() {
    if (!this.pointerHeld) return;
    this.pointerHeld = false;
    this.player.velocity.x = 0;
    this.player.velocity.y = 0;
  }

  /** Turns the ship to face a canvas point and fires, respecting the weapon cooldown. */
  private shootToward(x: number, y: number) {
    if (!this.isInCombat() || this.player.weaponCooldown > 0) return;
    const dx = x - this.player.position.x;
    const dy = y - this.player.position.y;
    if (dx * dx + dy * dy < 1) return;
    this.player.rotation = Math.atan2(dy, dx);
    this.playerShoot();
    this.player.weaponCooldown = PLAYER_WEAPON_COOLDOWN;
  }

  // Mobile input handlers: (x, y) are virtual-stick vectors in [-1, 1]
  handleMobileMove(x: number, y: number) {
    if (!this.isInCombat()) return;
    this.player.velocity.x = x * POINTER_STEER_SPEED;
    this.player.velocity.y = y * POINTER_STEER_SPEED;

    // Update player rotation based on movement direction
    if (x !== 0 || y !== 0) {
      this.player.rotation = Math.atan2(y, x);
    }
  }

  handleMobileShoot(x: number, y: number) {
    // Aim stick: fire along the stick direction
    if (x === 0 && y === 0) return;
    this.shootToward(this.player.position.x + x * 100, this.player.position.y + y * 100);
  }

  handleMobileAction() {
    // Emergency shield boost, on a cooldown so it can't be spammed into invulnerability
    if (!this.isInCombat() || this.mobileShieldCooldown > 0 || this.player.shield >= SHIELD_MAX) return;
    this.player.shield = Math.min(SHIELD_MAX, this.player.shield + MOBILE_SHIELD_BOOST);
    this.shieldFlashTimer = SHIELD_FLASH_FRAMES;
    this.mobileShieldCooldown = MOBILE_SHIELD_BOOST_COOLDOWN_FRAMES;
  }
}