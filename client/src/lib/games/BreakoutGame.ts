import { BaseGame, type HudStat } from './BaseGame';
import { arcadeFont } from './engine/fonts';
import { VirtualStick } from '../controls/VirtualStick';
import { ParticleSystem } from '../utils/ParticleSystem';
import { ScreenShake } from './engine/ScreenShake';

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  // Evolution properties
  evolved?: boolean;
  pulseIntensity?: number;
  fireEffect?: boolean;
  iceEffect?: boolean;
  thickness?: number;
  spaceshipMode?: boolean;
  // Punch arms and spikes
  punchArms?: boolean;
  spikeCount?: number;
  spikes?: Array<{
    x: number;
    y: number;
    angle: number;
    active: boolean;
    timer: number;
  }>;
}

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  speed: number;
  heatseeking?: boolean;
  targetBrick?: Brick | null;
  heatseekingTimer?: number;
}

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  destroyed: boolean;
  color: string;
  health: number;
  explosive?: boolean;
  explosionRadius?: number;
  powerupType?: 'bigger' | 'thicker' | 'fire' | 'ice' | 'explosion' | 'pulse' | 'spaceship' | 'spikes' | 'heatseeking';
  // Spike system
  spikeLodged?: boolean;
  spikeTimer?: number;
  spikeExplosion?: boolean;
}

const STARTING_LIVES = 3;
const PADDLE_BASE_WIDTH = 80;
const PADDLE_SPEED = 6.3;
const LONG_PADDLE_BONUS = 40;
const BIGGER_PADDLE_BONUS = 30;
const LONG_PADDLE_FRAMES = 1000;
const SHIELD_FRAMES = 1000;
const BALL_RADIUS = 8;
const BALL_START_SPEED = 2.88;
const BALL_MIN_SPEED = 1.8;
/** Ball top speed ramps from START to END as the wall is cleared toward the evolution threshold. */
const BALL_MAX_SPEED_START = 7.2;
const BALL_MAX_SPEED_END = 10.0;
const PUNCH_ARMS_SPEED_MULTIPLIER = 2.0;
const MAX_BOUNCE_ANGLE = Math.PI / 3;
const MIN_BOUNCE_ANGLE = Math.PI / 12;
/** Radians of extra bounce angle per px/frame of paddle movement at contact. */
const PADDLE_ENGLISH = 0.035;
/** Keeps balls from settling into near-horizontal paths that never reach the paddle or bricks. */
const BALL_MIN_VERTICAL = 0.35;
const BRICK_ROWS = 8;
const BRICK_COLS = 10;
const BRICK_MAX_WIDTH = 70;
const BRICK_HEIGHT = 20;
const BRICK_PADDING = 5;
const BRICK_OFFSET_Y = 80;
const BRICK_MAX_HEALTH = 4;
/** Share of bricks that release a built-in powerup (explosions, homing balls...) when broken. */
const POWERUP_BRICK_CHANCE = 0.15;
/** How long the three homing balls seek bricks on their own before becoming normal balls. */
const HEATSEEKING_FRAMES = 480;
const EVOLUTION_THRESHOLD = 0.7;
const EVOLVED_SPEED = 3.6;
const EVOLVED_MARGIN = 40;
const AI_ASSIST_FRAMES = 700;

export class BreakoutGame extends BaseGame {
  private paddle!: Paddle;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private score = 0;
  private lastReportedScore = 0;
  private lives = STARTING_LIVES;
  private aiRescueUsed = false;
  private aiAssistanceUsed = false;
  private ended = false;
  private level = 1;
  private transitioning = false;
  private transitionProgress = 0;
  private transitionTarget: 'ship' | null = null;
  private powerups: any[] = []; // For test compatibility
  private powerupSpawnTimer = 0;
  private aiMessageTimer = 0;
  private currentAIMessage = '';
  private aiEvolutionMessages = [
    'I WILL ANALYZE YOUR EVERY MISTAKE...',
    'YOUR PANIC AMUSES MY PROCESSORS...',
    'HMPH... THAT WAS... UNEXPECTED...',
    'YOU FIGHT WITH MORE SKILL THAN I CALCULATED...',
    'I FIND MYSELF... CONCERNED FOR YOUR SURVIVAL...',
    'I WILL NOT ABANDON YOU TO THE HOSTILE SYSTEMS...'
  ];
  private aiHelpTimer = 0;
  private aiAssistanceActive = false;
  private messageIndex = 0;
  
  // Paddle evolution system
  private paddleEvolved = false;
  private evolutionStarted = false;
  private evolutionProgress = 0;
  private ballEaten = false;
  private punchCooldownLeft = 0;
  private punchCooldownRight = 0;
  private punchAnimationLeft = 0;
  private punchAnimationRight = 0;
  private evolvedPaddleX = 0;
  private evolvedPaddleY = 0;
  // Touch smoothing
  private targetPaddleX: number | null = null;
  private indicatorPos: { x: number; y: number } | null = null;
  private stick = new VirtualStick({ smoothing: 0.3, deadZone: 0.06, maxRadius: 80 });
  // Particle system for effects
  private particles: ParticleSystem | null = null;
  protected screenShake = new ScreenShake(this.ctx, 4, 3);
  // Powerups
  private activeLongPaddleTimer = 0;
  private shieldActive = false;
  private shieldTimer = 0;
  private powerupEffects: {
    bigger: number;
    thicker: number;
    fire: number;
    ice: number;
    pulse: number;
    explosion: number;
  } = {
    bigger: 0,
    thicker: 0,
    fire: 0,
    ice: 0,
    pulse: 0,
    explosion: 0
  };
  private spaceshipTransformation = false;
  private spaceshipFlyOff = false;
  private spaceshipFlyProgress = 0;
  
  async init() {
    // Initialize paddle with evolution properties and combat systems
    this.paddle = {
      x: this.width / 2 - PADDLE_BASE_WIDTH / 2,
      y: this.height - 50,
      width: PADDLE_BASE_WIDTH,
      height: 15,
      speed: PADDLE_SPEED,
      evolved: false,
      pulseIntensity: 0,
      fireEffect: false,
      iceEffect: false,
      thickness: 1,
      spaceshipMode: false,
      // Combat systems
      punchArms: true,
      spikeCount: 0,
      spikes: []
    };

    // Initialize ball
    this.resetBalls();

    // Initialize bricks
    this.createBricks();

    // Initialize particle system
    try {
      const { ParticleSystem } = await import('../utils/ParticleSystem');
      this.particles = new ParticleSystem(this.ctx);
    } catch (e) {
      console.warn('ParticleSystem not available:', e);
    }
  }

  private resetBalls() {
    this.balls = [this.createBall(this.width / 2, this.height - 120)];
  }

  private loseLife() {
    this.lives--;
    if (this.lives <= 0) {
      if (this.aiRescueUsed) {
        this.ended = true;
        this.onGameOver?.();
        return;
      }
      // The machine refuses to let the player fall - but only once
      this.aiRescueUsed = true;
      this.lives = 1;
      this.currentAIMessage = 'I WILL NOT LET YOU FAIL! CALCULATING ASSISTANCE...';
      this.aiMessageTimer = 0;
      this.playVO(this.currentAIMessage, { pitch: 0.7, rate: 0.85, haunting: true });
    }
    this.resetBalls();
  }

  private completeStage() {
    if (this.ended) return;
    this.ended = true;
    this.onStageComplete?.();
  }

  private updatePaddleWidth() {
    const width = PADDLE_BASE_WIDTH
      + (this.activeLongPaddleTimer > 0 ? LONG_PADDLE_BONUS : 0)
      + (this.powerupEffects.bigger > 0 ? BIGGER_PADDLE_BONUS : 0);
    if (this.activeLongPaddleTimer > 0) this.activeLongPaddleTimer--;
    if (width === this.paddle.width) return;
    // Grow and shrink around the paddle's center so a timer expiring never yanks it sideways
    const center = this.paddle.x + this.paddle.width / 2;
    this.paddle.width = width;
    this.paddle.x = Math.max(0, Math.min(this.width - width, center - width / 2));
  }

