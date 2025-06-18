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
    // Handle input
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      this.player1.y = Math.max(0, this.player1.y - this.player1.speed);
    }
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      this.player1.y = Math.min(this.height - this.player1.height, this.player1.y + this.player1.speed);
    }

    // Player 2 controls (or AI)
    if (this.keys.has('ArrowUp') && !this.keys.has('KeyW')) {
      this.player2.y = Math.max(0, this.player2.y - this.player2.speed);
    }
    if (this.keys.has('ArrowDown') && !this.keys.has('KeyS')) {
      this.player2.y = Math.min(this.height - this.player2.height, this.player2.y + this.player2.speed);
    } else if (!this.keys.has('ArrowUp') && !this.keys.has('ArrowDown')) {
      // Simple AI for player 2
      const ballCenter = this.ball.y;
      const paddleCenter = this.player2.y + this.player2.height / 2;
      
      if (ballCenter < paddleCenter - 10) {
        this.player2.y = Math.max(0, this.player2.y - this.player2.speed * 0.7);
      } else if (ballCenter > paddleCenter + 10) {
        this.player2.y = Math.min(this.height - this.player2.height, this.player2.y + this.player2.speed * 0.7);
      }
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

    // Draw scores
    this.drawText(`${this.player1.score}`, this.width / 4, 50, 48, '#FFD700', 'center');
    this.drawText(`${this.player2.score}`, (3 * this.width) / 4, 50, 48, '#FFD700', 'center');

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

    // Cultural learning element
    this.drawText('Ancient Olympic Spirit: Fair Play & Competition', this.width / 2, this.height - 20, 14, '#DDD', 'center');
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
    // Draw as a Greek column
    this.ctx.save();
    
    // Column base
    this.ctx.fillStyle = '#F5F5DC';
    this.ctx.fillRect(paddle.x - 5, paddle.y + paddle.height - 10, paddle.width + 10, 10);
    
    // Column shaft
    this.ctx.fillStyle = '#FFFACD';
    this.ctx.fillRect(paddle.x, paddle.y + 10, paddle.width, paddle.height - 20);
    
    // Column capital
    this.ctx.fillStyle = '#F5F5DC';
    this.ctx.fillRect(paddle.x - 5, paddle.y, paddle.width + 10, 10);
    
    // Decorative lines
    this.ctx.strokeStyle = '#DDD';
    this.ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = paddle.y + (paddle.height * i) / 4;
      this.ctx.beginPath();
      this.ctx.moveTo(paddle.x, y);
      this.ctx.lineTo(paddle.x + paddle.width, y);
      this.ctx.stroke();
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