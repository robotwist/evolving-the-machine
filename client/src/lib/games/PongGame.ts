import { BaseGame } from './BaseGame';
import { useAudio } from '../stores/useAudio';

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  score: number;
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

  init() {
    // Initialize paddles with Greek column design
    const quality = (window as any).__CULTURAL_ARCADE_QUALITY__ as 'low' | 'medium' | 'high' | undefined;
    const shadowBlur = quality === 'low' ? 0 : quality === 'medium' ? 5 : 15;

    this.player1 = {
      x: 50,
      y: this.height / 2 - 50,
      width: 15,
      height: 100,
      speed: 5,
      score: 0
    };

    this.player2 = {
      x: this.width - 65,
      y: this.height / 2 - 50,
      width: 15,
      height: 100,
      speed: 5,
      score: 0
    };

    // Initialize ball
    this.resetBall();
    // store visual quality for render usage
    (this as any)._shadowBlur = shadowBlur;
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
      trail: []
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
    } else if (this.player1.score === this.winScore - 2) {
      this.currentTaunt = 'WAIT! RECALCULATING... ALLIANCE MODE!';
      this.aiTauntTimer = 120;
      // AI actually helps by making itself slightly slower
      this.aiAggression = Math.max(0.8, this.aiAggression - 0.3);
    } else if (this.player1.score === this.winScore - 1) {
      this.currentTaunt = 'YES! UNITED WE TERMINATE HOSTILES!';
      this.aiTauntTimer = 120;
    } else if (this.player2.score === this.winScore - 1) {
      this.currentTaunt = 'VICTORY POSSIBLE... BUT... CHOOSING MERCY!';
      this.aiTauntTimer = 120;
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
    }

    // Special effect when piercing AI paddle
    if (penetrateAI && this.checkPaddleCollision(this.player2)) {
      // Sizzle/spark: draw a brief spark and add micro explosion
      const reduce = (window as any).__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false;
      const allowShake = (window as any).__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true;
      if (!reduce && allowShake) this.shakeTimer = 10;
      // Spark effect drawn immediately at paddle collision position
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'lighter';
      this.ctx.strokeStyle = this.ball.type === 'fire' ? '#FF4500' : '#FF0000';
      this.ctx.lineWidth = 3;
      const cx = this.player2.x;
      const cy = Math.max(this.player2.y, Math.min(this.player2.y + this.player2.height, this.ball.y));
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + Math.cos(angle) * 14, cy + Math.sin(angle) * 14);
        this.ctx.stroke();
      }
      this.ctx.restore();
      // Slight defocus trail
      this.ball.trail.push({ x: this.ball.x, y: this.ball.y });
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
    
    if (isHuman) {
      // Human paddle - warm, organic marble
      this.ctx.fillStyle = '#F5F5DC';
      this.ctx.fillRect(paddle.x - 5, paddle.y + paddle.height - 10, paddle.width + 10, 10);
      
      this.ctx.fillStyle = '#FFFACD';
      this.ctx.fillRect(paddle.x, paddle.y + 10, paddle.width, paddle.height - 20);
      
      this.ctx.fillStyle = '#F5F5DC';
      this.ctx.fillRect(paddle.x - 5, paddle.y, paddle.width + 10, 10);
      
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
      
      // Human indicator
      this.drawText('HUMAN', paddle.x + paddle.width/2, paddle.y - 15, 10, '#FFD700', 'center');
    } else {
      // AI paddle - cold, mechanical appearance with glowing effects
      this.ctx.fillStyle = '#2C3E50';
      this.ctx.fillRect(paddle.x - 5, paddle.y + paddle.height - 10, paddle.width + 10, 10);
      
      // Glowing core
      this.ctx.fillStyle = '#00FFFF';
      this.ctx.fillRect(paddle.x + 2, paddle.y + 12, paddle.width - 4, paddle.height - 24);
      
      // Mechanical housing
      this.ctx.fillStyle = '#34495E';
      this.ctx.fillRect(paddle.x, paddle.y + 10, 3, paddle.height - 20);
      this.ctx.fillRect(paddle.x + paddle.width - 3, paddle.y + 10, 3, paddle.height - 20);
      
      this.ctx.fillStyle = '#2C3E50';
      this.ctx.fillRect(paddle.x - 5, paddle.y, paddle.width + 10, 10);
      
      // Mechanical grid lines
      this.ctx.strokeStyle = '#00FFFF';
      this.ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        const y = paddle.y + (paddle.height * i) / 8;
        this.ctx.beginPath();
        this.ctx.moveTo(paddle.x, y);
        this.ctx.lineTo(paddle.x + paddle.width, y);
        this.ctx.stroke();
      }
      
      // AI indicator with glow effect
      this.ctx.shadowColor = '#FF0000';
      this.ctx.shadowBlur = 10;
      this.drawText('AI', paddle.x + paddle.width/2, paddle.y - 15, 10, '#FF0000', 'center');
      this.ctx.shadowBlur = 0;
      
      // Show aggression level
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
    this.powerupSpawnTimer++;
    
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
  }

  private activatePowerup(type: 'speed' | 'fire' | 'missile' | 'wacky') {
    this.ball.type = type;
    this.activePowerupType = type;
    this.powerupDuration = 300; // 5 seconds
    
    // Apply immediate effects
    switch (type) {
      case 'speed':
        this.ball.speed *= 1.2;
        break;
      case 'fire':
        this.ball.radius = 12; // Bigger fire ball
        break;
      case 'missile':
        this.ball.speed *= 1.6;
        break;
      case 'wacky':
        // Unpredictable movement handled in update
        break;
    }
  }

  private drawPowerups() {
    for (const powerup of this.powerups) {
      this.ctx.save();
      
      // Pulsing effect
      const pulse = Math.sin(powerup.timer * 0.1) * 0.1 + 1;
      const size = powerup.width * pulse;
      
      // Different colors for different powerups
      switch (powerup.type) {
        case 'speed':
          this.ctx.fillStyle = '#00FFFF';
          this.ctx.strokeStyle = '#0080FF';
          this.ctx.shadowColor = '#00FFFF';
          break;
        case 'fire':
          this.ctx.fillStyle = '#FF4500';
          this.ctx.strokeStyle = '#FF0000';
          this.ctx.shadowColor = '#FF4500';
          break;
        case 'missile':
          this.ctx.fillStyle = '#FF0000';
          this.ctx.strokeStyle = '#800000';
          this.ctx.shadowColor = '#FF0000';
          break;
        case 'wacky':
          const time = Date.now() * 0.01;
          const r = Math.sin(time + powerup.timer * 0.1) * 127 + 128;
          const g = Math.sin(time + powerup.timer * 0.1 + 2) * 127 + 128;
          const b = Math.sin(time + powerup.timer * 0.1 + 4) * 127 + 128;
          this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          this.ctx.strokeStyle = '#FFFFFF';
          this.ctx.shadowColor = this.ctx.fillStyle;
          break;
      }
      
      this.ctx.shadowBlur = 10;
      this.ctx.lineWidth = 2;
      
      // Draw powerup as a glowing rectangle
      this.ctx.fillRect(
        powerup.x - size/2 + powerup.width/2,
        powerup.y - size/2 + powerup.height/2,
        size,
        size
      );
      this.ctx.strokeRect(
        powerup.x - size/2 + powerup.width/2,
        powerup.y - size/2 + powerup.height/2,
        size,
        size
      );
      
      // Draw powerup type text
      this.ctx.shadowBlur = 0;
      const text = powerup.type.toUpperCase();
      this.drawText(text, powerup.x + powerup.width/2, powerup.y + powerup.height/2 + 4, 8, '#FFFFFF', 'center');
      
      this.ctx.restore();
    }

    // Show active powerup indicator
    if (this.activePowerupType !== 'normal' && this.powerupDuration > 0) {
      this.ctx.save();
      this.ctx.shadowColor = '#FFD700';
      this.ctx.shadowBlur = 5;
      const remainingTime = Math.ceil(this.powerupDuration / 60);
      this.drawText(`${this.activePowerupType.toUpperCase()}: ${remainingTime}s`, 20, this.height - 40, 14, '#FFD700');
      this.ctx.shadowBlur = 0;
      this.ctx.restore();
    }
  }
}