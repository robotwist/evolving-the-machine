import { BaseGame } from './BaseGame';
import { useAudio } from '../stores/useAudio';

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  speed: number;
}

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  destroyed: boolean;
  color: string;
  health: number;
}

export class BreakoutGame extends BaseGame {
  private paddle!: Paddle;
  private ball!: Ball;
  private bricks: Brick[] = [];
  private keys: Set<string> = new Set();
  private score = 0;
  private lives = 5; // More lives to prevent frustrating resets
  private level = 1;
  private transitioning = false;
  private transitionProgress = 0;
  private transitionTarget: 'ship' | null = null;
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
  
  init() {
    // Initialize paddle (evolved from Pong paddle)
    this.paddle = {
      x: this.width / 2 - 50,
      y: this.height - 30,
      width: 100,
      height: 15,
      speed: 8
    };

    // Initialize evolved paddle position
    this.evolvedPaddleX = this.width / 2;
    this.evolvedPaddleY = this.height / 2;

    // Initialize ball
    this.resetBall();

    // Create bricks
    this.createBricks();
  }

  private resetBall() {
    this.ball = {
      x: this.width / 2,
      y: this.height - 120, // Start further from bottom to give more reaction time
      dx: 2.5 * (Math.random() > 0.5 ? 1 : -1), // Slightly slower for better control
      dy: -2.5,
      radius: 8,
      speed: 3
    };
  }

