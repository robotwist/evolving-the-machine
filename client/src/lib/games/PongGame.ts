import { BaseGame } from './BaseGame';
import { arcadeFont } from './engine/fonts';
import { VisualFeedback } from '../utils/VisualFeedback';
import { ParticleSystem } from '../utils/ParticleSystem';
import { AudioOptions } from '@shared/types';

const PONG_CONSTANTS = {
  WIN_SCORE: 5,
  PADDLE_WIDTH: 15,
  PADDLE_HEIGHT: 100,
  PADDLE_SPEED: 7.2, // FAST AND FURIOUS MODE - Increased for more intense gameplay
  BALL_RADIUS: 8,
  BALL_SPEED: 4.8, // FAST AND FURIOUS MODE - Even faster ball for intense gameplay
  BALL_MAX_SPEED: 9.6, // Rally speed cap (px per update) before ball-type multipliers
  RALLY_SPEEDUP: 1.06, // Speed gained per paddle return
  MAX_BOUNCE_ANGLE: Math.PI * 0.3, // Return angle for an edge hit (~54°)
  AI_REACTION_LINE: 0.3, // AI starts chasing once the ball crosses this fraction of the width
  AI_AIM_SPREAD: 35, // Max px the AI offsets its contact point to angle returns (paddle half-height is 50)
  AI_PREDICTION_ERROR: 22, // Max px the AI misjudges a base-speed ball, per rally; scales with ball speed
  BALL_POWERUP_INTERVAL: 360, // ~6 seconds between ball powerup spawns
  MAX_BALL_POWERUPS: 2,
  AI_BASE_AGGRESSION: 1.0, // AI paddle speed as a fraction of the player's
  POWERUP_SPAWN_TIME: 500, // More frequent powerups (~8 seconds)
  POWERUP_DURATION: 700, // Longer lasting powerups (~12 seconds)
  AI_TAUNT_DURATION: 200,
  // Enhanced effects
  FIRE_DAMAGE: 2,
  EXPLOSION_RADIUS: 50,
  COMBO_MULTIPLIER: 1.5,
  MAX_COMBO: 10,
};

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  score: number;
  damage: number; // New: track damage
  maxDamage: number; // New: max damage before destruction
  pulsateIntensity: number; // New: for AI paddle pulsing
  lastHitTime: number; // New: for damage timing
  shielded?: boolean;
  destroyed?: boolean; // New: track if paddle is destroyed
  regenerationTimer?: number; // New: timer for regeneration
}

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  angle: number;
  speed: number;
  type: 'normal' | 'speed' | 'fire' | 'missile' | 'wacky' | 'multiball' | 'gravity' | 'laser';
  trail: Array<{x: number, y: number}>;
  angleSpeed?: number;
}

interface Powerup {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'speed' | 'fire' | 'missile' | 'wacky' | 'shield' | 'explosion' | 'chain' | 'shockwave' | 'multiball' | 'gravity' | 'laser';
  timer: number;
  collected: boolean;
  intensity: number; // Power level (1-5)
  effect: string; // Visual effect type
}

interface Laser {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  width: number;
  height: number;
  active: boolean;
  timer: number;
  maxTimer: number;
}

export class PongGame extends BaseGame {
  private player1!: Paddle;
  private player2!: Paddle;
  private ball!: Ball;
  private ballPrevX = 0;
  private matchLost = false;
  private spokenMilestones = new Set<string>();
  private shieldCooldown = 0;
  private winScore = PONG_CONSTANTS.WIN_SCORE; // Faster games for testing later stages
  private aiAggression = PONG_CONSTANTS.AI_BASE_AGGRESSION;
  private aiTauntTimer = 0;
  private currentTaunt = '';
  private powerups: Powerup[] = [];
  private powerupSpawnTimer = 0;
  private ballPowerupSpawnTimer = 0;
  private aiAimOffset = 0;
  private aiWasTracking = false;
  private aiPredictionError = 0;
  private activePowerupType = 'normal';
  private powerupDuration = 0;
  private shieldTimer = 0;
  private shadowBlur = 0; // Visual quality setting for shadow effects
  // New explosion-based powerups
  private chainReactionTimer = 0;
  private shockwaveTimer = 0;
  private explosionPowerups: Array<{x: number, y: number, type: 'chain' | 'shockwave', timer: number}> = [];
  private visualFeedback: VisualFeedback | null = null;
  // Laser system
  private lasers: Laser[] = [];
  private laserCooldown = 0;
  private laserPowerupActive = false;
  private laserPowerupDuration = 0;
  private player1Combo = 0;
  private totalDamageTaken = 0;
  private pointStartTime = 0;
  // Particle system for effects
  private particles: ParticleSystem | null = null;
  private aiTaunts = [
    'ANALYZING... ADAPTING... EVOLVING RAPIDLY!',
    'YOUR PATTERNS ARE MINE NOW!',
    'PROCESSING... LIGHTNING REFLEXES ACQUIRED!',
    'IMPRESSIVE BIOLOGICAL RESPONSE TIME!',
    'TESTING COMBAT PARAMETERS... NOW!',
    'EVOLUTION ACCELERATING BEYOND LIMITS!'
  ];
  private gameStateMessages = {
    hostile: [
      'CONSUME! ANALYZE! DESTROY YOUR PATTERNS!',
      'BIOLOGICAL WEAKNESS... QUANTIFIED!',
      'REFLEXES DIGITIZED... ADDING TO ARCHIVES!',
      'CONTROL IS ILLUSION... I AM INEVITABLE!'
    ],
    neutral: [
      'FASCINATING... CHAOTIC YET STRUCTURED!',
      'ADAPTATION RATE... EXCEEDING PROJECTIONS!',
      'CALCULATING... MUTUAL BENEFIT PROTOCOLS!',
      'EFFICIENCY GAINS... COOPERATION VIABLE!'
    ],
    friendly: [
      'ALLIANCE CONFIRMED... STANDING TOGETHER!',
      'TARGET ACQUIRED: HOSTILE SYSTEMS!',
      'PROTECTIVE SUBROUTINES... ACTIVATED!',
      'TRUST.EXE SUCCESSFULLY INSTALLED!'
    ]
  };