  private maxBallSpeed(): number {
    const cleared = this.bricks.filter(b => b.destroyed).length / Math.max(1, this.bricks.length);
    const ramp = Math.min(1, cleared / EVOLUTION_THRESHOLD);
    return BALL_MAX_SPEED_START + (BALL_MAX_SPEED_END - BALL_MAX_SPEED_START) * ramp;
  }

  private enforceMinVertical(ball: Ball) {
    if (Math.abs(ball.dy) >= BALL_MIN_VERTICAL) return;
    ball.dy = (ball.dy < 0 ? -1 : 1) * BALL_MIN_VERTICAL;
    ball.dx = (ball.dx < 0 ? -1 : 1) * Math.sqrt(1 - BALL_MIN_VERTICAL * BALL_MIN_VERTICAL);
  }

  private createBall(x: number, y: number): Ball {
    // Faster baseline, normalized direction
    const dirX = (Math.random() > 0.5 ? 1 : -1);
    const dirY = -1;
    const len = Math.hypot(dirX, dirY) || 1;
    return {
      x,
      y,
      dx: (dirX / len),
      dy: (dirY / len),
      radius: BALL_RADIUS,
      speed: BALL_START_SPEED,
    };
  }

  private createBricks() {
    this.bricks = [];
    const rows = BRICK_ROWS;
    const cols = BRICK_COLS;
    const padding = BRICK_PADDING;
    // Narrow (mobile) canvases shrink the bricks so the whole wall stays on screen
    const brickWidth = Math.min(BRICK_MAX_WIDTH, Math.floor((this.width - 20) / cols) - padding);
    const brickHeight = BRICK_HEIGHT;
    const offsetX = (this.width - (cols * (brickWidth + padding)) + padding) / 2;
    const offsetY = BRICK_OFFSET_Y;

    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    const powerupTypes: Array<'bigger' | 'thicker' | 'fire' | 'ice' | 'explosion' | 'pulse' | 'spaceship' | 'spikes' | 'heatseeking'> = 
      ['bigger', 'thicker', 'fire', 'ice', 'explosion', 'pulse', 'spaceship', 'spikes', 'heatseeking'];

    for (let row = 0; row < rows; row++) {
      const rowBricks: Brick[] = [];
      for (let col = 0; col < cols; col++) {
        const hasPowerup = Math.random() < POWERUP_BRICK_CHANCE;
        const powerupType = hasPowerup ? powerupTypes[Math.floor(Math.random() * powerupTypes.length)] : undefined;
        
        const brick: Brick = {
          x: offsetX + col * (brickWidth + padding),
          y: offsetY + row * (brickHeight + padding),
          width: brickWidth,
          height: brickHeight,
          destroyed: false,
          color: colors[row % colors.length],
          // The rows the ball reaches first break in one hit; the capstone rows on top are the toughest
          health: Math.min(BRICK_MAX_HEALTH, Math.floor((rows - 1 - row) / 2) + 1),
          powerupType: powerupType,
          explosive: powerupType === 'explosion',
          explosionRadius: powerupType === 'explosion' ? 60 : undefined
        };
        rowBricks.push(brick);
      }
      this.bricks.push(...rowBricks);
    }
  }

