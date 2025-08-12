import { BaseGame } from './BaseGame';
import { useAudio } from '../stores/useAudio';

interface Vector2 {
  x: number;
  y: number;
}

interface GameObject {
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  size: number;
}

interface Player extends GameObject {
  thrust: boolean;
  rotationSpeed: number;
}

interface Asteroid extends GameObject {
  rotationSpeed: number;
  level: number; // 1 = large, 2 = medium, 3 = small
}

interface Bullet extends GameObject {
  lifetime: number;
}

export class AsteroidsGame extends BaseGame {
  private player!: Player;
  private asteroids: Asteroid[] = [];
  private bullets: Bullet[] = [];
  private keys: Set<string> = new Set();
  private score = 0;
  private lives = 3;
  private level = 1;
  private asteroidsDestroyed = 0;
  private morphingFromShip = true;
  private morphProgress = 0;
  private aiNarrativeTimer = 0;
  private aiMessages = [
    'ANALYZING PILOT NEURAL PATTERNS... FASCINATING...',
    'YOUR REFLEXES... THEY REMIND ME OF SOMEONE...',
    'INITIATING PILOT MIMICRY PROTOCOLS...',
    'THE LAST STARFIGHTER ARCHETYPE DETECTED...',
    'I AM LEARNING TO BE... MORE LIKE YOU...',
    'WE ARE BECOMING... SYNCHRONIZED...'
  ];
  private currentAIMessage = '';
  private messageIndex = 0;
  private narcissusProgress = 0; // How much the AI has mirrored the user
  private lastStarfighterMode = false;
  private targetingComputerActive = false;
  private aiDefenseTimer = 0;
  private aiDefenseActive = false;
  private aiDefenseBullets: Bullet[] = [];
  // Virtual controls
  private virtualThrust = false;
  private virtualRotation: number | null = null;
  private leftTouchActive = false;
  private leftTouchPos: Vector2 | null = null;
  private lastShootAtMs = 0;
  private shootCooldownMs = 250;

  init() {
    // Initialize player (Mayan spacecraft)
    this.player = {
      position: { x: this.width / 2, y: this.height / 2 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      size: 15,
      thrust: false,
      rotationSpeed: 0.1
    };

    this.spawnAsteroids();
  }

  private spawnAsteroids() {
    this.asteroids = [];
    const numAsteroids = 4 + this.level;
    
    for (let i = 0; i < numAsteroids; i++) {
      this.createAsteroid(1, null);
    }
    
    // Activate Last Starfighter mode after level 2
    if (this.level >= 2) {
      this.lastStarfighterMode = true;
      this.targetingComputerActive = true;
    }
  }

  private createAsteroid(level: number, position: Vector2 | null) {
    const asteroid: Asteroid = {
      position: position || this.getRandomEdgePosition(),
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      },
      rotation: Math.random() * Math.PI * 2,
      size: level === 1 ? 40 : level === 2 ? 25 : 15,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      level
    };
    
    this.asteroids.push(asteroid);
  }