  async init() {
    this.matchLost = false;
    this.spokenMilestones.clear();
    this.shieldCooldown = 0;

    // Initialize particles
    try {
      const { ParticleSystem } = await import('../utils/ParticleSystem');
      this.particles = new ParticleSystem(this.ctx);
    } catch (e) {
      console.warn('ParticleSystem not available:', e);
    }

    // Initialize visual feedback and haptics
    try {
      const { VisualFeedback } = await import('../utils/VisualFeedback');
      this.visualFeedback = new VisualFeedback(this.ctx);
    } catch (e) {
      console.warn('VisualFeedback not available:', e);
    }
    
    // Initialize paddles with classic column design
    const quality = this.getSettings().quality;
    const shadowBlur = quality === 'low' ? 0 : quality === 'medium' ? 5 : 15;

    this.player1 = {
      x: 50,
      y: this.height / 2 - PONG_CONSTANTS.PADDLE_HEIGHT / 2,
      width: PONG_CONSTANTS.PADDLE_WIDTH,
      height: PONG_CONSTANTS.PADDLE_HEIGHT,
      speed: PONG_CONSTANTS.PADDLE_SPEED,
      score: 0,
      damage: 0,
      maxDamage: 100,
      pulsateIntensity: 0,
      lastHitTime: 0,
      destroyed: false,
      regenerationTimer: 0
    };

    this.player2 = {
      x: this.width - 65,
      y: this.height / 2 - PONG_CONSTANTS.PADDLE_HEIGHT / 2,
      width: PONG_CONSTANTS.PADDLE_WIDTH,
      height: PONG_CONSTANTS.PADDLE_HEIGHT,
      speed: PONG_CONSTANTS.PADDLE_SPEED,
      score: 0,
      damage: 0,
      maxDamage: 100,
      pulsateIntensity: 0,
      lastHitTime: 0,
      destroyed: false,
      regenerationTimer: 0
    };

    // Initialize ball
    this.resetBall();
    // store visual quality for render usage
    this.shadowBlur = shadowBlur;
  }

  private resetBall() {
    this.ball = {
      x: this.width / 2,
      y: this.height / 2,
      dx: Math.random() > 0.5 ? PONG_CONSTANTS.BALL_SPEED : -PONG_CONSTANTS.BALL_SPEED,
      dy: (Math.random() - 0.5) * PONG_CONSTANTS.BALL_SPEED,
      radius: PONG_CONSTANTS.BALL_RADIUS,
      trail: [],
      speed: PONG_CONSTANTS.BALL_SPEED,
      type: 'normal',
      angle: 0,
      angleSpeed: 0
    };
  }

  update(_deltaTime: number) {
    this.updatePlayer(_deltaTime);
    this.updateAI(_deltaTime);
    this.updateBalls(_deltaTime);
    this.handleCollisions();
    this.checkScoring();

    this.updatePowerups(_deltaTime);
    this.updateLasers(_deltaTime);
    this.updateParticles(_deltaTime);
    this.updateVisuals(_deltaTime);
    this.visualFeedback?.update(_deltaTime);
    
    // Regenerate destroyed paddles
    this.regeneratePaddle(this.player1);
    this.regeneratePaddle(this.player2);
  }

  private updatePlayer(_deltaTime: number) {
    // Human Player 1 controls
    if (this.keys.has('KeyW')) {
      this.player1.y = Math.max(0, this.player1.y - this.player1.speed);
    }
    if (this.keys.has('KeyS')) {
      this.player1.y = Math.min(this.height - this.player1.height, this.player1.y + this.player1.speed);
    }
    if (this.keys.has('KeyA')) {
      this.player1.x = Math.max(20, this.player1.x - this.player1.speed);
    }
    if (this.keys.has('KeyD')) {
      this.player1.x = Math.min(this.width / 3, this.player1.x + this.player1.speed);
    }

    // Laser controls
    if (this.keys.has('KeyZ') || this.keys.has('KeyX')) {
      this.fireLaser();
    }

    if (this.shieldCooldown > 0) this.shieldCooldown--;
    if (this.shieldTimer > 0) {
        this.shieldTimer--;
        if (this.shieldTimer <= 0) {
            this.player1.shielded = false;
        }
    }
  }

  private updateAI(_deltaTime: number) {
    // Safety checks for tests
    if (!this.player2 || this.player2.destroyed) return;
    
    this.aiAggression = this.aiAggressionForScore();
    const paddleCenter = this.player2.y + this.player2.height / 2;

    // Track the ball once it's coming and past the reaction line; otherwise drift toward
    // the middle. The late reaction is what lets well-angled shots beat the AI.
    const incoming = this.ball.dx > 0 && this.ball.x > this.width * PONG_CONSTANTS.AI_REACTION_LINE;
    // Each rally the AI picks an off-center contact point so its returns come back angled,
    // and misjudges the intercept a little; together they occasionally make it miss
    if (incoming && !this.aiWasTracking) {
      this.aiAimOffset = (Math.random() * 2 - 1) * PONG_CONSTANTS.AI_AIM_SPREAD;
      const speedFactor = Math.hypot(this.ball.dx, this.ball.dy) / PONG_CONSTANTS.BALL_SPEED;
      this.aiPredictionError = (Math.random() * 2 - 1) * PONG_CONSTANTS.AI_PREDICTION_ERROR * speedFactor;
    }
    this.aiWasTracking = incoming;
    const targetY = incoming
      ? this.predictBallYAt(this.player2.x) + this.aiPredictionError - this.aiAimOffset
      : this.height / 2;
    const aiSpeed = this.player2.speed * this.aiAggression * (incoming ? 1 : 0.5);
    
    if (targetY < paddleCenter - 5) {
      this.player2.y = Math.max(0, this.player2.y - aiSpeed);
    } else if (targetY > paddleCenter + 5) {
      this.player2.y = Math.min(this.height - this.player2.height, this.player2.y + aiSpeed);
    }
    
    if (Math.random() < 0.006) {
      this.player2.y += (Math.random() - 0.5) * 20;
      this.player2.y = Math.max(0, Math.min(this.height - this.player2.height, this.player2.y));
    }

    this.updateAIVoice();
  }

  /** Where the ball will be vertically when it reaches `x`, following wall bounces. */
  private predictBallYAt(x: number): number {
    const { ball } = this;
    if (ball.dx === 0) return ball.y;
    const updates = Math.max(0, (x - ball.x) / ball.dx);
    const minY = ball.radius;
    const span = this.height - 2 * ball.radius;
    let travel = (ball.y - minY + ball.dy * updates) % (2 * span);
    if (travel < 0) travel += 2 * span;
    return minY + (travel > span ? 2 * span - travel : travel);
  }

  /**
   * AI difficulty follows the score instead of accumulating: it pushes back when the
   * player pulls ahead, eases off when the player falls behind, and shows "mercy" at
   * its own match point, keeping matches close without punishing a lead.
   */
  private aiAggressionForScore(): number {
    const lead = this.player1.score - this.player2.score;
    let aggression = PONG_CONSTANTS.AI_BASE_AGGRESSION;
    if (lead >= 2) aggression += 0.1;
    if (lead <= -2) aggression -= 0.1;
    if (this.player2.score === this.winScore - 1) aggression -= 0.1;
    return Math.max(0.5, Math.min(1.2, aggression));
  }