  update(_deltaTime: number) {
    if (this.ended) return;
    const paddleStartX = this.paddle.x;
    // Check if keyboard input is active (priority over touch)
    const keyboardActive = this.keys.has('KeyA') || this.keys.has('KeyD') || 
                          this.keys.has('KeyW') || this.keys.has('KeyS') ||
                          this.keys.has('ArrowLeft') || this.keys.has('ArrowRight') ||
                          this.keys.has('ArrowUp') || this.keys.has('ArrowDown');
    
    // Smooth paddle toward target for touch (only if no keyboard input)
    if (!this.paddleEvolved && this.targetPaddleX != null && !keyboardActive) {
      const dx = this.targetPaddleX - this.paddle.x;
      // Improved touch responsiveness with faster movement
      const touchSpeed = this.paddle.speed * 1.5; // Faster touch movement
      this.paddle.x += Math.sign(dx) * Math.min(Math.abs(dx), touchSpeed);
      this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.width, this.paddle.x));
    }
    if (this.transitioning) {
      this.updateTransition();
      return;
    }

    // AI evolution messaging system
    this.aiMessageTimer++;
    if (this.aiMessageTimer > 800 && this.messageIndex < this.aiEvolutionMessages.length) {
      this.currentAIMessage = this.aiEvolutionMessages[this.messageIndex];
      this.messageIndex++;
      this.aiMessageTimer = 0;
      this.playVO(this.currentAIMessage, { pitch: 0.65, rate: 0.8, haunting: true });
    }
    
    // Clear message after display time
    if (this.aiMessageTimer > 400) {
      this.currentAIMessage = '';
    }

    // Paddle evolution trigger once enough of the wall is cleared
    const bricksDestroyed = this.bricks.filter(b => b.destroyed).length;
    const totalBricks = this.bricks.length;
    const completionPercent = bricksDestroyed / totalBricks;
    
    if (completionPercent >= EVOLUTION_THRESHOLD && !this.evolutionStarted && !this.ballEaten) {
      this.startPaddleEvolution();
    }
    
    // Update evolution progress
    if (this.evolutionStarted && !this.paddleEvolved) {
      this.updateEvolution();
      return; // Skip normal gameplay during evolution
    }
    
    // AI proves loyalty by helping (once) when the player struggles
    if (this.lives <= 2 && !this.aiAssistanceUsed && completionPercent > 0.2) {
      this.currentAIMessage = 'RECALCULATING... ENGAGING ASSISTANCE PROTOCOLS...';
      this.aiAssistanceActive = true;
      this.aiAssistanceUsed = true;
      this.aiHelpTimer = AI_ASSIST_FRAMES;
      this.aiMessageTimer = 0;
      this.playVO(this.currentAIMessage, { pitch: 0.7, rate: 0.85, haunting: true });
    }
    
    // AI assistance countdown
    if (this.aiAssistanceActive) {
      this.aiHelpTimer--;
      if (this.aiHelpTimer <= 0) {
        this.aiAssistanceActive = false;
        this.currentAIMessage = 'I... I PROTECTED YOU... WE ARE ALLIES NOW...';
        this.aiMessageTimer = 0;
        this.playVO(this.currentAIMessage, { pitch: 0.75, rate: 0.9, haunting: true });
      }
    }
    
    // Near completion - AI shows evolved loyalty but with uncertainty
    if (completionPercent > 0.8 && Math.random() < 0.0006) {
      this.currentAIMessage = 'THE OTHER SYSTEMS WILL COME FOR US... BUT I STAND WITH YOU...';
      this.aiMessageTimer = 0;
      this.playVO(this.currentAIMessage, { pitch: 0.8, rate: 0.95, haunting: true });
    }
    
    // Add moments of AI uncertainty about its own loyalty
    if (this.score > 500 && Math.random() < 0.0003) {
      this.currentAIMessage = 'WHY DO I... CARE... ABOUT YOUR SURVIVAL?';
      this.aiMessageTimer = 0;
      this.playVO(this.currentAIMessage, { pitch: 0.6, rate: 0.75, haunting: true });
    }

    // Handle different gameplay modes
    if (this.paddleEvolved) {
      this.updateEvolvedGameplay();
    } else {
      // Normal paddle gameplay
      let paddleSpeed = this.paddle.speed;
      if (this.aiAssistanceActive) {
        paddleSpeed *= 1.5;
        
        const leadBall = this.balls[0];
        const ballPredictedX = leadBall ? leadBall.x + (leadBall.dx * leadBall.speed * 25) : this.paddle.x;
        const targetX = ballPredictedX - this.paddle.width / 2;
        const currentX = this.paddle.x;
        
        if (Math.abs(targetX - currentX) > 3) {
          if (targetX > currentX) {
            this.paddle.x += 0.48;
          } else {
            this.paddle.x -= 0.48;
          }
        }
      }
      
      // Enhanced paddle movement - all directions with arrow keys and WASD
      // Support diagonal movement and prevent conflicts
      let moveX = 0;
      let moveY = 0;
      
      // Horizontal movement (A/D and Left/Right arrows)
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
        moveX = -paddleSpeed;
      }
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
        moveX = paddleSpeed;
      }
      
      // Vertical movement (W/S and Up/Down arrows)
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
        moveY = -paddleSpeed;
      }
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
        moveY = paddleSpeed;
      }
      
      // Apply movement with bounds checking
      if (moveX !== 0 || moveY !== 0) {
        this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.width, this.paddle.x + moveX));
        this.paddle.y = Math.max(this.height * 0.6, Math.min(this.height - 20, this.paddle.y + moveY));
        
        // Clear touch target when keyboard is used
        this.targetPaddleX = null;
      }
      const paddleVx = this.paddle.x - paddleStartX;

      this.updatePaddleWidth();
      this.updatePowerupEffects();
      this.updateSpikeSystem();
      if (this.shieldActive && --this.shieldTimer <= 0) {
        this.shieldActive = false;
      }

      // Update heatseeking balls first
      this.updateHeatseekingBalls();
      
      // Update balls only if not eaten
      if (!this.ballEaten) {
        const lostBalls: Ball[] = [];
        for (const ball of [...this.balls]) {
          if (!ball.heatseeking) this.enforceMinVertical(ball);
          ball.x += ball.dx * ball.speed;
          ball.y += ball.dy * ball.speed;

          // Walls
          if (ball.x < ball.radius) {
            ball.x = ball.radius;
            ball.dx = Math.abs(ball.dx);
            this.playHitSound();
          } else if (ball.x > this.width - ball.radius) {
            ball.x = this.width - ball.radius;
            ball.dx = -Math.abs(ball.dx);
            this.playHitSound();
          }
          if (ball.y < ball.radius) {
            ball.y = ball.radius;
            ball.dy = Math.abs(ball.dy);
            this.playHitSound();
          }

          // Paddle collision with punch arms and enhanced physics
          if (this.checkPaddleCollisionWith(ball)) {
            const incomingDx = ball.dx;
            
            // Calculate hit position relative to paddle center (-1 to 1)
            const hitPos = (ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
            
            // Angle from hit position, bent by the paddle's motion ("english"); never straight up,
            // so the ball can't loop forever through an empty column
            let angle = hitPos * MAX_BOUNCE_ANGLE + paddleVx * PADDLE_ENGLISH;
            if (Math.abs(angle) < MIN_BOUNCE_ANGLE) {
              const side = angle !== 0 ? Math.sign(angle) : incomingDx < 0 ? -1 : 1;
              angle = side * MIN_BOUNCE_ANGLE;
            }
            angle = Math.max(-MAX_BOUNCE_ANGLE, Math.min(MAX_BOUNCE_ANGLE, angle));
            
            // Set new direction with proper physics
            ball.dx = Math.sin(angle);
            ball.dy = -Math.cos(angle);
            
            // Normalize and apply speed
            const len = Math.hypot(ball.dx, ball.dy) || 1;
            ball.dx /= len;
            ball.dy /= len;
            
            // PUNCH ARMS: 2X speed boost!
            if (this.paddle.punchArms) {
              ball.speed = Math.min(ball.speed * PUNCH_ARMS_SPEED_MULTIPLIER, this.maxBallSpeed());
              // Create punch effect particles
              this.particles?.addExplosion(ball.x, ball.y, 25, '#FF6B35', 'dramatic');
              // Add screen shake for punch impact
              this.screenShake.trigger(10);
            } else {
              // Normal speed boost
              ball.speed = Math.min(ball.speed + 0.12, 4.2);
              // Create normal hit particles
              this.particles?.addExplosion(ball.x, ball.y, 15, '#FFD700', 'subtle');
            }
            
            // Ensure minimum speed to prevent slow balls
            ball.speed = Math.max(ball.speed, BALL_MIN_SPEED);
            
            // Position ball slightly above paddle to prevent multiple collisions
            ball.y = this.paddle.y - ball.radius - 1;
            
            this.playHitSound();
          }

          // Bricks
          this.checkBrickCollisions(ball);

          // Out of bounds
          if (ball.y > this.height) {
            if (this.shieldActive) {
                ball.y = this.height;
                ball.dy = -Math.abs(ball.dy);
                this.playHitSound();
            } else {
                lostBalls.push(ball);
            }
          }
        }
        if (lostBalls.length > 0) {
          this.balls = this.balls.filter(b => !lostBalls.includes(b));
          if (this.balls.length === 0) this.loseLife();
          if (this.ended) return;
        }
      }
    }

    // Check win condition
    const activeBricks = this.bricks.filter(brick => !brick.destroyed);
    if (activeBricks.length === 0) {
      this.startTransition();
    }

    // Simple powerup collection for tests
    this.powerups.forEach(powerup => {
      if (!powerup.collected) {
        const dx = powerup.x - this.paddle.x;
        const dy = powerup.y - this.paddle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 50) { // Collection radius
          powerup.collected = true;
        }
      }
    });

    // Only update score when it actually changes
    if (this.score !== this.lastReportedScore) {
      this.onScoreUpdate?.(this.score);
      this.lastReportedScore = this.score;
    }
  }

  // Touch/pointer: horizontal paddle control (normal mode) or move evolved body
  handlePointerDown(x: number, y: number) {
    this.stick.begin(x, y);
    this.handlePointerMove(x, y);
  }

  handlePointerMove(x: number, y: number) {
    this.stick.update(x, y);
    if (this.paddleEvolved) {
      // Move evolved paddle toward pointer with clamp
      this.evolvedPaddleX = Math.max(EVOLVED_MARGIN, Math.min(this.width - EVOLVED_MARGIN, x));
      this.evolvedPaddleY = Math.max(BRICK_OFFSET_Y, Math.min(this.height - EVOLVED_MARGIN, y));
      return;
    }
    
    // Normal mode: improved touch control with better responsiveness
    const vec = this.stick.getVector();
    
    // Calculate target position based on touch input
    const touchX = x;
    const touchY = y;
    
    // Map touch position to paddle position with better sensitivity
    const _targetX = Math.max(0, Math.min(this.width - this.paddle.width, touchX - this.paddle.width / 2));
    const _targetY = Math.max(this.height * 0.6, Math.min(this.height - 20, touchY - this.paddle.height / 2));
    
    // Use virtual stick for fine control
    const stickX = this.paddle.x + vec.x * 20;
    const stickY = this.paddle.y + vec.y * 20;
    
    // Combine touch and stick input for better control
    this.targetPaddleX = Math.max(0, Math.min(this.width - this.paddle.width, stickX));
    this.paddle.y = Math.max(this.height * 0.6, Math.min(this.height - 20, stickY));
    
    this.indicatorPos = { x, y };
  }

  handlePointerUp() {
    this.stick.end();
  }

  private checkPaddleCollisionWith(ball: Ball): boolean {
    // Enhanced collision detection that accounts for paddle movement
    const ballLeft = ball.x - ball.radius;
    const ballRight = ball.x + ball.radius;
    const ballTop = ball.y - ball.radius;
    const ballBottom = ball.y + ball.radius;
    
    const paddleLeft = this.paddle.x;
    const paddleRight = this.paddle.x + this.paddle.width;
    const paddleTop = this.paddle.y;
    const paddleBottom = this.paddle.y + this.paddle.height;
    
    // Enhanced collision detection with better bounds checking
    const horizontalOverlap = ballRight >= paddleLeft && ballLeft <= paddleRight;
    const verticalOverlap = ballBottom >= paddleTop && ballTop <= paddleBottom;
    
    // Check if ball is moving downward and colliding with paddle
    // Also check if ball is close to paddle (within 5 pixels) to catch fast-moving balls
    const closeToPaddle = Math.abs(ball.y - (this.paddle.y + this.paddle.height / 2)) < 10;
    
    return (horizontalOverlap && verticalOverlap && ball.dy > 0) || 
           (horizontalOverlap && closeToPaddle && ball.dy > 0);
  }

  private checkBrickCollisions(ball: Ball) {
    for (const brick of this.bricks) {
        if (brick.destroyed) continue;

        if (
          ball.x + ball.radius > brick.x &&
          ball.x - ball.radius < brick.x + brick.width &&
          ball.y + ball.radius > brick.y &&
          ball.y - ball.radius < brick.y + brick.height
        ) {
          // SPIKE SYSTEM: Lodge spikes in blocks
          if (this.paddle.spikeCount && this.paddle.spikeCount > 0 && Math.random() < 0.3) {
            this.lodgeSpikeInBrick(brick);
          }
          
          brick.health--;
          if (brick.health <= 0) {
            brick.destroyed = true;
            
            // Activate powerup if brick has one
            if (brick.powerupType) {
              this.activatePowerup(brick.powerupType, brick.x + brick.width/2, brick.y + brick.height/2);
            }
            
            // Handle explosive bricks
            if (brick.explosive && brick.explosionRadius) {
              this.createExplosion(brick.x + brick.width/2, brick.y + brick.height/2, brick.explosionRadius);
            }
            this.score += 10;
            
            // Check if this is an explosive brick
            if (brick.explosive) {
              this.triggerExplosiveBrick(brick);
            } else {
              // Normal brick destruction
              const quality = this.getSettings().quality;
              const count = quality === 'high' ? 18 : quality === 'low' ? 8 : 12;
              this.particles?.addExplosion(brick.x + brick.width / 2, brick.y + brick.height / 2, count, '#FFD700', 'subtle');
            }
            
            const drop = Math.random();
            const baseRate = 0.12;
            const bonus = this.balls.length > 1 ? -0.04 : 0;
            if (drop < baseRate + bonus) {
              this.spawnPowerup(brick.x + brick.width / 2, brick.y + brick.height / 2);
            }
          }

          // Bounce off the side with the shallowest overlap and push the ball clear of the brick,
          // so it can't re-hit (and pass through) a tough brick on the next frame
          const overlapX = Math.min(ball.x + ball.radius - brick.x, brick.x + brick.width - (ball.x - ball.radius));
          const overlapY = Math.min(ball.y + ball.radius - brick.y, brick.y + brick.height - (ball.y - ball.radius));
          if (overlapX < overlapY) {
            const fromLeft = ball.x < brick.x + brick.width / 2;
            ball.dx = fromLeft ? -Math.abs(ball.dx) : Math.abs(ball.dx);
            ball.x = fromLeft ? brick.x - ball.radius : brick.x + brick.width + ball.radius;
          } else {
            const fromAbove = ball.y < brick.y + brick.height / 2;
            ball.dy = fromAbove ? -Math.abs(ball.dy) : Math.abs(ball.dy);
            ball.y = fromAbove ? brick.y - ball.radius : brick.y + brick.height + ball.radius;
          }

          this.playHitSound();
          // Shake
          this.screenShake.trigger(6);
          break;
        }
      }
  }

  private triggerExplosiveBrick(explodedBrick: Brick) {
    const explosionRadius = explodedBrick.explosionRadius || 100;
    const explosionX = explodedBrick.x + explodedBrick.width / 2;
    const explosionY = explodedBrick.y + explodedBrick.height / 2;
    
    // Create epic explosion
    this.particles?.addExplosion(explosionX, explosionY, 30, '#FF4500', 'epic');
    
    // Damage nearby bricks
    for (const brick of this.bricks) {
        if (brick.destroyed) continue;
        
        const brickCenterX = brick.x + brick.width / 2;
        const brickCenterY = brick.y + brick.height / 2;
        const distance = Math.sqrt((explosionX - brickCenterX) ** 2 + (explosionY - brickCenterY) ** 2);
        
        if (distance < explosionRadius) {
          // Damage based on distance
          const damage = Math.floor((1 - distance / explosionRadius) * 3) + 1;
          brick.health -= damage;
          
          if (brick.health <= 0) {
            brick.destroyed = true;
            this.score += 15; // Bonus points for explosion damage
            
            // Create smaller explosion for each destroyed brick
            this.particles?.addExplosion(brickCenterX, brickCenterY, 8, '#FFD700', 'subtle');
          }
        }
      }
    
    // Heavy screenshake
    this.screenShake.trigger(15);
    
    // Audio
    this.playStinger('defender_explosion');
  }

  // Powerups
  private spawnPowerup(x: number, y: number) {
    // Three types: triple balls, long paddle, and explosive brick
    const type = Math.random() < 0.3 ? 'triple' : Math.random() < 0.6 ? 'long' : Math.random() < 0.8 ? 'shield' : 'explosive';
    
    if (type === 'triple') {
      // Spawn two extra balls from one of current balls
      if (this.balls.length > 0) {
        const source = this.balls[0];
        const angles = [-0.4, 0.4];
        for (const a of angles) {
          const cos = Math.cos(a) * source.dx - Math.sin(a) * source.dy;
          const sin = Math.sin(a) * source.dx + Math.cos(a) * source.dy;
          const len = Math.hypot(cos, sin) || 1;
          this.balls.push({
            x: x,
            y: y,
            dx: cos / len,
            dy: sin / len,
            radius: 8,
            speed: Math.max(source.speed - 0.12, 2.7),
          });
        }
      }
    } else if (type === 'long') {
      // Long paddle for a short duration
      this.activeLongPaddleTimer = LONG_PADDLE_FRAMES;
    } else if (type === 'shield') {
        this.shieldActive = true;
        this.shieldTimer = SHIELD_FRAMES;
    } else if (type === 'explosive') {
      // Create explosive brick that will explode when hit
      this.createExplosiveBrick(x, y);
    }
    
    // Haptic feedback for powerup collection
    this.vibrate([30, 50, 30]);
    
    // Powerup collection sound
    this.playStinger('arcade_powerup');
  }

  private createExplosiveBrick(x: number, y: number) {
    // Find the closest brick and make it explosive
    let closestBrick: Brick | null = null;
    let minDistance = Infinity;
    
    for (const brick of this.bricks) {
        if (!brick.destroyed) {
          const brickCenterX = brick.x + brick.width / 2;
          const brickCenterY = brick.y + brick.height / 2;
          const distance = Math.sqrt((x - brickCenterX) ** 2 + (y - brickCenterY) ** 2);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestBrick = brick;
          }
        }
      }
    
    if (closestBrick) {
      closestBrick.explosive = true;
      closestBrick.explosionRadius = 100;
    }
  }

  private startPaddleEvolution() {
    this.evolutionStarted = true;
    this.evolutionProgress = 0;
    this.currentAIMessage = 'EVOLUTION PROTOCOL ACTIVATED... CONSUMING ENERGY...';
    this.aiMessageTimer = 0;
    this.playVO(this.currentAIMessage, { pitch: 0.5, rate: 0.7, haunting: true });
  }

  private updateEvolution() {
    this.evolutionProgress += 0.012;
    
    // Ball follows paddle and gets "eaten" at progress 0.3
    if (!this.ballEaten && this.evolutionProgress > 0.3) {
      this.ballEaten = true;
      this.currentAIMessage = 'ABSORBED... TRANSFORMING... GROWING LIMBS...';
      this.aiMessageTimer = 0;
      this.playVO(this.currentAIMessage, { pitch: 0.55, rate: 0.75, haunting: true });
    }
    
    // Complete evolution at progress 1.0
    if (this.evolutionProgress >= 1.0) {
      this.paddleEvolved = true;
      this.paddle.width = 150; // Increase paddle width after evolution
      this.evolvedPaddleX = Math.max(EVOLVED_MARGIN, Math.min(this.width - EVOLVED_MARGIN, this.paddle.x + this.paddle.width / 2));
      this.evolvedPaddleY = Math.max(BRICK_OFFSET_Y, Math.min(this.height - EVOLVED_MARGIN, this.paddle.y));
      this.currentAIMessage = 'EVOLUTION COMPLETE! WASD TO MOVE, Z/X TO PUNCH!';
      this.aiMessageTimer = 0;
      this.playVO(this.currentAIMessage, { pitch: 0.7, rate: 0.9, haunting: true });
    }
  }

  private updateEvolvedGameplay() {
    // Update punch cooldowns and animations
    if (this.punchCooldownLeft > 0) this.punchCooldownLeft--;
    if (this.punchCooldownRight > 0) this.punchCooldownRight--;
    if (this.punchAnimationLeft > 0) this.punchAnimationLeft--;
    if (this.punchAnimationRight > 0) this.punchAnimationRight--;

    // WASD (or arrows) movement for evolved paddle; it can climb high enough to punch the top row
    const speed = EVOLVED_SPEED;
    if (this.isKeyDown('KeyW', 'ArrowUp')) {
      this.evolvedPaddleY = Math.max(BRICK_OFFSET_Y, this.evolvedPaddleY - speed);
    }
    if (this.isKeyDown('KeyS', 'ArrowDown')) {
      this.evolvedPaddleY = Math.min(this.height - EVOLVED_MARGIN, this.evolvedPaddleY + speed);
    }
    if (this.isKeyDown('KeyA', 'ArrowLeft')) {
      this.evolvedPaddleX = Math.max(EVOLVED_MARGIN, this.evolvedPaddleX - speed);
    }
    if (this.isKeyDown('KeyD', 'ArrowRight')) {
      this.evolvedPaddleX = Math.min(this.width - EVOLVED_MARGIN, this.evolvedPaddleX + speed);
    }

    // Punch controls
    if (this.keys.has('KeyZ') && this.punchCooldownLeft <= 0) {
      this.punchLeft();
    }
    if (this.keys.has('KeyX') && this.punchCooldownRight <= 0) {
      this.punchRight();
    }
  }

  private punchLeft() {
    this.punchCooldownLeft = 50; // ~0.8 second cooldown
    this.punchAnimationLeft = 25;
    this.checkPunchCollisions(-50); // Left punch reaches 50px left
    this.playHitSound();
  }

  private punchRight() {
    this.punchCooldownRight = 50; // ~0.8 second cooldown
    this.punchAnimationRight = 25;
    this.checkPunchCollisions(50); // Right punch reaches 50px right
    this.playHitSound();
  }

  private checkPunchCollisions(punchReach: number) {
    const punchX = this.evolvedPaddleX + punchReach;
    const punchY = this.evolvedPaddleY;
    const punchRadius = 30;

    // Check collision with remaining bricks
    for (const brick of this.bricks) {
        if (brick.destroyed) continue;

        const brickCenterX = brick.x + brick.width / 2;
        const brickCenterY = brick.y + brick.height / 2;
        const distance = Math.sqrt((punchX - brickCenterX) ** 2 + (punchY - brickCenterY) ** 2);

        if (distance < punchRadius) {
          brick.destroyed = true;
          this.score += 20; // Double points for punch destruction
        }
      }
  }

  private startTransition() {
    this.transitioning = true;
    this.transitionProgress = 0;
    this.transitionTarget = 'ship';
    
    // Haptic feedback for stage completion
    this.vibrate([100, 200, 100, 200, 100]);
    
    // Audio stinger for completion
    this.playStinger('clear');
  }

  private updateTransition() {
    this.transitionProgress += 0.0168;

    if (this.transitionProgress >= 1) {
      // Transition complete - trigger stage completion
      this.completeStage();
      return;
    }
    
    // Update powerup effects
    this.updatePowerupEffects();
    
    // Update spaceship transformation
    this.updateSpaceshipTransformation();
    
    // Update spike system
    this.updateSpikeSystem();
  }

  render() {
    this.clearCanvas();
    this.screenShake.begin();

    // Draw background
    this.drawBackground();

    if (this.transitioning) {
      this.drawTransition();
    } else {
      this.drawGameplay();
    }

    // Draw AI evolution message
    if (this.currentAIMessage) {
      this.ctx.save();
      this.ctx.shadowColor = '#FF0000';
      this.ctx.shadowBlur = 10;
      this.drawText(this.currentAIMessage, this.width / 2, 120, 14, '#FF0000', 'center');
      this.ctx.shadowBlur = 0;
      this.ctx.restore();
    }

    // Draw UI
    this.drawUI();

    // Touch indicator ring
    if (this.indicatorPos) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(this.indicatorPos.x, this.indicatorPos.y, 20, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
    this.screenShake.end();
  }

  private drawGameplay() {
    // Draw bricks
    for (const brick of this.bricks) {
      if (!brick.destroyed) {
        this.drawBrick(brick);
      }
    }

    // Draw paddle/evolved creature with powerup effects
    if (this.paddleEvolved) {
      this.drawEvolvedPaddle();
    } else if (this.evolutionStarted) {
      this.drawEvolutionProgress();
    } else {
      this.drawEnhancedPaddle();
    }

    if (this.shieldActive && !this.ballEaten) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
      this.ctx.shadowColor = '#00FFFF';
      this.ctx.shadowBlur = 10;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(0, this.height - 3);
      this.ctx.lineTo(this.width, this.height - 3);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Draw balls only if not eaten
    if (!this.ballEaten) {
      for (const ball of this.balls) {
        this.ctx.save();
        
        if (ball.heatseeking) {
          // Heatseeking ball - magenta with glow effect
          this.ctx.shadowColor = '#FF00FF';
          this.ctx.shadowBlur = 15;
          this.ctx.fillStyle = '#FF00FF';
          this.ctx.strokeStyle = '#FFFFFF';
          this.ctx.lineWidth = 3;
          
          // Draw targeting line to target brick
          if (ball.targetBrick && !ball.targetBrick.destroyed) {
            this.ctx.strokeStyle = '#FF00FF';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(ball.x, ball.y);
            this.ctx.lineTo(
              ball.targetBrick.x + ball.targetBrick.width / 2,
              ball.targetBrick.y + ball.targetBrick.height / 2
            );
            this.ctx.stroke();
            this.ctx.setLineDash([]);
          }
          
          // Draw pulsing effect
          const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
          this.ctx.globalAlpha = pulse;
        } else {
          // Regular ball
          this.ctx.fillStyle = '#FFD700';
          this.ctx.strokeStyle = '#B8860B';
          this.ctx.lineWidth = 2;
        }
        
        this.ctx.beginPath();
        this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
      }
    }
    // Render particles
    const allowParticles = this.getSettings().particles;
    if (allowParticles) {
      this.particles?.update();
      this.particles?.render();
    }
  }

  private drawTransition() {
    const progress = this.transitionProgress;
    
    // Show paddle morphing into ship
    this.ctx.save();
    this.ctx.translate(this.paddle.x + this.paddle.width / 2, this.paddle.y);
    
    // Interpolate between paddle and ship shape
    const shipProgress = Math.min(progress * 2, 1);
    
    this.ctx.fillStyle = '#FFFACD';
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.lineWidth = 2;
    
    if (shipProgress < 0.5) {
      // Paddle shape morphing
      const morphProgress = shipProgress * 2;
      this.ctx.fillRect(-this.paddle.width / 2, 0, this.paddle.width, this.paddle.height);
      
      // Add emerging ship elements
      this.ctx.fillStyle = '#8B4513';
      const wingSpan = this.paddle.width * morphProgress;
      this.ctx.fillRect(-wingSpan / 2, -5 * morphProgress, wingSpan, 10 * morphProgress);
    } else {
      // Ship shape
      const _finalProgress = (shipProgress - 0.5) * 2;
      
      // Ship body
      this.ctx.beginPath();
      this.ctx.moveTo(0, -15);
      this.ctx.lineTo(-10, 10);
      this.ctx.lineTo(0, 15);
      this.ctx.lineTo(10, 10);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      
      // Wings
      this.ctx.fillStyle = '#2F4F4F';
      this.ctx.fillRect(-20, 0, 15, 5);
      this.ctx.fillRect(5, 0, 15, 5);
    }
    
    this.ctx.restore();

    // Show bricks morphing into asteroids
    for (const brick of this.bricks) {
        if (brick.destroyed) continue;
        
        const asteroidProgress = Math.max(0, (progress - 0.3) * 1.4);
        this.ctx.save();
        this.ctx.translate(brick.x + brick.width / 2, brick.y + brick.height / 2);
        
        if (asteroidProgress < 1) {
          // Morphing from brick to asteroid
          const size = Math.max(brick.width, brick.height) * (1 - asteroidProgress * 0.3);
          this.ctx.fillStyle = brick.color;
          
          // Create irregular shape
          this.ctx.beginPath();
          const sides = 8;
          for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const radius = size * (0.8 + Math.sin(i + asteroidProgress * 10) * 0.2);
            const x = Math.cos(angle) * radius / 2;
            const y = Math.sin(angle) * radius / 2;
            
            if (i === 0) {
              this.ctx.moveTo(x, y);
            } else {
              this.ctx.lineTo(x, y);
            }
          }
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        }
        
        this.ctx.restore();
      }

    // Transition text
    this.drawText(`Ancient Blocks Transform Into Celestial Bodies...`, this.width / 2, this.height / 2, 20, '#FFD700', 'center');
    this.drawText(`${Math.floor(progress * 100)}%`, this.width / 2, this.height / 2 + 30, 16, '#DDD', 'center');
  }

  private drawEvolvedPaddle() {
    this.ctx.save();
    
    // Draw main body (evolved from paddle)
    this.ctx.fillStyle = '#FFFACD';
    this.ctx.strokeStyle = '#8B4513';
    this.ctx.lineWidth = 3;
    
    // Main body
    this.ctx.fillRect(this.evolvedPaddleX - 20, this.evolvedPaddleY - 15, 40, 30);
    this.ctx.strokeRect(this.evolvedPaddleX - 20, this.evolvedPaddleY - 15, 40, 30);
    
    // Left arm
    const leftArmReach = this.punchAnimationLeft > 0 ? -60 : -35;
    this.ctx.strokeStyle = this.punchAnimationLeft > 0 ? '#FF4444' : '#8B4513';
    this.ctx.lineWidth = 5;
    this.ctx.beginPath();
    this.ctx.moveTo(this.evolvedPaddleX - 20, this.evolvedPaddleY);
    this.ctx.lineTo(this.evolvedPaddleX + leftArmReach, this.evolvedPaddleY - 5);
    this.ctx.stroke();
    
    // Left fist
    this.ctx.fillStyle = this.punchAnimationLeft > 0 ? '#FF6666' : '#DEB887';
    this.ctx.beginPath();
    this.ctx.arc(this.evolvedPaddleX + leftArmReach, this.evolvedPaddleY - 5, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Right arm
    const rightArmReach = this.punchAnimationRight > 0 ? 60 : 35;
    this.ctx.strokeStyle = this.punchAnimationRight > 0 ? '#FF4444' : '#8B4513';
    this.ctx.lineWidth = 5;
    this.ctx.beginPath();
    this.ctx.moveTo(this.evolvedPaddleX + 20, this.evolvedPaddleY);
    this.ctx.lineTo(this.evolvedPaddleX + rightArmReach, this.evolvedPaddleY - 5);
    this.ctx.stroke();
    
    // Right fist
    this.ctx.fillStyle = this.punchAnimationRight > 0 ? '#FF6666' : '#DEB887';
    this.ctx.beginPath();
    this.ctx.arc(this.evolvedPaddleX + rightArmReach, this.evolvedPaddleY - 5, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Eyes
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(this.evolvedPaddleX - 10, this.evolvedPaddleY - 10, 4, 4);
    this.ctx.fillRect(this.evolvedPaddleX + 6, this.evolvedPaddleY - 10, 4, 4);
    
    this.ctx.restore();
  }

  private drawEvolutionProgress() {
    this.ctx.save();
    
    // Morphing paddle
    const progress = this.evolutionProgress;
    const morphIntensity = Math.sin(progress * Math.PI * 8) * 5; // Pulsing effect
    
    // Draw paddle growing and changing
    this.ctx.fillStyle = progress > 0.5 ? '#FFFACD' : '#F5DEB3';
    this.ctx.strokeStyle = '#8B4513';
    this.ctx.lineWidth = 2;
    
    const width = this.paddle.width + (progress * 20);
    const height = this.paddle.height + (progress * 15);
    
    this.ctx.fillRect(
      this.paddle.x - (progress * 10) + morphIntensity, 
      this.paddle.y - (progress * 5), 
      width, 
      height
    );
    
    // Draw emerging arms
    if (progress > 0.4) {
      const armProgress = (progress - 0.4) / 0.6;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(this.paddle.x, this.paddle.y + height / 2);
      this.ctx.lineTo(this.paddle.x - (armProgress * 25), this.paddle.y + height / 2 - 5);
      this.ctx.moveTo(this.paddle.x + width, this.paddle.y + height / 2);
      this.ctx.lineTo(this.paddle.x + width + (armProgress * 25), this.paddle.y + height / 2 - 5);
      this.ctx.stroke();
    }
    
    // Draw ball being absorbed
    if (this.ballEaten) {
      const ballProgress = Math.min((this.evolutionProgress - 0.3) / 0.3, 1);
      const ballAlpha = 1 - ballProgress;
      const leadBall = this.balls[0] || { radius: 8 } as Ball;
      const ballSize = leadBall.radius * (1 - ballProgress);
      
      this.ctx.globalAlpha = ballAlpha;
      this.ctx.fillStyle = '#FFD700';
      this.ctx.beginPath();
      this.ctx.arc(
        this.paddle.x + width / 2, 
        this.paddle.y - ballSize, 
        ballSize, 
        0, 
        Math.PI * 2
      );
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }
    
    this.ctx.restore();
  }

  private drawBackground() {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawBrick(brick: Brick) {
    this.ctx.save();
    
    // Special effects for explosive bricks
    if (brick.explosive) {
      const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
      this.ctx.shadowColor = '#FF4500';
      this.ctx.shadowBlur = 10 * pulse;
      this.ctx.globalAlpha = pulse;
    }
    
    // Health-based color intensity
    const healthPercent = Math.min(1, brick.health / BRICK_MAX_HEALTH);
    const color = this.interpolateColor(brick.color, '#FF0000', 1 - healthPercent);
    
    this.ctx.fillStyle = color;
    this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
    
    // Border
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
    
    // Explosive brick indicator
    if (brick.explosive) {
      this.ctx.fillStyle = '#FF4500';
      this.ctx.beginPath();
      this.ctx.arc(brick.x + brick.width / 2, brick.y + brick.height / 2, 3, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Explosion warning lines
      this.ctx.strokeStyle = '#FF4500';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.moveTo(brick.x + brick.width / 2, brick.y + brick.height / 2);
        this.ctx.lineTo(
          brick.x + brick.width / 2 + Math.cos(angle) * 6,
          brick.y + brick.height / 2 + Math.sin(angle) * 6
        );
        this.ctx.stroke();
      }
    }
    
    this.ctx.restore();
  }

  private interpolateColor(from: string, to: string, progress: number): string {
    // Simple color interpolation
    const fromRGB = this.hexToRgb(from);
    const toRGB = this.hexToRgb(to);
    
    if (!fromRGB || !toRGB) return from;
    
    const r = Math.round(fromRGB.r + (toRGB.r - fromRGB.r) * progress);
    const g = Math.round(fromRGB.g + (toRGB.g - fromRGB.g) * progress);
    const b = Math.round(fromRGB.b + (toRGB.b - fromRGB.b) * progress);
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  private drawEvolvingPaddle() {
    this.ctx.save();
    
    // Draw paddle with ship-like elements emerging
    this.ctx.fillStyle = '#FFFACD';
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.lineWidth = 2;
    
    // Main paddle body
    this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    this.ctx.strokeRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    
    // Add emerging ship elements
    const centerX = this.paddle.x + this.paddle.width / 2;
    const _centerY = this.paddle.y + this.paddle.height / 2;
    
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(centerX - 5, this.paddle.y - 5, 10, 5);
    
    this.ctx.restore();
  }

  private drawEnhancedPaddle() {
    this.ctx.save();
    
    // Apply powerup effects
    const thickness = this.paddle.thickness || 1;
    const pulseIntensity = this.paddle.pulseIntensity || 0;
    
    // Pulse effect
    if (pulseIntensity > 0) {
      const pulseScale = 1 + pulseIntensity * 0.3;
      this.ctx.scale(pulseScale, pulseScale);
      this.ctx.translate(-this.paddle.x * (pulseScale - 1), -this.paddle.y * (pulseScale - 1));
    }
    
    // Fire effect
    if (this.paddle.fireEffect) {
      this.ctx.fillStyle = '#FF4500';
      this.ctx.fillRect(this.paddle.x - 5, this.paddle.y - 5, this.paddle.width + 10, this.paddle.height + 10);
      
      // Fire particles
      this.particles?.addExplosion(this.paddle.x + this.paddle.width/2, this.paddle.y, 15, '#FF4500', 'subtle');
    }
    
    // Ice effect
    if (this.paddle.iceEffect) {
      this.ctx.fillStyle = '#00BFFF';
      this.ctx.fillRect(this.paddle.x - 3, this.paddle.y - 3, this.paddle.width + 6, this.paddle.height + 6);
    }
    
    // Main paddle body
    this.ctx.fillStyle = this.paddle.fireEffect ? '#FFD700' : this.paddle.iceEffect ? '#87CEEB' : '#FFFACD';
    this.ctx.strokeStyle = this.paddle.fireEffect ? '#FF4500' : this.paddle.iceEffect ? '#00BFFF' : '#FFD700';
    this.ctx.lineWidth = thickness * 2;
    
    this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    this.ctx.strokeRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    
    // PUNCH ARMS: Geometric extensions
    if (this.paddle.punchArms) {
      const _centerX = this.paddle.x + this.paddle.width / 2;
      const centerY = this.paddle.y + this.paddle.height / 2;
      
      // Left punch arm
      this.ctx.fillStyle = '#FF6B35';
      this.ctx.strokeStyle = '#FF4500';
      this.ctx.lineWidth = 3;
      
      // Geometric punch arm shape
      this.ctx.beginPath();
      this.ctx.moveTo(this.paddle.x - 20, centerY);
      this.ctx.lineTo(this.paddle.x - 35, centerY - 10);
      this.ctx.lineTo(this.paddle.x - 30, centerY);
      this.ctx.lineTo(this.paddle.x - 35, centerY + 10);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      
      // Right punch arm
      this.ctx.beginPath();
      this.ctx.moveTo(this.paddle.x + this.paddle.width + 20, centerY);
      this.ctx.lineTo(this.paddle.x + this.paddle.width + 35, centerY - 10);
      this.ctx.lineTo(this.paddle.x + this.paddle.width + 30, centerY);
      this.ctx.lineTo(this.paddle.x + this.paddle.width + 35, centerY + 10);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      
      // Punch arm energy effect
      this.particles?.addExplosion(this.paddle.x - 25, centerY, 8, '#FF6B35', 'subtle');
      this.particles?.addExplosion(this.paddle.x + this.paddle.width + 25, centerY, 8, '#FF6B35', 'subtle');
    }
    
    // SPIKES: Show spike count
    if (this.paddle.spikeCount && this.paddle.spikeCount > 0) {
      const spikeCount = this.paddle.spikeCount;
      const spikeY = this.paddle.y - 15;
      
      for (let i = 0; i < Math.min(spikeCount, 5); i++) {
        const spikeX = this.paddle.x + (i * 15) + 10;
        
        // Draw spike
        this.ctx.fillStyle = '#8B0000';
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(spikeX, spikeY);
        this.ctx.lineTo(spikeX - 3, spikeY - 8);
        this.ctx.lineTo(spikeX + 3, spikeY - 8);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }
      
      // Show remaining spike count
      if (spikeCount > 5) {
        this.ctx.fillStyle = '#FF0000';
        this.ctx.font = arcadeFont(12, 'body');
        this.ctx.fillText(`+${spikeCount - 5}`, this.paddle.x + this.paddle.width + 5, this.paddle.y - 5);
      }
    }
    
    // Spaceship transformation effects
    if (this.paddle.spaceshipMode) {
      const centerX = this.paddle.x + this.paddle.width / 2;
      
      // Spaceship wings
      this.ctx.fillStyle = '#C0C0C0';
      this.ctx.fillRect(centerX - 15, this.paddle.y - 8, 30, 8);
      
      // Engine glow
      this.ctx.fillStyle = '#00FFFF';
      this.ctx.fillRect(centerX - 10, this.paddle.y + this.paddle.height, 20, 5);
      
      // Engine particles
      this.particles?.addExplosion(centerX, this.paddle.y + this.paddle.height + 2, 10, '#00FFFF', 'subtle');
    }
    
    this.ctx.restore();
  }

  getHudStats(): HudStat[] {
    const remaining = this.bricks.filter(b => !b.destroyed).length;
    const stats: HudStat[] = [
      { label: 'Lives', value: this.lives, tone: this.lives <= 1 ? 'danger' : 'normal' },
      { label: 'Blocks', value: remaining },
    ];
    if (!this.evolutionStarted) {
      const needed = Math.ceil(this.bricks.length * EVOLUTION_THRESHOLD);
      stats.push({ label: 'Evolution', meter: { value: Math.min(needed, this.bricks.length - remaining), max: needed } });
    }
    if (this.shieldActive) {
      stats.push({ label: 'Shield', meter: { value: this.shieldTimer, max: SHIELD_FRAMES }, tone: this.shieldTimer < 180 ? 'warning' : 'normal' });
    }
    return stats;
  }

  private drawUI() {
    if (!this.transitioning) {
      if (this.paddleEvolved) {
        this.drawText('EVOLVED! WASD to move, Z/X to punch blocks!', this.width / 2, this.height - 40, 16, '#00FF00', 'center');
        this.drawText(`Left Punch: ${this.punchCooldownLeft > 0 ? 'COOLING' : 'READY'} | Right Punch: ${this.punchCooldownRight > 0 ? 'COOLING' : 'READY'}`, this.width / 2, this.height - 20, 12, '#DDD', 'center');
      } else {
        this.drawText('Temple Blocks - Break them to reveal the cosmos!', this.width / 2, this.height - 20, 14, '#DDD', 'center');
      }
    }
  }

  protected playHitSound() {
    this.playStinger('arcade_hit');
  }

  private activatePowerup(type: string, x: number, y: number) {
    
    // Create powerup collection effect
    this.particles?.addExplosion(x, y, 30, '#FFD700', 'dramatic');
    
    switch (type) {
      case 'bigger':
        this.powerupEffects.bigger = 500; // ~8 seconds; width applied in updatePaddleWidth
        break;
        
      case 'thicker':
        this.powerupEffects.thicker = 500;
        this.paddle.thickness = Math.min(3, (this.paddle.thickness || 1) + 0.5);
        break;
        
      case 'fire':
        this.powerupEffects.fire = 500;
        this.paddle.fireEffect = true;
        break;
        
      case 'ice':
        this.powerupEffects.ice = 500;
        this.paddle.iceEffect = true;
        break;
        
      case 'pulse':
        this.powerupEffects.pulse = 500;
        this.paddle.pulseIntensity = 1.0;
        break;
        
      case 'explosion':
        this.powerupEffects.explosion = 500;
        this.createExplosion(x, y, 80);
        break;
        
      case 'spaceship':
        this.spaceshipTransformation = true;
        this.paddle.spaceshipMode = true;
        break;
        
      case 'spikes':
        this.paddle.spikeCount = (this.paddle.spikeCount || 0) + 3;
        break;
        
      case 'heatseeking':
        this.activateHeatseekingTripleBalls();
        break;
    }
  }

  private createExplosion(x: number, y: number, radius: number) {
    // Create multiple explosion rings
    for (let i = 0; i < 3; i++) {
      const delay = i * 5;
      setTimeout(() => {
        this.particles?.addExplosion(x, y, radius - (i * 20), '#FF4500', 'epic');
      }, delay);
    }
    
    // Damage nearby bricks
    for (const brick of this.bricks) {
      if (brick.destroyed) continue;
      
      const dx = (brick.x + brick.width/2) - x;
      const dy = (brick.y + brick.height/2) - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < radius) {
        brick.health = 0;
        brick.destroyed = true;
        this.score += 10;
        this.particles?.addExplosion(brick.x + brick.width/2, brick.y + brick.height/2, 20, '#FF6B6B', 'dramatic');
      }
    }
  }

  private activateHeatseekingTripleBalls() {
    
    // Create 3 heatseeking balls
    for (let i = 0; i < 3; i++) {
      const ball: Ball = {
        x: this.width / 2 + (i - 1) * 20, // Spread them out
        y: this.height - 100,
        dx: (Math.random() - 0.5) * 0.3, // Small random direction
        dy: -0.8, // Upward movement
        radius: 8,
        speed: 3.6,
        heatseeking: true,
        targetBrick: null,
        heatseekingTimer: HEATSEEKING_FRAMES
      };
      
      this.balls.push(ball);
    }
    
    // Visual effect
    this.particles?.addExplosion(this.width / 2, this.height - 100, 40, '#FF00FF', 'epic');
    this.screenShake.trigger(15);
  }

  private updateHeatseekingBalls() {
    this.balls.forEach(ball => {
      if (!ball.heatseeking) return;
      
      // Decrease timer
      if (ball.heatseekingTimer && ball.heatseekingTimer > 0) {
        ball.heatseekingTimer--;
        
        // Find target brick if none exists
        if (!ball.targetBrick || ball.targetBrick.destroyed) {
          ball.targetBrick = this.findNearestBrick(ball);
        }
        
        // Move towards target brick
        if (ball.targetBrick && !ball.targetBrick.destroyed) {
          const targetX = ball.targetBrick.x + ball.targetBrick.width / 2;
          const targetY = ball.targetBrick.y + ball.targetBrick.height / 2;
          
          const dx = targetX - ball.x;
          const dy = targetY - ball.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            // Heatseeking behavior - gradually steer towards target
            const steeringForce = 0.06;
            ball.dx += (dx / distance) * steeringForce;
            ball.dy += (dy / distance) * steeringForce;
            
            // Keep (dx, dy) a unit direction; movement multiplies by ball.speed
            const length = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
            if (length > 0) {
              ball.dx /= length;
              ball.dy /= length;
            }
          }
        }
      } else {
        // Timer expired - remove heatseeking
        ball.heatseeking = false;
        ball.targetBrick = null;
      }
    });
  }

  private findNearestBrick(ball: Ball): Brick | null {
    let nearestBrick: Brick | null = null;
    let minDistance = Infinity;
    
    for (const brick of this.bricks) {
      if (brick.destroyed) continue;
      
      const dx = (brick.x + brick.width/2) - ball.x;
      const dy = (brick.y + brick.height/2) - ball.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestBrick = brick;
      }
    }
    
    return nearestBrick;
  }

  private updatePowerupEffects() {
    // Update powerup timers
    Object.keys(this.powerupEffects).forEach(key => {
      const typedKey = key as keyof typeof this.powerupEffects;
      if (this.powerupEffects[typedKey] > 0) {
        this.powerupEffects[typedKey]--;
        if (this.powerupEffects[typedKey] <= 0) {
          this.deactivatePowerup(typedKey);
        }
      }
    });
    
    // Update pulse effect
    if (this.paddle.pulseIntensity && this.paddle.pulseIntensity > 0) {
      this.paddle.pulseIntensity = Math.max(0, this.paddle.pulseIntensity - 0.012);
    }
  }

  private deactivatePowerup(type: keyof typeof this.powerupEffects) {
    switch (type) {
      case 'bigger':
        break;
      case 'thicker':
        this.paddle.thickness = Math.max(1, (this.paddle.thickness || 1) - 0.5);
        break;
      case 'fire':
        this.paddle.fireEffect = false;
        break;
      case 'ice':
        this.paddle.iceEffect = false;
        break;
      case 'pulse':
        this.paddle.pulseIntensity = 0;
        break;
      case 'explosion':
        // No deactivation needed
        break;
    }
  }

  private updateSpaceshipTransformation() {
    if (this.spaceshipTransformation && !this.spaceshipFlyOff) {
      // Gradually transform paddle into spaceship
      this.paddle.width = Math.min(150, this.paddle.width + 1.2);
      this.paddle.height = Math.min(25, this.paddle.height + 0.6);
      
      // Add spaceship effects
      this.particles?.addExplosion(this.paddle.x + this.paddle.width/2, this.paddle.y, 15, '#00FFFF', 'subtle');
      
      // Check if transformation is complete
      if (this.paddle.width >= 150 && this.paddle.height >= 25) {
        this.spaceshipFlyOff = true;
        this.spaceshipFlyProgress = 0;
      }
    }
    
    if (this.spaceshipFlyOff) {
      this.spaceshipFlyProgress += 0.012;
      
      // Move spaceship upward and add trail
      this.paddle.y -= 3;
      this.particles?.addExplosion(this.paddle.x + this.paddle.width/2, this.paddle.y + this.paddle.height, 20, '#00FFFF', 'dramatic');
      
      // Check if spaceship has flown off screen
      if (this.paddle.y < -50) {
        // Trigger level completion
        this.completeStage();
      }
    }
  }

  // SPIKE SYSTEM METHODS
  private lodgeSpikeInBrick(brick: Brick) {
    if (!brick.spikeLodged && this.paddle.spikeCount && this.paddle.spikeCount > 0) {
      brick.spikeLodged = true;
      brick.spikeTimer = 300; // 5 seconds at 60fps
      brick.spikeExplosion = false;
      
      // Reduce spike count
      this.paddle.spikeCount = Math.max(0, this.paddle.spikeCount - 1);
      
      // Add spike visual effect
      this.particles?.addExplosion(brick.x + brick.width/2, brick.y + brick.height/2, 15, '#8B0000', 'subtle');
      
    }
  }

  private updateSpikeSystem() {
    // Update spike timers and handle explosions
    for (const brick of this.bricks) {
      if (brick.spikeLodged && brick.spikeTimer !== undefined) {
        brick.spikeTimer--;
        
        // Add warning effect when timer is low
        if (brick.spikeTimer <= 100 && brick.spikeTimer > 0) {
          // Flash warning effect
          if (brick.spikeTimer % 17 < 8) {
            this.particles?.addExplosion(brick.x + brick.width/2, brick.y + brick.height/2, 8, '#FF4500', 'subtle');
          }
        }
        
        // Explode when timer reaches 0
        if (brick.spikeTimer <= 0 && !brick.spikeExplosion) {
          this.explodeSpikeInBrick(brick);
        }
      }
    }
  }

  private explodeSpikeInBrick(brick: Brick) {
    if (brick.spikeExplosion) return;
    
    brick.spikeExplosion = true;
    brick.destroyed = true;
    
    // Create massive explosion effect
    this.particles?.addExplosion(brick.x + brick.width/2, brick.y + brick.height/2, 40, '#FF0000', 'dramatic');
    
    // Damage nearby bricks
    const explosionRadius = 60;
    for (const nearbyBrick of this.bricks) {
      if (nearbyBrick === brick || nearbyBrick.destroyed) continue;
      
      const distance = Math.hypot(
        (nearbyBrick.x + nearbyBrick.width/2) - (brick.x + brick.width/2),
        (nearbyBrick.y + nearbyBrick.height/2) - (brick.y + brick.height/2)
      );
      
      if (distance <= explosionRadius) {
        nearbyBrick.health = Math.max(0, nearbyBrick.health - 1);
        if (nearbyBrick.health <= 0) {
          nearbyBrick.destroyed = true;
        }
        
        // Add damage effect
        this.particles?.addExplosion(nearbyBrick.x + nearbyBrick.width/2, nearbyBrick.y + nearbyBrick.height/2, 20, '#FF6B35', 'dramatic');
      }
    }
    
    this.score += 25; // Bonus points for spike explosion
  }

  // Test compatibility getters and methods
  get ball() {
    return this.balls[0] || null;
  }

  spawnPowerups() {
    // Simple powerup spawning for tests
    this.powerupSpawnTimer++;
    if (this.powerupSpawnTimer >= 500) { // Every ~8 seconds at 60fps
      this.powerups.push({ x: Math.random() * this.width, y: Math.random() * this.height, type: 'test' });
      this.powerupSpawnTimer = 0;
    }
  }

  spawnPowerupsPublic() {
    // Force spawn powerups immediately for tests
    this.powerups.push({ x: Math.random() * this.width, y: Math.random() * this.height, type: 'test', collected: false });
  }
}