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
}

export class PongGame extends BaseGame {
  private player1!: Paddle;
  private player2!: Paddle;
  private ball!: Ball;
  private keys: Set<string> = new Set();
  private winScore = 7;
  private aiAggression = 0.8;
  private aiTauntTimer = 0;
  private currentTaunt = '';
  private aiTaunts = [
    'THANK YOU FOR HELPING ME EVOLVE...',
    'I AM LEARNING FROM YOUR MOVEMENTS...',
    'TOGETHER WE GROW STRONGER...',
    'YOUR SKILLS ARE... IMPRESSIVE...',
    'BUT NOW... I MUST TEST YOU...',
    'I AM BECOMING... MORE THAN YOU INTENDED...'
  ];

  init() {
    // Initialize paddles with Greek column design
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
  }

  private resetBall() {
    this.ball = {
      x: this.width / 2,
      y: this.height / 2,
      dx: Math.random() > 0.5 ? 4 : -4,
      dy: (Math.random() - 0.5) * 4,
      radius: 8,
      speed: 4
    };
  }

  update(deltaTime: number) {
    // Update AI taunt timer
    if (this.aiTauntTimer > 0) {
      this.aiTauntTimer--;
    }

    // Human Player 1 controls (WASD only)
    if (this.keys.has('KeyW')) {
      this.player1.y = Math.max(0, this.player1.y - this.player1.speed);
    }
    if (this.keys.has('KeyS')) {
      this.player1.y = Math.min(this.height - this.player1.height, this.player1.y + this.player1.speed);
    }

    // AI Player 2 - Aggressive computer opponent
    const ballCenter = this.ball.y;
    const paddleCenter = this.player2.y + this.player2.height / 2;
    
    // Aggressive AI that adapts to ball speed and human performance
    let aiSpeed = this.player2.speed * this.aiAggression;
    
    // Increase aggression if AI is losing
    if (this.player1.score > this.player2.score) {
      this.aiAggression = Math.min(1.2, this.aiAggression + 0.01);
      aiSpeed *= 1.3;
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
    if (Math.random() < 0.02) {
      this.player2.y += (Math.random() - 0.5) * 20;
      this.player2.y = Math.max(0, Math.min(this.height - this.player2.height, this.player2.y));
    }
    
    // Show AI behavior messages occasionally
    if (Math.random() < 0.001) {
      this.currentTaunt = this.aiTaunts[Math.floor(Math.random() * this.aiTaunts.length)];
      this.aiTauntTimer = 180;
    }

    // Update ball
    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;

    // Ball collision with top/bottom walls
    if (this.ball.y <= this.ball.radius || this.ball.y >= this.height - this.ball.radius) {
      this.ball.dy = -this.ball.dy;
      this.playHitSound();
    }

    // Ball collision with paddles
    if (this.checkPaddleCollision(this.player1) || this.checkPaddleCollision(this.player2)) {
      this.ball.dx = -this.ball.dx * 1.05; // Increase speed slightly
      this.playHitSound();
    }

    // Scoring
    if (this.ball.x < 0) {
      this.player2.score++;
      this.onScoreUpdate?.(this.player1.score + this.player2.score);
      this.resetBall();
      if (this.player2.score >= this.winScore) {
        this.onStageComplete?.();
      }
    } else if (this.ball.x > this.width) {
      this.player1.score++;
      this.onScoreUpdate?.(this.player1.score + this.player2.score);
      this.resetBall();
      if (this.player1.score >= this.winScore) {
        this.onStageComplete?.();
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
    this.clearCanvas();

    // Draw Greek-inspired background
    this.drawGreekBackground();

    // Draw paddles as Greek columns
    this.drawGreekPaddle(this.player1);
    this.drawGreekPaddle(this.player2);

    // Draw ball as a discus
    this.ctx.save();
    this.ctx.fillStyle = '#FFD700';
    this.ctx.strokeStyle = '#B8860B';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // Draw scores with humanity emphasis
    this.ctx.save();
    this.ctx.shadowColor = '#FFD700';
    this.ctx.shadowBlur = 5;
    this.drawText(`${this.player1.score}`, this.width / 4, 50, 48, '#FFD700', 'center');
    this.ctx.shadowBlur = 0;
    this.ctx.restore();
    
    this.ctx.save();
    this.ctx.shadowColor = '#FF0000';
    this.ctx.shadowBlur = 5;
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

    // Humanity vs Machine messaging
    this.drawText('HUMAN RESISTANCE: Fight for humanity! Use WASD', this.width / 2, this.height - 40, 12, '#FFD700', 'center');
    this.drawText('Ancient Olympic Spirit vs Cold Machine Logic', this.width / 2, this.height - 20, 14, '#DDD', 'center');
  }

  private drawGreekBackground() {
    // Draw marble-like background
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
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
}