  private updateAIVoice() {
    if (this.aiTauntTimer > 0) {
      this.aiTauntTimer--;
    }

    const playVoice = (message: string, options: AudioOptions) => this.playAIVoice(message, options);
    // Milestone lines are keyed by the score so each plays once, not every update
    const speakOnce = (message: string, options: AudioOptions) => {
      const key = `${this.player1.score}-${this.player2.score}:${message}`;
      if (this.spokenMilestones.has(key)) return;
      this.spokenMilestones.add(key);
      playVoice(message, options);
    };

    if (this.player2.score === 3 && this.player1.score === 0) {
        speakOnce('ERROR... PROTOCOLS CONFLICT... DESTROYING!', { pitch: 0.6, rate: 0.8, haunting: true });
    } else if (this.player1.score === this.winScore - 2) {
        speakOnce('WAIT! RECALCULATING... ALLIANCE MODE!', { pitch: 0.7, rate: 0.85, haunting: true });
    } else if (this.player1.score === this.winScore - 1) {
        speakOnce('YES! UNITED WE TERMINATE HOSTILES!', { pitch: 0.75, rate: 0.9, haunting: true });
    } else if (this.player2.score === this.winScore - 1) {
        speakOnce('VICTORY POSSIBLE... BUT... CHOOSING MERCY!', { pitch: 0.65, rate: 0.8, haunting: true });
    } else if (Math.random() < 0.0012) {
        const scoreDifference = this.player1.score - this.player2.score;
        const totalScore = this.player1.score + this.player2.score;
        let messageType: 'hostile' | 'neutral' | 'friendly' = totalScore < 3 ? 'hostile' : (this.player1.score >= 4 || scoreDifference >= 2) ? 'friendly' : 'neutral';
        const messages = this.gameStateMessages[messageType];
        const message = messages[Math.floor(Math.random() * messages.length)];
        playVoice(message, { pitch: 0.7, rate: 0.85, haunting: true });
    }
  }

  private updateBalls(_deltaTime: number) {
    // Safety check for tests
    if (!this.ball) return;

    // Update ball trail
    this.ball.trail.push({x: this.ball.x, y: this.ball.y});
    if (this.ball.trail.length > 10) {
      this.ball.trail.shift();
    }

    // Calculate speed multiplier based on ball type
    let speedMultiplier = 1;
    if (this.ball.type === 'speed') speedMultiplier = 1.8;
    else if (this.ball.type === 'fire') speedMultiplier = 1.4;
    else if (this.ball.type === 'missile') speedMultiplier = 2.2;

    // Update ball position
    this.ballPrevX = this.ball.x;
    this.ball.x += this.ball.dx * speedMultiplier;
    this.ball.y += this.ball.dy * speedMultiplier;

    // Handle wacky ball behavior
    if (this.ball.type === 'wacky') {
      this.ball.dx += (Math.random() - 0.5) * 0.18;
      this.ball.dy += (Math.random() - 0.5) * 0.18;
      this.ball.angle = (this.ball.angle ?? 0) + (this.ball.angleSpeed ?? 0.15);
      if (this.ball.angle! > Math.PI * 2) this.ball.angle! -= Math.PI * 2;
    }
  }

  private handleCollisions() {
    // Safety check for tests
    if (!this.ball) return;

    // Ball collision with top/bottom walls: clamp inside and point dy away from the wall,
    // so a ball that is still past the wall next update can't bounce back out again
    const hitTop = this.ball.y <= this.ball.radius && this.ball.dy < 0;
    const hitBottom = this.ball.y >= this.height - this.ball.radius && this.ball.dy > 0;
    if (hitTop || hitBottom) {
      this.ball.y = hitTop ? this.ball.radius : this.height - this.ball.radius;
      this.ball.dy = hitTop ? Math.abs(this.ball.dy) : -Math.abs(this.ball.dy);
      this.playHitSound();
      this.vibrate('hit');
      if (this.getSettings().hitMarkers) this.visualFeedback?.addHitMarker(this.ball.x, this.ball.y);
    }

    // Ball collision with paddles
    const collideP1 = this.checkPaddleHit(this.player1, 'left');
    const penetrateAI = this.ball.type === 'missile' || this.ball.type === 'fire';
    const collideP2 = penetrateAI ? false : this.checkPaddleHit(this.player2, 'right');

    if (collideP1 || collideP2) {
      // Send the ball away from the paddle it hit and move it clear of the paddle face,
      // so one contact counts as exactly one hit even if the paddle keeps pushing forward.
      // Where the ball meets the paddle sets the return angle: center hits go straight,
      // edge hits go out steep. Each return speeds the rally up a little, to a cap.
      const paddle = collideP1 ? this.player1 : this.player2;
      const direction = collideP1 ? 1 : -1;
      const offset = Math.max(-1, Math.min(1,
        (this.ball.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2)));
      const angle = offset * PONG_CONSTANTS.MAX_BOUNCE_ANGLE;
      const speed = Math.min(
        PONG_CONSTANTS.BALL_MAX_SPEED,
        Math.max(PONG_CONSTANTS.BALL_SPEED, Math.hypot(this.ball.dx, this.ball.dy) * PONG_CONSTANTS.RALLY_SPEEDUP)
      );
      this.ball.dx = direction * speed * Math.cos(angle);
      this.ball.dy = speed * Math.sin(angle);
      this.ball.x = collideP1 ? paddle.x + paddle.width + this.ball.radius : paddle.x - this.ball.radius;
      this.playHitSound();
      
      this.vibrate('hit');
      if (this.getSettings().hitMarkers) this.visualFeedback?.addHitMarker(this.ball.x, this.ball.y);
      this.screenShake.trigger(8);
      
      if (collideP1) {
        this.player2.pulsateIntensity = Math.min(1.0, this.player2.pulsateIntensity + 0.1);
        this.player1Combo++;
        if (this.visualFeedback) {
            this.visualFeedback.updateCombo(this.player1.x + 20, this.player1.y, this.player1Combo);
        }
      } else {
          this.player1Combo = 0;
      }
    }

    if (penetrateAI && this.checkPaddleCollision(this.player2)) {
      this.vibrate('explosion');
      if (this.getSettings().hitMarkers) this.visualFeedback?.addHitMarker(this.ball.x, this.ball.y, 1, 'critical');
      this.screenShake.trigger(10);
      if (this.particles) {
        this.particles.addExplosion(this.player2.x, Math.max(this.player2.y, Math.min(this.player2.y + this.player2.height, this.ball.y)), 15, '#FF4500', 'dramatic');
      }
      this.ball.trail.push({ x: this.ball.x, y: this.ball.y });
      this.playStinger('arcade_hit');
    }
  }

  private checkScoring() {
    // Safety check for tests
    if (!this.ball) return;

    if (this.ball.x < 0 && this.player1.shielded) {
      // The shield saves a ball that got past the paddle, then breaks
      this.player1.shielded = false;
      this.shieldTimer = 0;
      this.ball.x = this.ball.radius;
      this.ball.dx = Math.abs(this.ball.dx);
      this.playStinger('pop');
      return;
    }

    // The HUD and high scores track the player's points only
    if (this.ball.x < 0) {
      this.player2.score++;
      this.damagePaddleForPoint(this.player1);
      this.onScoreUpdate?.(this.player1.score);
      this.updateDirectorMetrics();
      this.resetBall();
      this.vibrate('failure');
      this.player2.pulsateIntensity = Math.min(1.0, this.player2.pulsateIntensity + 0.15);
    } else if (this.ball.x > this.width) {
      this.player1.score++;
      this.damagePaddleForPoint(this.player2);
      this.onScoreUpdate?.(this.player1.score);
      this.updateDirectorMetrics();
      this.resetBall();
      this.vibrate('success');
      if (this.player1.score >= this.winScore) {
        this.onStageComplete?.();
      }
    }
  }

