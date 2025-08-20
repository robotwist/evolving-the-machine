import { BaseGame } from './BaseGame';
import { useAudio } from '../stores/useAudio';

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
}

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  speed: number;
  type: 'normal' | 'speed' | 'fire' | 'missile' | 'wacky';
  trail: Array<{x: number, y: number}>;
  angle?: number;
  angleSpeed?: number;
}

interface Powerup {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'speed' | 'fire' | 'missile' | 'wacky';
  timer: number;
  collected: boolean;
}

export class PongGame extends BaseGame {
  private player1!: Paddle;
  private player2!: Paddle;
  private ball!: Ball;
  private keys: Set<string> = new Set();
  private winScore = 5; // Faster games for testing later stages
  private aiAggression = 0.6;
  private aiTauntTimer = 0;
  private currentTaunt = '';
  private powerups: Powerup[] = [];
  private powerupSpawnTimer = 0;
  private activePowerupType = 'normal';
  private powerupDuration = 0;
  private shakeTimer = 0;
  // New explosion-based powerups
  private chainReactionTimer = 0;
  private shockwaveTimer = 0;
  private explosionPowerups: Array<{x: number, y: number, type: 'chain' | 'shockwave', timer: number}> = [];
  // Particle system for effects
  private particles = new (class LocalParticles {
    private ps: any;
    init = async (ctx: CanvasRenderingContext2D) => {
      try {
        const { ParticleSystem } = await import('../utils/ParticleSystem');
        this.ps = new ParticleSystem(ctx);
      } catch (e) {
        console.warn('ParticleSystem not available:', e);
      }
    };
    addExplosion = (x: number, y: number, count?: number, color?: string, type?: string) => this.ps?.addExplosion(x, y, count, color, type);
    addSizzle = (x: number, y: number) => this.ps?.addExplosion(x, y, 8, '#FF4500', 'subtle');
    update = () => this.ps?.update();
    render = () => this.ps?.render();
  })();
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
    // Initialize paddles with Greek column design
    const quality = (window as any).__CULTURAL_ARCADE_QUALITY__ as 'low' | 'medium' | 'high' | undefined;
    const shadowBlur = quality === 'low' ? 0 : quality === 'medium' ? 5 : 15;

    this.player1 = {
      x: 50,
      y: this.height / 2 - 50,
      width: 15,
      height: 100,
      speed: 5,
      score: 0,
      damage: 0,
      maxDamage: 100,
      pulsateIntensity: 0,
      lastHitTime: 0
    };

    this.player2 = {
      x: this.width - 65,
      y: this.height / 2 - 50,
      width: 15,
      height: 100,
      speed: 5,
      score: 0,
      damage: 0,
      maxDamage: 100,
      pulsateIntensity: 0,
      lastHitTime: 0
    };

    // Initialize ball
    this.resetBall();
    // store visual quality for render usage
    (this as any)._shadowBlur = shadowBlur;
    