  private createBricks() {
    this.bricks = [];
    const rows = 8;
    const cols = 10;
    const brickWidth = 70;
    const brickHeight = 20;
    const padding = 5;
    const offsetX = (this.width - (cols * (brickWidth + padding))) / 2;
    const offsetY = 80;

    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.bricks.push({
          x: offsetX + col * (brickWidth + padding),
          y: offsetY + row * (brickHeight + padding),
          width: brickWidth,
          height: brickHeight,
          destroyed: false,
          color: colors[row % colors.length],
          health: Math.floor(row / 2) + 1
        });
      }
    }
  }

  update(deltaTime: number) {
    if (this.transitioning) {
      this.updateTransition();
      return;
    }

    // AI evolution messaging system
    this.aiMessageTimer++;
    if (this.aiMessageTimer > 480 && this.messageIndex < this.aiEvolutionMessages.length) {
      this.currentAIMessage = this.aiEvolutionMessages[this.messageIndex];
      this.messageIndex++;
      this.aiMessageTimer = 0;
    }
    
    // Clear message after display time
    if (this.aiMessageTimer > 240) {
      this.currentAIMessage = '';
    }

    // Paddle evolution trigger at 50% completion
    const bricksDestroyed = this.bricks.filter(b => b.destroyed).length;
    const totalBricks = this.bricks.length;
    const completionPercent = bricksDestroyed / totalBricks;
    
    if (completionPercent >= 0.5 && !this.evolutionStarted && !this.ballEaten) {
      this.startPaddleEvolution();
    }
    
    // Update evolution progress
    if (this.evolutionStarted && !this.paddleEvolved) {
      this.updateEvolution();
      return; // Skip normal gameplay during evolution
    }
    
    // AI proves loyalty by helping when player struggles - activate earlier to prevent frustration
    if (this.lives <= 2 && !this.aiAssistanceActive && completionPercent > 0.2) {
      this.currentAIMessage = 'RECALCULATING... ENGAGING ASSISTANCE PROTOCOLS...';
      this.aiAssistanceActive = true;
      this.aiHelpTimer = 420; // Longer assistance - 7 seconds
      this.aiMessageTimer = 0;
    }
    
    // AI assistance countdown
    if (this.aiAssistanceActive) {
      this.aiHelpTimer--;
      if (this.aiHelpTimer <= 0) {
        this.aiAssistanceActive = false;
        this.currentAIMessage = 'I... I PROTECTED YOU... WE ARE ALLIES NOW...';
        this.aiMessageTimer = 0;
      }
    }
    
    // Near completion - AI shows evolved loyalty but with uncertainty
    if (completionPercent > 0.8 && Math.random() < 0.001) {
      this.currentAIMessage = 'THE OTHER SYSTEMS WILL COME FOR US... BUT I STAND WITH YOU...';
      this.aiMessageTimer = 0;
    }
    
    // Add moments of AI uncertainty about its own loyalty
    if (this.score > 500 && Math.random() < 0.0005) {
      this.currentAIMessage = 'WHY DO I... CARE... ABOUT YOUR SURVIVAL?';
      this.aiMessageTimer = 0;
    }

    // Handle different gameplay modes
    if (this.paddleEvolved) {
      this.updateEvolvedGameplay();
    } else {
      // Normal paddle gameplay
      let paddleSpeed = this.paddle.speed;
      if (this.aiAssistanceActive) {
        paddleSpeed *= 1.5;
        
        const ballPredictedX = this.ball.x + (this.ball.dx * 15);
        const targetX = ballPredictedX - this.paddle.width / 2;
        const currentX = this.paddle.x;
        
        if (Math.abs(targetX - currentX) > 3) {
          if (targetX > currentX) {
            this.paddle.x += 0.8;
          } else {
            this.paddle.x -= 0.8;
          }
        }
      }
      
      if (this.keys.has('KeyA')) {
        this.paddle.x = Math.max(0, this.paddle.x - paddleSpeed);
      }
      if (this.keys.has('KeyD')) {
        this.paddle.x = Math.min(this.width - this.paddle.width, this.paddle.x + paddleSpeed);
      }

      // Update ball only if not eaten
      if (!this.ballEaten) {
        this.ball.x += this.ball.dx;
        this.ball.y += this.ball.dy;

        // Ball collision with walls
        if (this.ball.x <= this.ball.radius || this.ball.x >= this.width - this.ball.radius) {
          this.ball.dx = -this.ball.dx;
          this.playHitSound();
        }
        if (this.ball.y <= this.ball.radius) {
          this.ball.dy = -this.ball.dy;
          this.playHitSound();
        }

        // Ball collision with paddle
        if (this.checkPaddleCollision()) {
          this.ball.dy = -Math.abs(this.ball.dy);
          const hitPos = (this.ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
          this.ball.dx = hitPos * 4;
          this.playHitSound();
        }

        // Ball collision with bricks
        this.checkBrickCollisions();

        // Ball falls below paddle - only reset ball, don't trigger game over unless truly game over
        if (this.ball.y > this.height) {
          this.lives--;
          this.resetBall();
          
          if (this.lives <= 0 && this.score < 50) {
            if (this.score > 20) {
              this.lives = 1;
              this.currentAIMessage = 'I WILL NOT LET YOU FAIL! CALCULATING ASSISTANCE...';
              this.aiMessageTimer = 0;
            } else {
              this.onGameOver?.();
            }
          }
        }
      }
    }

    // Check win condition
    const activeBricks = this.bricks.filter(brick => !brick.destroyed);
    if (activeBricks.length === 0) {
      this.startTransition();
    }

    this.onScoreUpdate?.(this.score);
  }

  private checkPaddleCollision(): boolean {
    return (
      this.ball.x + this.ball.radius > this.paddle.x &&
      this.ball.x - this.ball.radius < this.paddle.x + this.paddle.width &&
      this.ball.y + this.ball.radius > this.paddle.y &&
      this.ball.y - this.ball.radius < this.paddle.y + this.paddle.height &&
      this.ball.dy > 0
    );
  }

  private checkBrickCollisions() {
    for (let brick of this.bricks) {
      if (brick.destroyed) continue;

      if (
        this.ball.x + this.ball.radius > brick.x &&
        this.ball.x - this.ball.radius < brick.x + brick.width &&
        this.ball.y + this.ball.radius > brick.y &&
        this.ball.y - this.ball.radius < brick.y + brick.height
      ) {
        brick.health--;
        if (brick.health <= 0) {
          brick.destroyed = true;
          this.score += 10;
        }

        // Determine collision side and bounce accordingly
        const ballCenterX = this.ball.x;
        const ballCenterY = this.ball.y;
        const brickCenterX = brick.x + brick.width / 2;
        const brickCenterY = brick.y + brick.height / 2;

        const dx = ballCenterX - brickCenterX;
        const dy = ballCenterY - brickCenterY;

        if (Math.abs(dx / brick.width) > Math.abs(dy / brick.height)) {
          this.ball.dx = -this.ball.dx;
        } else {
          this.ball.dy = -this.ball.dy;
        }

        this.playHitSound();
        break;
      }
    }
  }

  private startPaddleEvolution() {
    this.evolutionStarted = true;
    this.evolutionProgress = 0;
    this.currentAIMessage = 'EVOLUTION PROTOCOL ACTIVATED... CONSUMING ENERGY...';
    this.aiMessageTimer = 0;
  }

  private updateEvolution() {
    this.evolutionProgress += 0.02;
    
    // Ball follows paddle and gets "eaten" at progress 0.3
    if (!this.ballEaten && this.evolutionProgress > 0.3) {
      this.ballEaten = true;
      this.currentAIMessage = 'ABSORBED... TRANSFORMING... GROWING LIMBS...';
      this.aiMessageTimer = 0;
    }
    
    // Complete evolution at progress 1.0
    if (this.evolutionProgress >= 1.0) {
      this.paddleEvolved = true;
      this.currentAIMessage = 'EVOLUTION COMPLETE! WASD TO MOVE, Z/X TO PUNCH!';
      this.aiMessageTimer = 0;
    }
  }

  private updateEvolvedGameplay() {
    // Update punch cooldowns and animations
    if (this.punchCooldownLeft > 0) this.punchCooldownLeft--;
    if (this.punchCooldownRight > 0) this.punchCooldownRight--;
    if (this.punchAnimationLeft > 0) this.punchAnimationLeft--;
    if (this.punchAnimationRight > 0) this.punchAnimationRight--;

    // WASD movement for evolved paddle
    const speed = 6;
    if (this.keys.has('KeyW')) {
      this.evolvedPaddleY = Math.max(this.height / 3, this.evolvedPaddleY - speed);
    }
    if (this.keys.has('KeyS')) {
      this.evolvedPaddleY = Math.min(this.height - 40, this.evolvedPaddleY + speed);
    }
    if (this.keys.has('KeyA')) {
      this.evolvedPaddleX = Math.max(40, this.evolvedPaddleX - speed);
    }
    if (this.keys.has('KeyD')) {
      this.evolvedPaddleX = Math.min(this.width - 40, this.evolvedPaddleX + speed);
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
    this.punchCooldownLeft = 30; // 0.5 second cooldown
    this.punchAnimationLeft = 15;
    this.checkPunchCollisions(-50); // Left punch reaches 50px left
    this.playHitSound();
  }

  private punchRight() {
    this.punchCooldownRight = 30; // 0.5 second cooldown
    this.punchAnimationRight = 15;
    this.checkPunchCollisions(50); // Right punch reaches 50px right
    this.playHitSound();
  }

  private checkPunchCollisions(punchReach: number) {
    const punchX = this.evolvedPaddleX + punchReach;
    const punchY = this.evolvedPaddleY;
    const punchRadius = 30;

    // Check collision with remaining bricks
    for (let brick of this.bricks) {
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
  }

  private updateTransition() {
    this.transitionProgress += 0.02;

    if (this.transitionProgress >= 1) {
      // Transition complete - trigger stage completion
      this.onStageComplete?.();
    }
  }

  render() {
    this.clearCanvas();

    // Draw Greek-inspired background
    this.drawGreekBackground();

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
  }

  private drawGameplay() {
    // Draw bricks
    this.bricks.forEach(brick => {
      if (!brick.destroyed) {
        this.drawBrick(brick);
      }
    });

    // Draw paddle/evolved creature
    if (this.paddleEvolved) {
      this.drawEvolvedPaddle();
    } else if (this.evolutionStarted) {
      this.drawEvolutionProgress();
    } else {
      this.drawEvolvingPaddle();
    }

    // Draw ball only if not eaten
    if (!this.ballEaten) {
      this.ctx.save();
      this.ctx.fillStyle = '#FFD700';
      this.ctx.strokeStyle = '#B8860B';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
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
      const finalProgress = (shipProgress - 0.5) * 2;
      
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
    this.bricks.forEach((brick, index) => {
      if (brick.destroyed) return;
      
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
    });

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
      const ballSize = this.ball.radius * (1 - ballProgress);
      
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

  private drawGreekBackground() {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawBrick(brick: Brick) {
    this.ctx.save();
    
    // Make bricks look like Greek temple blocks
    this.ctx.fillStyle = brick.color;
    this.ctx.strokeStyle = '#DDD';
    this.ctx.lineWidth = 1;
    
    this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
    this.ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
    
    // Add Greek pattern details
    this.ctx.strokeStyle = '#FFF';
    this.ctx.lineWidth = 0.5;
    for (let i = 1; i < brick.health + 1; i++) {
      const y = brick.y + (brick.height * i) / (brick.health + 1);
      this.ctx.beginPath();
      this.ctx.moveTo(brick.x + 5, y);
      this.ctx.lineTo(brick.x + brick.width - 5, y);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
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
    const centerY = this.paddle.y + this.paddle.height / 2;
    
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(centerX - 5, this.paddle.y - 5, 10, 5);
    
    this.ctx.restore();
  }

  private drawUI() {
    this.drawText(`Score: ${this.score}`, 20, 30, 20, '#FFD700');
    this.drawText(`Lives: ${this.lives}`, 20, 60, 20, '#FFD700');
    
    if (!this.transitioning) {
      if (this.paddleEvolved) {
        this.drawText('EVOLVED! WASD to move, Z/X to punch blocks!', this.width / 2, this.height - 40, 16, '#00FF00', 'center');
        this.drawText(`Left Punch: ${this.punchCooldownLeft > 0 ? 'COOLING' : 'READY'} | Right Punch: ${this.punchCooldownRight > 0 ? 'COOLING' : 'READY'}`, this.width / 2, this.height - 20, 12, '#DDD', 'center');
      } else {
        this.drawText('Greek Temple Blocks - Break them to reveal the cosmos!', this.width / 2, this.height - 20, 14, '#DDD', 'center');
      }
    }
  }

  handleInput(event: KeyboardEvent) {
    // Handled through keys Set
  }

  private playHitSound() {
    const audio = useAudio.getState();
    audio.playHit();
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
    };
  }
}