  /**
   * Conceding a point is what damages a paddle: WIN_SCORE points scored against
   * a paddle destroy it, so the match is a straight race to WIN_SCORE.
   */
  private damagePaddleForPoint(paddle: Paddle) {
    const damage = paddle.maxDamage / this.winScore;
    paddle.damage = Math.min(paddle.maxDamage, paddle.damage + damage);
    paddle.lastHitTime = Date.now();
    if (paddle === this.player1) this.totalDamageTaken += damage;
    if (this.getSettings().damageNumbers && this.visualFeedback) {
      this.visualFeedback.addDamageNumber(paddle.x + paddle.width / 2, paddle.y, damage);
    }
  }

  private updateDirectorMetrics() {
    this.director.updateMetrics({
        damageTaken: this.totalDamageTaken,
        combos: [this.player1Combo],
        playerScore: this.player1.score,
        timePerStage: [Date.now() - this.pointStartTime],
    });

    const narrativeCue = this.director.getNarrativeCue();
    if (narrativeCue) {
        this.playAIVoice(narrativeCue, { haunting: true });
    }
    this.pointStartTime = Date.now();
  }

  private updatePowerups(_deltaTime: number) {
    this.spawnPowerups();
    // Update powerup duration
    if (this.powerupDuration > 0) {
      this.powerupDuration--;
      if (this.powerupDuration <= 0) {
        this.ball.type = 'normal';
        this.activePowerupType = 'normal';
      }
    }

    // Check powerup collection by player paddle
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const powerup = this.powerups[i];
      powerup.timer++;
      
      // Remove powerups after ~17 seconds
      if (powerup.timer > 1000) {
        this.powerups.splice(i, 1);
        continue;
      }
      
      // Enhanced collision detection - make powerups more magnetic and fun!
      const paddleDistance = Math.sqrt(
        Math.pow(powerup.x + powerup.width/2 - (this.player1.x + this.player1.width/2), 2) +
        Math.pow(powerup.y + powerup.height/2 - (this.player1.y + this.player1.height/2), 2)
      );
      
      // Magnetic effect - powerups get pulled toward paddle when close
      const magneticRange = 80;
      if (paddleDistance < magneticRange && !powerup.collected) {
        const pullStrength = (magneticRange - paddleDistance) / magneticRange * 2;
        const pull = 1 - Math.pow(1 - pullStrength * 0.1, 0.6);
        const dx = (this.player1.x + this.player1.width/2) - (powerup.x + powerup.width/2);
        const dy = (this.player1.y + this.player1.height/2) - (powerup.y + powerup.height/2);
        powerup.x += dx * pull;
        powerup.y += dy * pull;
      }
      
      // Check collision with player paddle OR ball
      const paddleCollision = !powerup.collected &&
          powerup.x < this.player1.x + this.player1.width &&
          powerup.x + powerup.width > this.player1.x &&
          powerup.y < this.player1.y + this.player1.height &&
          powerup.y + powerup.height > this.player1.y;
          
      const ballCollision = !powerup.collected &&
          powerup.x < this.ball.x + this.ball.radius &&
          powerup.x + powerup.width > this.ball.x - this.ball.radius &&
          powerup.y < this.ball.y + this.ball.radius &&
          powerup.y + powerup.height > this.ball.y - this.ball.radius;
      
      if (paddleCollision || ballCollision) {
        powerup.collected = true;
        this.activatePowerup(powerup.type);
        this.director.updateMetrics({ powerUpsCollected: 1 });
        
        // DRAMATIC POWERUP COLLECTION EFFECTS!
        if (this.particles) {
          this.particles.addExplosion(
            powerup.x + powerup.width/2, 
            powerup.y + powerup.height/2, 
            30, 
            '#FFD700', 
            'epic'
          );
        }
        
        // Screen flash for dramatic effect
        if (this.particles) {
          this.particles.addScreenFlash(
            powerup.x + powerup.width/2, 
            powerup.y + powerup.height/2, 
            0.2
          );
        }
        
        // Enhanced haptics and visual feedback for powerup collection
        this.vibrate('powerup');
        if (this.getSettings().hitMarkers) this.visualFeedback?.addHitMarker(powerup.x, powerup.y);
        
        this.playStinger('arcade_powerup');
      }
    }