    // Initialize particle system
    await this.particles.init(this.ctx);
  }

  private resetBall() {
    this.ball = {
      x: this.width / 2,
      y: this.height / 2,
      dx: Math.random() > 0.5 ? 4 : -4,
      dy: (Math.random() - 0.5) * 4,
      radius: 8,
      speed: 4,
      type: 'normal',
      trail: [],
      angle: 0,
      angleSpeed: 0
    };
  }

  update(deltaTime: number) {
    // Update AI taunt timer
    if (this.aiTauntTimer > 0) {
      this.aiTauntTimer--;
    }

    // Update powerup system
    this.updatePowerups();
    this.spawnPowerups();

    // Human Player 1 controls (WASD - W/S for up/down, A/D for left/right)
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

    // AI Player 2 - Aggressive computer opponent
    const ballCenter = this.ball.y;
    const paddleCenter = this.player2.y + this.player2.height / 2;
    
    // Aggressive AI that adapts to ball speed and human performance
    let aiSpeed = this.player2.speed * this.aiAggression;
    
    // Increase aggression if AI is losing
    if (this.player1.score > this.player2.score) {
      this.aiAggression = Math.min(1.0, this.aiAggression + 0.008);
      aiSpeed *= 1.2;
    }
    
    // Predict where ball will be
    const prediction = ballCenter + (this.ball.dy * 10);
    const targetY = prediction;
    
    if (targetY < paddleCenter - 5) {
      this.player2.y = Math.max(0, this.player2.y - aiSpeed);
    } else if (targetY > paddleCenter + 5) {
      this.player2.y = Math.min(this.height - this.player2.height, this.player2.y + aiSpeed);
    }
    
    // Occasionally make erratic movements to show machine behavior
    if (Math.random() < 0.01) {
      this.player2.y += (Math.random() - 0.5) * 20;
      this.player2.y = Math.max(0, Math.min(this.height - this.player2.height, this.player2.y));
    }
    
    // Dynamic AI messages based on game state
    // AI becomes more aggressive and competitive as it scores points
    if (this.player2.score >= 4) {
      this.aiAggression = Math.min(1.0, this.aiAggression + 0.01);
    }
    
    // Add score-based prompts with fast synthwave evolution
    if (this.player2.score === 3 && this.player1.score === 0) {
      this.currentTaunt = 'ERROR... PROTOCOLS CONFLICT... DESTROYING!';
      this.aiTauntTimer = 120; // Faster speech timing
      try {
        const audioState = useAudio.getState();
        if (!audioState.isMuted) {
          audioState.playVO(this.currentTaunt, { pitch: 0.6, rate: 0.8, haunting: true });
        }
      } catch (e) {
        console.warn('AI voice failed:', e);
      }
    } else if (this.player1.score === this.winScore - 2) {
      this.currentTaunt = 'WAIT! RECALCULATING... ALLIANCE MODE!';
      this.aiTauntTimer = 120;
      // AI actually helps by making itself slightly slower
      this.aiAggression = Math.max(0.8, this.aiAggression - 0.3);
      try {
        const audioState = useAudio.getState();
        if (!audioState.isMuted) {
          audioState.playVO(this.currentTaunt, { pitch: 0.7, rate: 0.85, haunting: true });
        }
      } catch (e) {
        console.warn('AI voice failed:', e);
      }
    } else if (this.player1.score === this.winScore - 1) {
      this.currentTaunt = 'YES! UNITED WE TERMINATE HOSTILES!';
      this.aiTauntTimer = 120;
      try {
        const audioState = useAudio.getState();
        if (!audioState.isMuted) {
          audioState.playVO(this.currentTaunt, { pitch: 0.75, rate: 0.9, haunting: true });
        }
      } catch (e) {
        console.warn('AI voice failed:', e);
      }
    } else if (this.player2.score === this.winScore - 1) {
      this.currentTaunt = 'VICTORY POSSIBLE... BUT... CHOOSING MERCY!';
      this.aiTauntTimer = 120;
      try {
        const audioState = useAudio.getState();
        if (!audioState.isMuted) {
          audioState.playVO(this.currentTaunt, { pitch: 0.65, rate: 0.8, haunting: true });
        }
      } catch (e) {
        console.warn('AI voice failed:', e);
      }
    }
    
    // Show contextual AI messages based on game state (reversed progression)
    if (Math.random() < 0.002) {
      const scoreDifference = this.player1.score - this.player2.score;
      const totalScore = this.player1.score + this.player2.score;
      
      let messageType: 'hostile' | 'neutral' | 'friendly';
      if (totalScore < 3) {
        messageType = 'hostile'; // Starts adversarial
      } else if (this.player1.score >= 4 || scoreDifference >= 2) {
        messageType = 'friendly'; // Becomes friendly when human is winning
      } else {
        messageType = 'neutral'; // Neutral middle ground
      }
      
      const messages = this.gameStateMessages[messageType];
      this.currentTaunt = messages[Math.floor(Math.random() * messages.length)];
      this.aiTauntTimer = 120; // Faster, more energetic speech
      try {
        const audioState = useAudio.getState();
        if (!audioState.isMuted) {
          audioState.playVO(this.currentTaunt, { pitch: 0.7, rate: 0.85, haunting: true });
        }
      } catch (e) {
        console.warn('AI voice failed:', e);
      }
    }

    // Update ball trail for visual effects
    this.ball.trail.push({x: this.ball.x, y: this.ball.y});
    if (this.ball.trail.length > 10) {
      this.ball.trail.shift();
    }

    // Apply powerup effects to ball movement
    let speedMultiplier = 1;
    if (this.ball.type === 'speed') speedMultiplier = 1.8;
    else if (this.ball.type === 'fire') speedMultiplier = 1.4;
    else if (this.ball.type === 'missile') speedMultiplier = 2.2;
    
    // Update ball position with powerup effects
    this.ball.x += this.ball.dx * speedMultiplier;
    this.ball.y += this.ball.dy * speedMultiplier;
    
    // Wacky ball has unpredictable movement
    if (this.ball.type === 'wacky') {
      this.ball.dx += (Math.random() - 0.5) * 0.5;
      this.ball.dy += (Math.random() - 0.5) * 0.5;
      // Spin the ball 360s
      this.ball.angle = (this.ball.angle ?? 0) + (this.ball.angleSpeed ?? 0.25);
      if (this.ball.angle! > Math.PI * 2) this.ball.angle! -= Math.PI * 2;
    }

    // Ball collision with top/bottom walls
    if (this.ball.y <= this.ball.radius || this.ball.y >= this.height - this.ball.radius) {
      this.ball.dy = -this.ball.dy;
      this.playHitSound();
    }

    // Ball collision with paddles
    const collideP1 = this.checkPaddleCollision(this.player1);
    // Penetrate AI paddle when ball has missile or fire powerups
    const penetrateAI = this.ball.type === 'missile' || this.ball.type === 'fire';
    const collideP2 = penetrateAI ? false : this.checkPaddleCollision(this.player2);
    if (collideP1 || collideP2) {
      this.ball.dx = -this.ball.dx * 1.05; // Increase speed slightly
      this.playHitSound();
      const hapticsOn = (window as any).__CULTURAL_ARCADE_HAPTICS__ ?? true;
      if (hapticsOn && 'vibrate' in navigator) {
        navigator.vibrate?.(10);
      }
      // Tiny screenshake on impact
      this.shakeTimer = 8;
      
      // Apply damage to paddles
      if (collideP1) {
        this.player1.damage += 15;
        this.player1.lastHitTime = Date.now();
        // AI gets stronger when it hits
        this.player2.pulsateIntensity = Math.min(1.0, this.player2.pulsateIntensity + 0.1);
      }
      if (collideP2) {
        this.player2.damage += 10;
        this.player2.lastHitTime = Date.now();
      }
    }

    // Special effect when piercing AI paddle
    if (penetrateAI && this.checkPaddleCollision(this.player2)) {
      // Sizzle/spark: draw a brief spark and add micro explosion
      const reduce = (window as any).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
      const allowShake = (window as any).__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true;
      if (!reduce && allowShake) this.shakeTimer = 10;
      // Spark effect drawn immediately at paddle collision position
      this.particles.addSizzle(this.player2.x, Math.max(this.player2.y, Math.min(this.player2.y + this.player2.height, this.ball.y)));
      // Slight defocus trail
      this.ball.trail.push({ x: this.ball.x, y: this.ball.y });
      // Audio sizzle
      useAudio.getState().playSizzle();
    }

    // Scoring - Player must win to progress
    if (this.ball.x < 0) {
      this.player2.score++;
      this.onScoreUpdate?.(this.player1.score + this.player2.score);
      this.resetBall();
      const hapticsOn2 = (window as any).__CULTURAL_ARCADE_HAPTICS__ ?? true;
      if (hapticsOn2 && 'vibrate' in navigator) {
        navigator.vibrate?.([20, 30, 20]);
      }
      // AI gets stronger with each score
      this.player2.pulsateIntensity = Math.min(1.0, this.player2.pulsateIntensity + 0.15);
      this.aiAggression = Math.min(1.0, this.aiAggression + 0.05);
      // Game continues until player wins
    } else if (this.ball.x > this.width) {
      this.player1.score++;
      this.onScoreUpdate?.(this.player1.score + this.player2.score);
      this.resetBall();
      const hapticsOn3 = (window as any).__CULTURAL_ARCADE_HAPTICS__ ?? true;
      if (hapticsOn3 && 'vibrate' in navigator) {
        navigator.vibrate?.(20);
      }
      if (this.player1.score >= this.winScore) {
        this.onStageComplete?.(); // Only player win progresses
      }
    }
    
    // Check for paddle destruction
    if (this.player1.damage >= this.player1.maxDamage) {
      // Human paddle explodes on defeat
      this.explodePaddle(this.player1);
      this.onGameOver?.();
    }
  }

  private explodePaddle(paddle: Paddle) {
    // Create explosion particles with dramatic effect
    const quality = (window as any).__CULTURAL_ARCADE_QUALITY__ || 'medium';
    const count = quality === 'high' ? 25 : quality === 'low' ? 12 : 18;
    
    this.particles.addExplosion(paddle.x + paddle.width / 2, paddle.y + paddle.height / 2, count, '#FFD700', 'dramatic');
    
    // Heavy screenshake
    this.shakeTimer = 20;
    
    // Audio explosion
    useAudio.getState().playStinger('fail');
  }

  private checkPaddleCollision(paddle: Paddle): boolean {
    return (
      this.ball.x - this.ball.radius < paddle.x + paddle.width &&
      this.ball.x + this.ball.radius > paddle.x &&
      this.ball.y - this.ball.radius < paddle.y + paddle.height &&
      this.ball.y + this.ball.radius > paddle.y
    );
  }

  render() {
    // Optional small screenshake if enabled
    const reduceMotion = (window as any).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
    if (this.shakeTimer == null) (this as any).shakeTimer = 0;
    const shake = !reduceMotion && this.shakeTimer > 0 ? this.shakeTimer : 0;
    if (shake > 0) this.shakeTimer--;
    const offsetX = shake > 0 ? (Math.random() - 0.5) * 4 : 0;
    const offsetY = shake > 0 ? (Math.random() - 0.5) * 4 : 0;
    this.ctx.save();
    this.ctx.translate(offsetX, offsetY);
    this.clearCanvas();

    // Draw Greek-inspired background
    this.drawGreekBackground();

    // Draw paddles as Greek columns
    this.drawGreekPaddle(this.player1);
    this.drawGreekPaddle(this.player2);

    // Draw ball trail for powerups
    if (this.ball.type !== 'normal' && !(window as any).__CULTURAL_ARCADE_REDUCE_MOTION__) {
      this.ctx.save();
      for (let i = 0; i < this.ball.trail.length; i++) {
        const alpha = i / this.ball.trail.length * 0.5;
        const point = this.ball.trail[i];
        this.ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, this.ball.radius * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    // Draw ball with powerup effects
    this.ctx.save();
    
    // Different colors and effects for different powerups
    switch (this.ball.type) {
      case 'speed':
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.strokeStyle = '#0080FF';
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.shadowBlur = 15;
        break;
      case 'fire':
        this.ctx.fillStyle = '#FF4500';
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.shadowColor = '#FF4500';
        this.ctx.shadowBlur = 20;
        break;
      case 'missile':
        this.ctx.fillStyle = '#FF0000';
        this.ctx.strokeStyle = '#800000';
        this.ctx.shadowColor = '#FF0000';
        this.ctx.shadowBlur = 25;
        break;
      case 'wacky':
        const time = Date.now() * 0.01;
        const r = Math.sin(time) * 127 + 128;
        const g = Math.sin(time + 2) * 127 + 128;
        const b = Math.sin(time + 4) * 127 + 128;
        this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.shadowColor = this.ctx.fillStyle;
        this.ctx.shadowBlur = 10;
        break;
      default:
        this.ctx.fillStyle = '#FFD700';
        this.ctx.strokeStyle = '#B8860B';
        break;
    }
    
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
    this.ctx.restore();

    // Extra rotating spokes when ball is wacky
    if (this.ball.type === 'wacky') {
      this.ctx.save();
      this.ctx.translate(this.ball.x, this.ball.y);
      this.ctx.rotate(this.ball.angle ?? 0);
      this.ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.moveTo(Math.cos(ang) * (this.ball.radius + 2), Math.sin(ang) * (this.ball.radius + 2));
        this.ctx.lineTo(Math.cos(ang) * (this.ball.radius + 10), Math.sin(ang) * (this.ball.radius + 10));
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // Draw scores with humanity emphasis
    this.ctx.save();
    this.ctx.shadowColor = '#FFD700';
    this.ctx.shadowBlur = (this as any)._shadowBlur ?? 5;
    this.drawText(`${this.player1.score}`, this.width / 4, 50, 48, '#FFD700', 'center');
    this.ctx.shadowBlur = 0;
    this.ctx.restore();
    
    this.ctx.save();
    this.ctx.shadowColor = '#FF0000';
    this.ctx.shadowBlur = (this as any)._shadowBlur ?? 5;
    this.drawText(`${this.player2.score}`, (3 * this.width) / 4, 50, 48, '#FF0000', 'center');
    this.ctx.shadowBlur = 0;
    this.ctx.restore();

    // Draw AI taunt if active
    if (this.aiTauntTimer > 0) {
      this.ctx.save();
      this.ctx.shadowColor = '#FF0000';
      this.ctx.shadowBlur = 8;
      this.drawText(this.currentTaunt, this.width / 2, 80, 14, '#FF0000', 'center');
      this.ctx.shadowBlur = 0;
      this.ctx.restore();
    }

    // Draw center line
    this.ctx.save();
    this.ctx.strokeStyle = '#DDD';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([10, 10]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.width / 2, 0);
    this.ctx.lineTo(this.width / 2, this.height);
    this.ctx.stroke();
    this.ctx.restore();

    // Synthwave-style messaging with energy
    this.ctx.save();
    this.ctx.shadowColor = '#FF00FF';
    this.ctx.shadowBlur = 8;
    this.drawText('HUMAN RESISTANCE: WASD = FULL CONTROL! COLLECT POWERUPS!', this.width / 2, this.height - 40, 12, '#00FFFF', 'center');
    this.ctx.shadowColor = '#00FFFF';
    this.drawText('ANCIENT OLYMPIC SPIRIT VS EVOLVING AI CONSCIOUSNESS', this.width / 2, this.height - 20, 14, '#FF00FF', 'center');
    this.ctx.shadowBlur = 0;
    this.ctx.restore();

    // Draw powerups (now that all functions are defined)
    this.drawPowerups();
    
    // Render particles
    const allowParticles = (window as any).__CULTURAL_ARCADE_PARTICLES__ ?? true;
    if (allowParticles) {
      this.particles.update();
      this.particles.render();
    }
    
    this.ctx.restore();
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

  private drawGreekBackground() {
    // Draw synthwave-inspired Greek background
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

  private drawGreekPaddle(paddle: Paddle) {
    this.ctx.save();
    
    // Determine if this is human or AI paddle
    const isHuman = paddle === this.player1;
    
    // Calculate damage effects
    const damagePercent = paddle.damage / paddle.maxDamage;
    const timeSinceHit = Date.now() - paddle.lastHitTime;
    const hitFlash = timeSinceHit < 200 ? Math.sin(timeSinceHit * 0.1) * 0.3 + 0.7 : 1;
    
    // Calculate pulsing for AI paddle
    const pulseIntensity = isHuman ? 1 : paddle.pulsateIntensity;
    const pulse = isHuman ? 1 : Math.sin(Date.now() * 0.01) * pulseIntensity * 0.2 + 1;
    
    if (isHuman) {
      // Human paddle - damaged and beaten up
      const damageColor = damagePercent > 0.7 ? '#8B0000' : damagePercent > 0.4 ? '#CD5C5C' : '#F5F5DC';
      const damageGlow = damagePercent > 0.5 ? `rgba(255, 0, 0, ${damagePercent * 0.3})` : 'transparent';
      
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

  private playHitSound() {
    const audio = useAudio.getState();
    audio.playHit();
  }

  protected setupEventListeners() {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (this.isRunning && !this.isPaused) {
        this.keys.add(e.code);
        this.handleInput(e);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Store references for cleanup
    this.cleanup = () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }

  private spawnPowerups() {
    // Powerup spawning
    this.powerupSpawnTimer++;
    if (this.powerupSpawnTimer > 600) { // Every 10 seconds
      this.powerupSpawnTimer = 0;
      const drop = Math.random();
      if (drop < 0.15) { // 15% chance
        const powerupType = Math.random() < 0.5 ? 'chain' : 'shockwave';
        this.explosionPowerups.push({
          x: Math.random() * (this.width - 100) + 50,
          y: Math.random() * (this.height - 100) + 50,
          type: powerupType,
          timer: 300 // 5 seconds to collect
        });
      }
    }
    
    // Spawn powerups very frequently to speed up the game dramatically
    if (this.powerupSpawnTimer > 240 && this.powerups.length < 2) { // Every ~4 seconds, up to 2 at once
      const powerupTypes: ('speed' | 'fire' | 'missile' | 'wacky')[] = ['speed', 'fire', 'missile', 'wacky'];
      const randomType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
      
      this.powerups.push({
        x: Math.random() * (this.width - 60) + 30,
        y: Math.random() * (this.height - 60) + 30,
        width: 40,
        height: 40,
        type: randomType,
        timer: 0,
        collected: false
      });
      
      this.powerupSpawnTimer = 0;
    }
  }

  private updatePowerups() {
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
      
      // Remove powerups after 10 seconds
      if (powerup.timer > 600) {
        this.powerups.splice(i, 1);
        continue;
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
        this.activatePowerup(powerup.type);
        this.powerups.splice(i, 1);
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
        const hapticsOn = (window as any).__CULTURAL_ARCADE_HAPTICS__ ?? true;
        if (hapticsOn && 'vibrate' in navigator) {
          navigator.vibrate?.([50, 100, 50]);
        }
      }
      
      // Remove expired powerups
      if (powerup.timer <= 0) {
        this.explosionPowerups.splice(index, 1);
      }
    });
  }

  private activatePowerup(type: 'speed' | 'fire' | 'missile' | 'wacky') {
    this.ball.type = type;
    this.activePowerupType = type;
    this.powerupDuration = 300; // 5 seconds
    
    // Apply immediate effects
    switch (type) {
      case 'speed':
        this.ball.speed *= 1.2;
        this.ball.angleSpeed = 0;
        break;
      case 'fire':
        this.ball.radius = 12; // Bigger fire ball
        this.ball.angleSpeed = 0;
        break;
      case 'missile':
        this.ball.speed *= 1.6;
        this.ball.angleSpeed = 0;
        break;
      case 'wacky':
        // Unpredictable movement handled in update
        this.ball.angleSpeed = 0.35;
        break;
    }
  }

  private activateChainReaction() {
    // Create multiple explosions in sequence
    this.chainReactionTimer = 120; // 2 seconds
    
    // Initial explosion at ball position
    this.particles.addExplosion(this.ball.x, this.ball.y, 20, '#FF4500', 'dramatic');
    
    // Chain reaction explosions around AI paddle
    setTimeout(() => {
      this.particles.addExplosion(this.player2.x - 20, this.player2.y, 15, '#FF0000', 'dramatic');
      this.player2.damage += 25; // Chain reaction damages AI
    }, 200);
    
    setTimeout(() => {
      this.particles.addExplosion(this.player2.x + this.player2.width + 20, this.player2.y + this.player2.height/2, 15, '#FF0000', 'dramatic');
      this.player2.damage += 25;
    }, 400);
    
    setTimeout(() => {
      this.particles.addExplosion(this.player2.x + this.player2.width/2, this.player2.y - 20, 15, '#FF0000', 'dramatic');
      this.player2.damage += 25;
    }, 600);
    
    // Heavy screenshake
    this.shakeTimer = 25;
    
    // Audio
    useAudio.getState().playStinger('hit');
  }

  private activateShockwave() {
    // Create expanding shockwave effect
    this.shockwaveTimer = 90; // 1.5 seconds
    
    // Central explosion
    this.particles.addExplosion(this.ball.x, this.ball.y, 30, '#00FFFF', 'epic');
    
    // Expanding shockwave rings
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        const radius = i * 50;
        // Create ring of explosions
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          const x = this.ball.x + Math.cos(angle) * radius;
          const y = this.ball.y + Math.sin(angle) * radius;
          this.particles.addExplosion(x, y, 5, '#00FFFF', 'subtle');
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
    this.shakeTimer = 30;
    
    // Audio
    useAudio.getState().playStinger('fail');
  }

  private drawPowerups() {
    // Draw explosion powerups
    this.explosionPowerups.forEach(powerup => {
      const alpha = powerup.timer / 300; // Fade out over time
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
      this.ctx.globalAlpha = this.chainReactionTimer / 120;
      this.ctx.fillStyle = '#FF0000';
      this.ctx.font = '16px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('CHAIN REACTION!', this.width / 2, 50);
      this.ctx.restore();
      this.chainReactionTimer--;
    }
    
    if (this.shockwaveTimer > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = this.shockwaveTimer / 90;
      this.ctx.fillStyle = '#00FFFF';
      this.ctx.font = '16px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('SHOCKWAVE!', this.width / 2, 50);
      this.ctx.restore();
      this.shockwaveTimer--;
    }
  }
}