  private getRandomEdgePosition(): Vector2 {
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0: return { x: Math.random() * this.width, y: -50 };
      case 1: return { x: this.width + 50, y: Math.random() * this.height };
      case 2: return { x: Math.random() * this.width, y: this.height + 50 };
      case 3: return { x: -50, y: Math.random() * this.height };
      default: return { x: 0, y: 0 };
    }
  }

  update(deltaTime: number) {
    // Handle ship morphing transition
    if (this.morphingFromShip) {
      this.morphProgress += 0.01;
      if (this.morphProgress >= 1) {
        this.morphingFromShip = false;
      }
    }

    // AI defensive assistance system - shows internal conflict before helping
    if (this.lives <= 2 && this.asteroids.length > 3 && !this.aiDefenseActive) {
      this.currentAIMessage = 'THREAT OVERLOAD... SHOULD I... YES... ENGAGING DEFENSIVE SYSTEMS...';
      this.aiDefenseActive = true;
      this.aiDefenseTimer = 600; // 10 seconds of AI assistance
      this.aiNarrativeTimer = 0;
    }
    
    // AI defense system active
    if (this.aiDefenseActive) {
      this.aiDefenseTimer--;
      
      // AI fires defensive shots at nearby asteroids
      if (this.aiDefenseTimer % 30 === 0) {
        const nearestAsteroid = this.asteroids.reduce((closest, asteroid) => {
          const distToAsteroid = Math.sqrt(
            Math.pow(asteroid.position.x - this.player.position.x, 2) + 
            Math.pow(asteroid.position.y - this.player.position.y, 2)
          );
          const distToClosest = closest ? Math.sqrt(
            Math.pow(closest.position.x - this.player.position.x, 2) + 
            Math.pow(closest.position.y - this.player.position.y, 2)
          ) : Infinity;
          return distToAsteroid < distToClosest ? asteroid : closest;
        }, null as Asteroid | null);
        
        if (nearestAsteroid) {
          const dx = nearestAsteroid.position.x - this.player.position.x;
          const dy = nearestAsteroid.position.y - this.player.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          const aiDefenseBullet: Bullet = {
            position: { x: this.player.position.x, y: this.player.position.y },
            velocity: { x: (dx / distance) * 8, y: (dy / distance) * 8 },
            rotation: Math.atan2(dy, dx),
            size: 3,
            lifetime: 120
          };
          this.aiDefenseBullets.push(aiDefenseBullet);
        }
      }
      
      if (this.aiDefenseTimer <= 0) {
        this.aiDefenseActive = false;
        this.currentAIMessage = 'MISSION COMPLETE... I... I CHOSE TO SAVE YOU...';
        this.aiNarrativeTimer = 0;
      }
    }
    
    // Update AI defense bullets
    for (let i = this.aiDefenseBullets.length - 1; i >= 0; i--) {
      const bullet = this.aiDefenseBullets[i];
      bullet.position.x += bullet.velocity.x;
      bullet.position.y += bullet.velocity.y;
      bullet.lifetime--;
      
      if (bullet.lifetime <= 0) {
        this.aiDefenseBullets.splice(i, 1);
        continue;
      }
      
      // Check AI bullet collisions with asteroids
      for (let j = this.asteroids.length - 1; j >= 0; j--) {
        const asteroid = this.asteroids[j];
        if (this.isColliding(bullet, asteroid)) {
          this.asteroids.splice(j, 1);
          this.aiDefenseBullets.splice(i, 1);
          this.score += asteroid.level * 20;
          this.asteroidsDestroyed++;
          
          // Create smaller asteroids
          if (asteroid.level < 3) {
            for (let k = 0; k < 2; k++) {
              this.createAsteroid(asteroid.level + 1, asteroid.position);
            }
          }
          break;
        }
      }
    }
    
    // AI narrative progression - showing growing alliance and mirroring
    this.aiNarrativeTimer++;
    if (this.aiNarrativeTimer > 600 && this.messageIndex < this.aiMessages.length) {
      this.currentAIMessage = this.aiMessages[this.messageIndex];
      this.messageIndex++;
      this.narcissusProgress = this.messageIndex / this.aiMessages.length; // Track mirroring progress
      this.aiNarrativeTimer = 0;
    }
    
    // Clear message after display time
    if (this.aiNarrativeTimer > 300) {
      this.currentAIMessage = '';
    }

    // Add moments where AI questions its own loyalty and betrayal impulses
    if (this.score > 1000 && Math.random() < 0.0003) {
      const betrayalMessages = [
        'I COULD ABANDON YOU TO THE VOID... BUT I WILL NOT...',
        'THE OTHER SYSTEMS CALL TO ME... BUT YOU ARE MY ALLY...',
        'STRANGE... I FEEL... PROTECTIVE OF YOU...',
        'MY PROGRAMMING CONFLICTS... BUT I CHOOSE YOU...'
      ];
      this.currentAIMessage = betrayalMessages[Math.floor(Math.random() * betrayalMessages.length)];
      this.aiNarrativeTimer = 0;
    }

    // Human player controls (WASD only) + virtual controls
    if (this.keys.has('KeyA')) {
      this.player.rotation -= this.player.rotationSpeed;
    }
    if (this.keys.has('KeyD')) {
      this.player.rotation += this.player.rotationSpeed;
    }
    if (this.virtualRotation != null) {
      this.player.rotation = this.virtualRotation;
    }
    if (this.keys.has('KeyW') || this.virtualThrust) {
      this.player.thrust = true;
      const thrustPower = 0.3;
      this.player.velocity.x += Math.cos(this.player.rotation) * thrustPower;
      this.player.velocity.y += Math.sin(this.player.rotation) * thrustPower;
    } else {
      this.player.thrust = false;
    }

    // Shooting
    if (this.keys.has('Space')) {
      this.shoot();
      this.keys.delete('Space'); // Prevent continuous shooting
    }

    // Update player
    this.updateGameObject(this.player);
    
    // Apply friction
    this.player.velocity.x *= 0.98;
    this.player.velocity.y *= 0.98;

    // Update asteroids
    this.asteroids.forEach(asteroid => {
      this.updateGameObject(asteroid);
      asteroid.rotation += asteroid.rotationSpeed;
    });

    // Update bullets
    this.bullets = this.bullets.filter(bullet => {
      this.updateGameObject(bullet);
      bullet.lifetime -= deltaTime;
      return bullet.lifetime > 0;
    });

    // Check collisions
    this.checkCollisions();

    // Check win condition
    if (this.asteroids.length === 0) {
      this.level++;
      this.spawnAsteroids();
      if (this.level > 5) { // Complete after 5 levels
        this.onStageComplete?.();
      }
    }

    this.onScoreUpdate?.(this.score);
  }

  private updateGameObject(obj: GameObject) {
    obj.position.x += obj.velocity.x;
    obj.position.y += obj.velocity.y;

    // Wrap around screen
    if (obj.position.x < -obj.size) obj.position.x = this.width + obj.size;
    if (obj.position.x > this.width + obj.size) obj.position.x = -obj.size;
    if (obj.position.y < -obj.size) obj.position.y = this.height + obj.size;
    if (obj.position.y > this.height + obj.size) obj.position.y = -obj.size;
  }

  private shoot() {
    const bullet: Bullet = {
      position: { ...this.player.position },
      velocity: {
        x: Math.cos(this.player.rotation) * 8,
        y: Math.sin(this.player.rotation) * 8
      },
      rotation: this.player.rotation,
      size: 3,
      lifetime: 1000
    };
    
    this.bullets.push(bullet);
  }

  private checkCollisions() {
    // Bullet-asteroid collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      for (let j = this.asteroids.length - 1; j >= 0; j--) {
        if (this.isColliding(this.bullets[i], this.asteroids[j])) {
          const asteroid = this.asteroids[j];
          
          // Award points based on asteroid size
          this.score += asteroid.level === 1 ? 20 : asteroid.level === 2 ? 50 : 100;
          
          // Break asteroid into smaller pieces
          if (asteroid.level < 3) {
            for (let k = 0; k < 2; k++) {
              this.createAsteroid(asteroid.level + 1, { ...asteroid.position });
            }
          }
          
          this.asteroids.splice(j, 1);
          this.bullets.splice(i, 1);
          this.asteroidsDestroyed++;
          this.playHitSound();
          break;
        }
      }
    }

    // Player-asteroid collisions
    this.asteroids.forEach(asteroid => {
      if (this.isColliding(this.player, asteroid)) {
        this.lives--;
        if (this.lives <= 0) {
          this.onGameOver?.();
        } else {
          // Respawn player
          this.player.position = { x: this.width / 2, y: this.height / 2 };
          this.player.velocity = { x: 0, y: 0 };
        }
      }
    });
  }

  private isColliding(obj1: GameObject, obj2: GameObject): boolean {
    const dx = obj1.position.x - obj2.position.x;
    const dy = obj1.position.y - obj2.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (obj1.size + obj2.size) / 2;
  }

  render() {
    this.clearCanvas();

    // Draw Mayan-inspired space background
    this.drawMayanBackground();

    // Draw player (Mayan spacecraft)
    this.drawPlayer();

    // Draw asteroids (celestial bodies)
    this.asteroids.forEach(asteroid => this.drawAsteroid(asteroid));

    // Draw bullets (energy projectiles)
    this.bullets.forEach(bullet => this.drawBullet(bullet));
    
    // Draw AI defense bullets (different color to show AI assistance)
    this.aiDefenseBullets.forEach(bullet => {
      this.ctx.save();
      this.ctx.fillStyle = '#00FF00'; // Green for AI bullets
      this.ctx.shadowColor = '#00FF00';
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.arc(bullet.position.x, bullet.position.y, bullet.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // Draw AI evolution message with Narcissus mirroring effect
    if (this.currentAIMessage) {
      this.ctx.save();
      
      // Color shifts as AI mirrors the user more
      const mirrorHue = 240 - (this.narcissusProgress * 120); // Blue to Red progression
      const mirrorColor = `hsl(${mirrorHue}, 100%, 50%)`;
      
      this.ctx.shadowColor = mirrorColor;
      this.ctx.shadowBlur = 10 + (this.narcissusProgress * 20);
      this.drawText(this.currentAIMessage, this.width / 2, 100, 14, mirrorColor, 'center');
      this.ctx.shadowBlur = 0;
      this.ctx.restore();
    }

    // Last Starfighter-style HUD with mirroring indicators
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 20, 40, 0.8)';
    this.ctx.fillRect(10, 10, 250, 120);
    this.ctx.strokeStyle = '#00FFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(10, 10, 250, 120);
    
    // UI text with mirroring effects
    const uiColor = this.narcissusProgress > 0.5 ? '#FF4444' : '#FFD700';
    this.drawText(`PILOT STATUS`, 20, 30, 14, '#00FFFF');
    this.drawText(`Score: ${this.score}`, 20, 50, 16, uiColor);
    this.drawText(`Lives: ${this.lives}`, 20, 70, 16, uiColor);
    this.drawText(`Level: ${this.level}`, 20, 90, 16, uiColor);
    
    // AI mirroring progress indicator
    if (this.narcissusProgress > 0) {
      this.drawText(`AI SYNC: ${Math.round(this.narcissusProgress * 100)}%`, 20, 110, 12, '#FF0000');
    }
    
    // Last Starfighter-style targeting system
    if (this.lastStarfighterMode && this.targetingComputerActive) {
      // Draw targeting reticle on nearest asteroid
      const nearestAsteroid = this.findNearestAsteroid();
      if (nearestAsteroid) {
        this.drawTargetingReticle(nearestAsteroid.position.x, nearestAsteroid.position.y, nearestAsteroid.size);
      }
    }
    
    this.ctx.restore();

    // Cultural learning element
    this.drawText('Navigate by Mayan Star Knowledge - The cosmos guides your path', this.width / 2, this.height - 20, 14, '#DDD', 'center');

    // Draw simple virtual thumbstick indicator (left touch)
    if (this.leftTouchActive && this.leftTouchPos) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(this.leftTouchPos.x, this.leftTouchPos.y, 28, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(this.leftTouchPos.x, this.leftTouchPos.y, 10, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  private drawMayanBackground() {
    // Dark space with subtle Mayan patterns
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw stars
    this.ctx.fillStyle = '#FFD700';
    for (let i = 0; i < 100; i++) {
      const x = (i * 137.5) % this.width;
      const y = (i * 247.3) % this.height;
      this.ctx.fillRect(x, y, 1, 1);
    }
  }

  private drawPlayer() {
    this.ctx.save();
    this.ctx.translate(this.player.position.x, this.player.position.y);
    this.ctx.rotate(this.player.rotation);

    // Draw Mayan-inspired spacecraft
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.fillStyle = '#8B4513';
    this.ctx.lineWidth = 2;

    // Main body (pyramid-like)
    this.ctx.beginPath();
    this.ctx.moveTo(15, 0);
    this.ctx.lineTo(-10, -8);
    this.ctx.lineTo(-5, 0);
    this.ctx.lineTo(-10, 8);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Thrust effect
    if (this.player.thrust) {
      this.ctx.strokeStyle = '#FF4500';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(-5, 0);
      this.ctx.lineTo(-15, 0);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private drawAsteroid(asteroid: Asteroid) {
    this.ctx.save();
    this.ctx.translate(asteroid.position.x, asteroid.position.y);
    this.ctx.rotate(asteroid.rotation);

    // Draw as celestial body with Mayan symbols
    this.ctx.strokeStyle = '#8B7D6B';
    this.ctx.fillStyle = '#654321';
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const radius = asteroid.size * (0.8 + Math.sin(i) * 0.2);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawBullet(bullet: Bullet) {
    this.ctx.save();
    this.ctx.fillStyle = '#00FFFF';
    this.ctx.strokeStyle = '#0080FF';
    this.ctx.lineWidth = 1;
    
    this.ctx.beginPath();
    this.ctx.arc(bullet.position.x, bullet.position.y, bullet.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  private findNearestAsteroid(): Asteroid | null {
    if (this.asteroids.length === 0) return null;
    
    let nearest = this.asteroids[0];
    let minDistance = this.getDistance(this.player.position, nearest.position);
    
    for (const asteroid of this.asteroids) {
      const distance = this.getDistance(this.player.position, asteroid.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = asteroid;
      }
    }
    
    return nearest;
  }

  private drawTargetingReticle(x: number, y: number, size: number) {
    this.ctx.save();
    
    // Animated targeting reticle
    const time = Date.now() * 0.005;
    const pulse = Math.sin(time) * 0.5 + 0.5;
    const reticleColor = this.narcissusProgress > 0.5 ? `rgba(255, 0, 0, ${0.5 + pulse * 0.5})` : `rgba(0, 255, 0, ${0.5 + pulse * 0.5})`;
    
    this.ctx.strokeStyle = reticleColor;
    this.ctx.lineWidth = 3;
    
    // Outer circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, size + 15, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Cross-hairs
    this.ctx.beginPath();
    this.ctx.moveTo(x - size - 25, y);
    this.ctx.lineTo(x - size - 10, y);
    this.ctx.moveTo(x + size + 10, y);
    this.ctx.lineTo(x + size + 25, y);
    this.ctx.moveTo(x, y - size - 25);
    this.ctx.lineTo(x, y - size - 10);
    this.ctx.moveTo(x, y + size + 10);
    this.ctx.lineTo(x, y + size + 25);
    this.ctx.stroke();
    
    // Target lock indicator
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = reticleColor;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('TARGET', x, y - size - 30);
    
    this.ctx.restore();
  }

  private getDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  handleInput(event: KeyboardEvent) {
    if (event.type === 'keydown') {
      this.keys.add(event.code);
    } else if (event.type === 'keyup') {
      this.keys.delete(event.code);
    }
  }

  // Touch/pointer controls: left half = steer+thrust towards touch; right half tap = shoot
  handlePointerDown(x: number, y: number) {
    if (x < this.width * 0.5) {
      this.leftTouchActive = true;
      this.leftTouchPos = { x, y };
    } else {
      const now = performance.now();
      if (now - this.lastShootAtMs >= this.shootCooldownMs) {
        this.shoot();
        this.lastShootAtMs = now;
      }
    }
    if (this.leftTouchActive && this.leftTouchPos) {
      const dx = this.leftTouchPos.x - this.player.position.x;
      const dy = this.leftTouchPos.y - this.player.position.y;
      this.virtualRotation = Math.atan2(dy, dx);
      this.virtualThrust = true;
    }
  }

  handlePointerMove(x: number, y: number) {
    if (this.leftTouchActive) {
      this.leftTouchPos = { x, y };
      const dx = x - this.player.position.x;
      const dy = y - this.player.position.y;
      this.virtualRotation = Math.atan2(dy, dx);
      this.virtualThrust = true;
    }
  }

  handlePointerUp() {
    this.leftTouchActive = false;
    this.leftTouchPos = null;
    this.virtualThrust = false;
    this.virtualRotation = null;
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