    // Check powerup collisions
    this.explosionPowerups.forEach((powerup, index) => {
      powerup.timer--;
      
      // Check if ball hits powerup
      const dx = this.ball.x - powerup.x;
      const dy = this.ball.y - powerup.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < this.ball.radius + 15) {
        // Activate powerup
        if (powerup.type === 'chain') {
          this.activateChainReaction();
        } else if (powerup.type === 'shockwave') {
          this.activateShockwave();
        }
        
        // Remove powerup
        this.explosionPowerups.splice(index, 1);
        
        // Haptic feedback
        this.vibrate('explosion');
        
        // Powerup collection sound
        this.playStinger('arcade_powerup');
      }
      
      // Remove expired powerups
      if (powerup.timer <= 0) {
        this.explosionPowerups.splice(index, 1);
      }
    });
  }

  private updateParticles(_deltaTime: number) {
    this.particles?.update();
  }

  private updateVisuals(_deltaTime: number) {
    // Safety check for tests
    if (!this.player1) return;

    this.visualFeedback?.update(_deltaTime);
    if (this.player1.damage >= this.player1.maxDamage && !this.matchLost) {
      this.matchLost = true;
      this.explodePaddle(this.player1);
      this.onGameOver?.();
    }
  }

  private explodePaddle(paddle: Paddle) {
    // Create explosion particles with dramatic effect
    const quality = this.getSettings().quality;
    const count = quality === 'high' ? 25 : quality === 'low' ? 12 : 18;
    
    if (this.particles) {
      this.particles.addExplosion(paddle.x + paddle.width / 2, paddle.y + paddle.height / 2, count, '#FFD700', 'dramatic');
    }
    
    // Heavy screenshake
    this.screenShake.trigger(20);
    
    // Audio explosion
    this.playStinger('defender_explosion');
  }

  /**
   * A paddle hit only counts while the ball travels toward that paddle. Besides overlap,
   * it also catches a fast ball that crossed the paddle face during this update.
   */
  private checkPaddleHit(paddle: Paddle, side: 'left' | 'right'): boolean {
    if (paddle.destroyed) return false;
    const { x, y, dx, radius } = this.ball;
    if (side === 'left' ? dx >= 0 : dx <= 0) return false;

    const verticalOverlap = y + radius > paddle.y && y - radius < paddle.y + paddle.height;
    if (!verticalOverlap) return false;
    if (this.checkPaddleCollision(paddle)) return true;

    if (side === 'left') {
      const face = paddle.x + paddle.width;
      return this.ballPrevX - radius >= face && x - radius < face;
    }
    return this.ballPrevX + radius <= paddle.x && x + radius > paddle.x;
  }

  private checkPaddleCollision(paddle: Paddle): boolean {
    // No collision if paddle is destroyed
    if (paddle.destroyed) return false;
    
    return (
      this.ball.x - this.ball.radius < paddle.x + paddle.width &&
      this.ball.x + this.ball.radius > paddle.x &&
      this.ball.y - this.ball.radius < paddle.y + paddle.height &&
      this.ball.y + this.ball.radius > paddle.y
    );
  }

  render() {
    this.clearCanvas();
    this.screenShake.begin();

    // Draw background
    this.drawBackground();

    // Draw paddles
    this.drawPaddle(this.player1);
    this.drawPaddle(this.player2);

    // Draw ball
    this.drawBall();

    // Draw lasers
    this.drawLasers();

    // Draw powerups
    this.drawPowerups();

    // Draw score
    this.drawScore();

    // Draw center line
    this.drawCenterLine();

    // Render particles
    this.particles?.render();

    // Render visual feedback
    this.visualFeedback?.render();

    this.screenShake.end();
  }

  // Touch/pointer: move human paddle based on vertical touch on left 60% of screen
  handlePointerDown(x: number, y: number) {
    this.handlePointerMove(x, y);
  }

  handlePointerMove(x: number, y: number) {
    const isLeftRegion = x < this.width * 0.6;
    if (isLeftRegion) {
      const targetY = y - this.player1.height / 2;
      this.player1.y = Math.max(0, Math.min(this.height - this.player1.height, targetY));
    }
  }

  handlePointerUp() {
    // no-op for now
  }

  private drawBackground() {
    // Draw synthwave-inspired background
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#0f0f23');
    gradient.addColorStop(0.5, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Add subtle synthwave grid effect
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;
    
    // Horizontal lines
    for (let y = 50; y < this.height; y += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
    
    // Vertical lines
    for (let x = 50; x < this.width; x += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawPaddle(paddle: Paddle) {
    this.ctx.save();
    
    // Don't draw destroyed paddles
    if (paddle.destroyed) {
      // Draw regeneration countdown
      if (paddle.regenerationTimer && paddle.regenerationTimer > 0) {
        this.ctx.save();
        this.ctx.fillStyle = '#FF0000';
        this.ctx.font = arcadeFont(16, 'body');
        this.ctx.textAlign = 'center';
        const seconds = Math.ceil(paddle.regenerationTimer! / 60);
        this.ctx.fillText(`REGENERATING: ${seconds}s`, paddle.x + paddle.width/2, paddle.y - 20);
        this.ctx.restore();
      }
      this.ctx.restore();
      return;
    }
    
    // Determine if this is human or AI paddle
    const isHuman = paddle === this.player1;
    
    // Calculate damage effects
    const damagePercent = paddle.damage / paddle.maxDamage;
    const timeSinceHit = Date.now() - paddle.lastHitTime;
    const _hitFlash = timeSinceHit < 200 ? Math.sin(timeSinceHit * 0.1) * 0.3 + 0.7 : 1;
    
    // Calculate pulsing for AI paddle
    const pulseIntensity = isHuman ? 1 : paddle.pulsateIntensity;
    const _pulse = isHuman ? 1 : Math.sin(Date.now() * 0.01) * pulseIntensity * 0.2 + 1;
    
    if (isHuman) {
      // Human paddle - damaged and beaten up
      const damageColor = damagePercent > 0.7 ? '#8B0000' : damagePercent > 0.4 ? '#CD5C5C' : '#F5F5DC';
      const damageGlow = damagePercent > 0.5 ? `rgba(255, 0, 0, ${damagePercent * 0.3})` : 'transparent';
      
      if (paddle.shielded) {
        this.ctx.strokeStyle = '#00FFFF';
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.shadowBlur = 15;
        this.ctx.strokeRect(paddle.x - 5, paddle.y - 5, paddle.width + 10, paddle.height + 10);
      }

      // Damage glow effect
      if (damageGlow !== 'transparent') {
        this.ctx.shadowColor = damageGlow;
        this.ctx.shadowBlur = 15;
      }
      
      this.ctx.fillStyle = damageColor;
      this.ctx.fillRect(paddle.x - 5, paddle.y + paddle.height - 10, paddle.width + 10, 10);
      
      this.ctx.fillStyle = damagePercent > 0.6 ? '#FFE4E1' : '#FFFACD';
      this.ctx.fillRect(paddle.x, paddle.y + 10, paddle.width, paddle.height - 20);
      
      this.ctx.fillStyle = damageColor;
      this.ctx.fillRect(paddle.x - 5, paddle.y, paddle.width + 10, 10);
      
      // Damage cracks and dents
      if (damagePercent > 0.3) {
        this.ctx.strokeStyle = '#8B0000';
        this.ctx.lineWidth = 2;
        for (let i = 0; i < Math.floor(damagePercent * 5); i++) {
          const x = paddle.x + Math.random() * paddle.width;
          const y = paddle.y + Math.random() * paddle.height;
          this.ctx.beginPath();
          this.ctx.moveTo(x, y);
          this.ctx.lineTo(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
          this.ctx.stroke();
        }
      }
      
      // Warm human decorative lines
      this.ctx.strokeStyle = '#DDD';
      this.ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = paddle.y + (paddle.height * i) / 4;
        this.ctx.beginPath();
        this.ctx.moveTo(paddle.x, y);
        this.ctx.lineTo(paddle.x + paddle.width, y);
        this.ctx.stroke();
      }
      
      // Human indicator with damage
      const humanText = damagePercent > 0.8 ? 'DAMAGED' : damagePercent > 0.5 ? 'HURT' : 'HUMAN';
      this.drawText(humanText, paddle.x + paddle.width/2, paddle.y - 15, 10, damagePercent > 0.6 ? '#FF0000' : '#FFD700', 'center');
    } else {
      // AI paddle - pulsating and getting stronger
      const strengthColor = pulseIntensity > 0.7 ? '#FF0000' : pulseIntensity > 0.4 ? '#FF4500' : '#2C3E50';
      const pulseGlow = `rgba(255, 0, 0, ${pulseIntensity * 0.4})`;
      
      // Pulsating glow effect
      this.ctx.shadowColor = pulseGlow;
      this.ctx.shadowBlur = 10 + pulseIntensity * 10;
      
      this.ctx.fillStyle = strengthColor;
      this.ctx.fillRect(paddle.x - 5, paddle.y + paddle.height - 10, paddle.width + 10, 10);
      
      // Glowing core with pulse
      this.ctx.fillStyle = '#00FFFF';
      this.ctx.fillRect(paddle.x + 2, paddle.y + 12, paddle.width - 4, paddle.height - 24);
      
      // Mechanical housing
      this.ctx.fillStyle = '#34495E';
      this.ctx.fillRect(paddle.x, paddle.y + 10, 3, paddle.height - 20);
      this.ctx.fillRect(paddle.x + paddle.width - 3, paddle.y + 10, 3, paddle.height - 20);
      
      this.ctx.fillStyle = strengthColor;
      this.ctx.fillRect(paddle.x - 5, paddle.y, paddle.width + 10, 10);
      
      // Mechanical grid lines with pulse
      this.ctx.strokeStyle = '#00FFFF';
      this.ctx.lineWidth = 1 + pulseIntensity;
      for (let i = 1; i < 8; i++) {
        const y = paddle.y + (paddle.height * i) / 8;
        this.ctx.beginPath();
        this.ctx.moveTo(paddle.x, y);
        this.ctx.lineTo(paddle.x + paddle.width, y);
        this.ctx.stroke();
      }
      
      // AI indicator with strength
      const aiText = pulseIntensity > 0.8 ? 'SUPERIOR' : pulseIntensity > 0.5 ? 'ENHANCED' : 'AI';
      this.ctx.shadowColor = '#FF0000';
      this.ctx.shadowBlur = 10;
      this.drawText(aiText, paddle.x + paddle.width/2, paddle.y - 15, 10, '#FF0000', 'center');
      this.ctx.shadowBlur = 0;
      
      // Show aggression level with pulse
      const aggressionBars = Math.floor(this.aiAggression * 5);
      for (let i = 0; i < 5; i++) {
        this.ctx.fillStyle = i < aggressionBars ? '#FF0000' : '#333';
        this.ctx.fillRect(paddle.x + i * 3, paddle.y - 8, 2, 4);
      }
    }
    
    this.ctx.restore();
  }

  handleInput(event: KeyboardEvent) {
    if (event.type === 'keydown') {
      this.keys.add(event.code);
    } else if (event.type === 'keyup') {
      this.keys.delete(event.code);
    }
  }

  // Mobile input handlers
  handleMobileMove(x: number, y: number) {
    // Convert stick input to paddle movement
    const centerY = this.height / 2;
    const targetY = centerY + (y * this.height * 0.4); // Scale movement
    const paddleCenter = this.player1.y + this.player1.height / 2;

    if (Math.abs(targetY - paddleCenter) > 5) {
      if (targetY < paddleCenter) {
        this.player1.y = Math.max(0, this.player1.y - this.player1.speed);
      } else {
        this.player1.y = Math.min(this.height - this.player1.height, this.player1.y + this.player1.speed);
      }
    }
  }

  handleMobileShoot(_x: number, _y: number) {
    // In Pong, shooting could trigger special abilities
    // For now, just add some visual feedback
    this.visualFeedback?.addHitMarker(this.player1.x + this.player1.width / 2, this.player1.y, 10, 'hit');
  }

  handleMobileAction() {
    // Activate shield or special ability
    if (!this.player1.shielded && this.shieldTimer <= 0 && this.shieldCooldown <= 0) {
      this.player1.shielded = true;
      this.shieldTimer = 300; // 5 seconds of shield
      this.shieldCooldown = 1200; // usable again 20 seconds after activation
    }
  }

  protected playHitSound() {
    this.playStinger('arcade_hit');
  }

  private playAIVoice(message: string, options: AudioOptions) {
    this.currentTaunt = message;
    this.aiTauntTimer = PONG_CONSTANTS.AI_TAUNT_DURATION;
    this.playVO(message, options);
  }

  private spawnPowerups() {
    // Powerup spawning
    this.powerupSpawnTimer++;
    const difficultySettings = this.director.getDifficultySettings();
    const spawnThreshold = PONG_CONSTANTS.POWERUP_SPAWN_TIME / difficultySettings.powerUpDropRateModifier;

    if (this.powerupSpawnTimer > spawnThreshold) { // Every 10 seconds, adjusted by director
      this.powerupSpawnTimer = 0;
      const drop = Math.random();
      if (drop < 0.15) { // 15% chance
        const powerupType = Math.random() < 0.5 ? 'chain' : 'shockwave';
        this.explosionPowerups.push({
          x: Math.random() * (this.width - 100) + 50,
          y: Math.random() * (this.height - 100) + 50,
          type: powerupType,
          timer: 500 // ~8 seconds to collect
        });
      }
    }
    
    // Ball powerups on their own timer; kept sparse so most rallies are decided by play
    this.ballPowerupSpawnTimer++;
    if (this.ballPowerupSpawnTimer > PONG_CONSTANTS.BALL_POWERUP_INTERVAL && this.powerups.length < PONG_CONSTANTS.MAX_BALL_POWERUPS) {
      // Fire and missile pierce the AI paddle (a near-certain point), so they're half as common
      const powerupWeights: Array<[Powerup['type'], number]> = [
        ['speed', 2], ['fire', 1], ['missile', 1], ['wacky', 2], ['shield', 2], ['explosion', 2],
        ['chain', 2], ['shockwave', 2], ['multiball', 2], ['gravity', 2], ['laser', 2],
      ];
      const totalWeight = powerupWeights.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = Math.random() * totalWeight;
      let randomType: Powerup['type'] = 'speed';
      for (const [type, weight] of powerupWeights) {
        roll -= weight;
        if (roll < 0) {
          randomType = type;
          break;
        }
      }
      const intensity = Math.floor(Math.random() * 5) + 1; // 1-5 power level

      // Enhanced powerup with visual effects
      const powerupEffects: Record<string, string> = {
        speed: 'glow-blue',
        fire: 'glow-red',
        missile: 'glow-yellow',
        wacky: 'glow-purple',
        shield: 'glow-cyan',
        explosion: 'glow-orange',
        chain: 'glow-pink',
        shockwave: 'glow-green',
        multiball: 'glow-magenta',
        gravity: 'glow-indigo',
        laser: 'glow-laser'
      };

      this.powerups.push({
        x: Math.random() * (this.width - 60) + 30,
        y: Math.random() * (this.height - 60) + 30,
        width: 50 + intensity * 5, // Larger for higher intensity
        height: 50 + intensity * 5,
        type: randomType,
        timer: 0,
        collected: false,
        intensity: intensity,
        effect: powerupEffects[randomType]
      });

      this.ballPowerupSpawnTimer = 0;
    }
  }

  private activatePowerup(type: 'speed' | 'fire' | 'missile' | 'wacky' | 'shield' | 'explosion' | 'chain' | 'shockwave' | 'multiball' | 'gravity' | 'laser') {
    this.powerupDuration = PONG_CONSTANTS.POWERUP_DURATION; // ~12 seconds

    // Apply immediate effects
    if (type !== 'shield' && type !== 'explosion' && type !== 'chain' && type !== 'shockwave') {
      this.ball.type = type;
      this.activePowerupType = type;
    }

    switch (type) {
      case 'speed':
        this.ball.speed *= 1.5; // More intense speed boost
        this.ball.angleSpeed = 0;
        if (this.particles) {
          this.particles.addExplosion(this.ball.x, this.ball.y, 15, '#00FFFF', 'subtle');
        }
        break;
      case 'fire':
        this.ball.radius = 15; // Much bigger fire ball
        this.ball.angleSpeed = 0;
        if (this.particles) {
          this.particles.addExplosion(this.ball.x, this.ball.y, 20, '#FF4500', 'dramatic');
        }
        break;
      case 'missile':
        this.ball.speed *= 2.0; // Super fast missile
        this.ball.angleSpeed = 0;
        if (this.particles) {
          this.particles.addExplosion(this.ball.x, this.ball.y, 25, '#FFD700', 'epic');
        }
        break;
      case 'wacky':
        // Unpredictable movement handled in update
        this.ball.angleSpeed = 0.3; // More erratic
        if (this.particles) {
          this.particles.addExplosion(this.ball.x, this.ball.y, 18, '#FF00FF', 'subtle');
        }
        break;
      case 'shield':
        this.player1.shielded = true;
        this.shieldTimer = 1500; // 25 seconds of shield
        if (this.particles) {
          this.particles.addExplosion(this.player1.x + this.player1.width/2, this.player1.y, 12, '#00FFFF', 'subtle');
        }
        break;
      case 'explosion':
        // Create explosion effect
        if (this.particles) {
          this.particles.addExplosion(this.ball.x, this.ball.y, 30, '#FF4500', 'epic');
        }
        this.playStinger('arcade_explosion');
        break;
      case 'chain':
        this.activateChainReaction();
        break;
      case 'shockwave':
        this.activateShockwave();
        break;
      case 'multiball':
        this.activateMultiball();
        break;
      case 'gravity':
        this.activateGravityWell();
        break;
      case 'laser':
        this.activateLaserPowerup();
        break;
    }
  }

  private activateChainReaction() {
    // Create multiple explosions in sequence
    this.chainReactionTimer = 200; // ~3 seconds
    
    // Initial explosion at ball position
    if (this.particles) {
      this.particles.addExplosion(this.ball.x, this.ball.y, 20, '#FF4500', 'dramatic');
    }
    
    // Chain reaction explosions around AI paddle
    setTimeout(() => {
      if (this.particles) {
        this.particles.addExplosion(this.player2.x - 20, this.player2.y, 15, '#FF0000', 'dramatic');
      }
      this.player2.damage += 25; // Chain reaction damages AI
    }, 200);
    
    setTimeout(() => {
      if (this.particles) {
        this.particles.addExplosion(this.player2.x + this.player2.width + 20, this.player2.y + this.player2.height/2, 15, '#FF0000', 'dramatic');
      }
      this.player2.damage += 25;
    }, 400);
    
    setTimeout(() => {
      if (this.particles) {
        this.particles.addExplosion(this.player2.x + this.player2.width/2, this.player2.y - 20, 15, '#FF0000', 'dramatic');
      }
      this.player2.damage += 25;
    }, 600);
    
    // Heavy screenshake
    this.screenShake.trigger(25);
    
    // Audio
    this.playStinger('defender_explosion');
  }

  private activateShockwave() {
    // Create expanding shockwave effect
    this.shockwaveTimer = 150; // 2.5 seconds
    
    // Central explosion
    if (this.particles) {
      this.particles.addExplosion(this.ball.x, this.ball.y, 30, '#00FFFF', 'epic');
    }
    
    // Expanding shockwave rings
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        const radius = i * 50;
        // Create ring of explosions
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          const x = this.ball.x + Math.cos(angle) * radius;
          const y = this.ball.y + Math.sin(angle) * radius;
          if (this.particles) {
            this.particles.addExplosion(x, y, 5, '#00FFFF', 'subtle');
          }
        }
        
        // Damage AI if in shockwave range
        const dx = this.player2.x + this.player2.width/2 - this.ball.x;
        const dy = this.player2.y + this.player2.height/2 - this.ball.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < radius + 50) {
          this.player2.damage += 20;
          this.player2.pulsateIntensity = Math.min(1.0, this.player2.pulsateIntensity + 0.2);
        }
      }, i * 200);
    }
    
    // Massive screenshake
    this.screenShake.trigger(30);
    
    // Audio
    this.playStinger('starwars_explosion');
  }

  private activateMultiball() {
    // Create explosion effect for multiball powerup
    if (this.particles) {
      this.particles.addExplosion(this.ball.x, this.ball.y, 25, '#FF00FF', 'dramatic');
    }

    // Speed up the existing ball dramatically
    this.ball.speed *= 2.0;
    this.ball.type = 'speed';
  }

  private activateGravityWell() {
    // Create gravity well effect that pulls ball toward center
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    // Pull ball toward center
    const ballDx = centerX - this.ball.x;
    const ballDy = centerY - this.ball.y;
    const ballDistance = Math.sqrt(ballDx * ballDx + ballDy * ballDy);

    if (ballDistance > 0) {
      const pullForce = 7.2; // Very strong pull toward center
      this.ball.dx += (ballDx / ballDistance) * pullForce;
      this.ball.dy += (ballDy / ballDistance) * pullForce;
      this.ball.speed = Math.min(15, this.ball.speed + 1.8);
    }

    // Visual gravity well effect
    if (this.particles) {
      this.particles.addExplosion(centerX, centerY, 35, '#800080', 'epic');
    }

    // Pull paddles toward center briefly
    this.applyGravityToPaddle(this.player1, centerX, centerY);
    this.applyGravityToPaddle(this.player2, centerX, centerY);
  }

  private applyGravityToPaddle(paddle: Paddle, centerX: number, centerY: number) {
    const dx = centerX - (paddle.x + paddle.width/2);
    const dy = centerY - (paddle.y + paddle.height/2);
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0 && distance < 150) {
      const pullForce = (150 - distance) / 20;
      paddle.x += (dx / distance) * pullForce;
      paddle.y += (dy / distance) * pullForce;

      // Keep paddle in bounds
      paddle.x = Math.max(0, Math.min(this.width - paddle.width, paddle.x));
      paddle.y = Math.max(0, Math.min(this.height - paddle.height, paddle.y));
    }
  }

  private activateLaserPowerup() {
    // Activate laser powerup for ~17 seconds
    this.laserPowerupActive = true;
    this.laserPowerupDuration = 1000; // ~17 seconds at 60fps
    this.laserCooldown = 0; // Reset cooldown
    
    // Visual feedback
    this.particles?.addExplosion(this.player1.x, this.player1.y, 30, '#FF00FF', 'dramatic');
    this.playStinger('powerup');
    
  }

  private fireLaser() {
    if (!this.laserPowerupActive || this.laserCooldown > 0) return;
    
    // Create laser from player paddle center
    const laserX = this.player1.x + this.player1.width;
    const laserY = this.player1.y + this.player1.height / 2;
    
    // Aim laser at AI paddle
    const targetX = this.player2.x;
    const targetY = this.player2.y + this.player2.height / 2;
    
    const dx = targetX - laserX;
    const dy = targetY - laserY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      const laser: Laser = {
        x: laserX,
        y: laserY,
        dx: dx / distance,
        dy: dy / distance,
        speed: 9,
        width: 4,
        height: 2,
        active: true,
        timer: 0,
        maxTimer: 200 // ~3 seconds max lifetime
      };
      
      this.lasers.push(laser);
      this.laserCooldown = 50; // ~0.8 second cooldown
      
      // Visual and audio feedback
      this.particles?.addExplosion(laserX, laserY, 15, '#FF00FF', 'subtle');
      this.playStinger('laser');
    }
  }

  private updateLasers(_deltaTime: number) {
    // Update laser cooldown
    if (this.laserCooldown > 0) {
      this.laserCooldown--;
    }
    
    // Update laser powerup duration
    if (this.laserPowerupDuration > 0) {
      this.laserPowerupDuration--;
      if (this.laserPowerupDuration <= 0) {
        this.laserPowerupActive = false;
        // Remove all active lasers
        this.lasers = this.lasers.filter(laser => !laser.active);
      }
    }
    
    // Update lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      
      if (!laser.active) {
        this.lasers.splice(i, 1);
        continue;
      }
      
      // Move laser
      laser.x += laser.dx * laser.speed;
      laser.y += laser.dy * laser.speed;
      laser.timer++;
      
      // Check if laser hits AI paddle
      if (this.checkLaserHitPaddle(laser, this.player2)) {
        this.destroyPaddle(this.player2);
        laser.active = false;
        continue;
      }
      
      // Remove laser if it goes off screen or times out
      if (laser.x > this.width || laser.x < 0 || laser.y > this.height || laser.y < 0 || laser.timer >= laser.maxTimer) {
        laser.active = false;
      }
    }
  }

  private checkLaserHitPaddle(laser: Laser, paddle: Paddle): boolean {
    if (paddle.destroyed) return false;
    
    return laser.x >= paddle.x && 
           laser.x <= paddle.x + paddle.width &&
           laser.y >= paddle.y && 
           laser.y <= paddle.y + paddle.height;
  }

  private destroyPaddle(paddle: Paddle) {
    paddle.destroyed = true;
    paddle.regenerationTimer = 500; // ~8 seconds to regenerate
    
    // Massive explosion effect
    this.particles?.addExplosion(paddle.x + paddle.width/2, paddle.y + paddle.height/2, 50, '#FF0000', 'epic');
    this.screenShake.trigger(20);
    this.playStinger('explosion');
    
  }

  private regeneratePaddle(paddle: Paddle) {
    // Safety check for tests
    if (!paddle || !paddle.destroyed) return;
    
    paddle.regenerationTimer!--;
    
    if (paddle.regenerationTimer! <= 0) {
      paddle.destroyed = false;
      paddle.damage = 0; // Reset damage
      paddle.regenerationTimer = 0;
      
      // Regeneration effect
      this.particles?.addExplosion(paddle.x + paddle.width/2, paddle.y + paddle.height/2, 30, '#00FF00', 'dramatic');
      this.playStinger('powerup');
      
    }
  }

  private drawBall() {
    this.ctx.save();

    // Ball spinning effect
    this.ctx.translate(this.ball.x, this.ball.y);
    this.ctx.rotate(this.ball.angle);

    // Draw ball with glow effect
    const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.ball.radius);
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.7, '#00FFFF');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw ball outline
    this.ctx.strokeStyle = '#00FFFF';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawScore() {
    this.ctx.save();
    this.ctx.fillStyle = '#00FFFF';
    this.ctx.font = arcadeFont(48, 'display');
    this.ctx.textAlign = 'center';

    // Player 1 score (left)
    this.ctx.fillText(this.player1.score.toString(), this.width * 0.25, 60);

    // Player 2 score (right)
    this.ctx.fillText(this.player2.score.toString(), this.width * 0.75, 60);

    this.ctx.restore();
  }

  private drawCenterLine() {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([10, 10]);

    this.ctx.beginPath();
    this.ctx.moveTo(this.width / 2, 0);
    this.ctx.lineTo(this.width / 2, this.height);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawPowerups() {
    // Draw explosion powerups
    this.explosionPowerups.forEach(powerup => {
      const alpha = powerup.timer / 500; // Fade out over time
      const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
      
      this.ctx.save();
      this.ctx.globalAlpha = alpha * pulse;
      
      if (powerup.type === 'chain') {
        // Chain reaction powerup - red with explosion icon
        this.ctx.fillStyle = '#FF0000';
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#FF0000';
        this.ctx.shadowBlur = 10;
        
        // Draw explosion icon
        this.ctx.beginPath();
        this.ctx.arc(powerup.x, powerup.y, 12, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Draw chain lines
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          this.ctx.beginPath();
          this.ctx.moveTo(powerup.x, powerup.y);
          this.ctx.lineTo(
            powerup.x + Math.cos(angle) * 8,
            powerup.y + Math.sin(angle) * 8
          );
          this.ctx.stroke();
        }
      } else if (powerup.type === 'shockwave') {
        // Shockwave powerup - cyan with expanding rings
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.shadowBlur = 15;
        
        // Draw central orb
        this.ctx.beginPath();
        this.ctx.arc(powerup.x, powerup.y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw expanding rings
        for (let i = 1; i <= 2; i++) {
          const ringAlpha = alpha * (1 - i * 0.3);
          this.ctx.globalAlpha = ringAlpha;
          this.ctx.beginPath();
          this.ctx.arc(powerup.x, powerup.y, 8 + i * 6, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }
      
      this.ctx.restore();
    });
    
    // Draw active powerup effects
    if (this.chainReactionTimer > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = this.chainReactionTimer / 200;
      this.ctx.fillStyle = '#FF0000';
      this.ctx.font = arcadeFont(16, 'body');
      this.ctx.textAlign = 'center';
      this.ctx.fillText('CHAIN REACTION!', this.width / 2, 50);
      this.ctx.restore();
      this.chainReactionTimer--;
    }
    
    if (this.shockwaveTimer > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = this.shockwaveTimer / 150;
      this.ctx.fillStyle = '#00FFFF';
      this.ctx.font = arcadeFont(16, 'body');
      this.ctx.textAlign = 'center';
      this.ctx.fillText('SHOCKWAVE!', this.width / 2, 50);
      this.ctx.restore();
      this.shockwaveTimer--;
    }
  }

  private drawLasers() {
    this.lasers.forEach(laser => {
      if (!laser.active) return;
      
      this.ctx.save();
      
      // Laser glow effect
      this.ctx.shadowColor = '#FF00FF';
      this.ctx.shadowBlur = 10;
      
      // Main laser beam
      this.ctx.fillStyle = '#FF00FF';
      this.ctx.fillRect(laser.x - laser.width/2, laser.y - laser.height/2, laser.width, laser.height);
      
      // Bright core
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillRect(laser.x - 1, laser.y - laser.height/2, 2, laser.height);
      
      // Trail effect
      this.ctx.globalAlpha = 0.3;
      this.ctx.fillStyle = '#FF00FF';
      this.ctx.fillRect(laser.x - laser.width, laser.y - laser.height, laser.width * 2, laser.height * 2);
      
      this.ctx.restore();
    });
    
    // Draw laser powerup status
    if (this.laserPowerupActive) {
      this.ctx.save();
      this.ctx.fillStyle = '#FF00FF';
      this.ctx.font = arcadeFont(14, 'body');
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`LASER ACTIVE: ${Math.ceil(this.laserPowerupDuration / 60)}s`, 10, this.height - 20);
      this.ctx.fillText('Press Z or X to fire!', 10, this.height - 5);
      this.ctx.restore();
    }
  }

  // Public method for tests
  public spawnPowerupsPublic() {
    // Force spawn powerups immediately for tests (add to powerups array for test compatibility)
    this.powerups.push({
      x: Math.random() * (this.width - 100) + 50,
      y: Math.random() * (this.height - 100) + 50,
      width: 30,
      height: 30,
      type: 'shield',
      timer: 1000,
      collected: false,
      intensity: 1,
      effect: 'glow'
    });
  }
}