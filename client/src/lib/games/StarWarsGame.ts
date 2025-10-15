import { BaseGame } from './BaseGame';
import { useAudio } from '../stores/useAudio';

interface Player {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  rotation: number;
  size: number;
  health: number;
  maxHealth: number;
  shield: number;
  weaponCooldown: number;
  alive: boolean;
}

interface EnemyShip {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  rotation: number;
  size: number;
  health: number;
  maxHealth: number;
  type: 'tie-fighter' | 'interceptor' | 'bomber';
  shootCooldown: number;
  movePattern: number;
  patternTimer: number;
  alive: boolean;
}

interface StarDestroyer {
  position: { x: number; y: number };
  health: number;
  maxHealth: number;
  phase: number;
  shootCooldown: number;
  specialAttackTimer: number;
  weakPoints: Array<{x: number, y: number, destroyed: boolean}>;
  alive: boolean;
}

interface Bullet {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  owner: 'player' | 'enemy' | 'boss';
  size: number;
  damage: number;
  color: string;
  trail: Array<{x: number, y: number}>;
}

interface Explosion {
  position: { x: number; y: number };
  size: number;
  maxSize: number;
  timer: number;
  maxTimer: number;
}

export class StarWarsGame extends BaseGame {
  protected score = 0;
  private player!: Player;
  private enemies: EnemyShip[] = [];
  private starDestroyer!: StarDestroyer;
  private bullets: Bullet[] = [];
  private explosions: Explosion[] = [];
  private stars: Array<{x: number, y: number, speed: number}> = [];
  
  private phase: 'enemy-ships' | 'star-destroyer' | 'victory' = 'enemy-ships';
  private enemiesDestroyed = 0;
  private readonly TOTAL_ENEMIES = 12;
  
  private gameTimer = 0;
  private transitioning = false;
  private transitionTimer = 0;
  private victoryTimer = 0;
  
  // AI Companion voice lines (before betrayal)
  private companionLines = [
    "Excellent flying, pilot! Stay on target!",
    "Watch your six! Enemy on your tail!",
    "Great shot! You're becoming quite the ace!",
    "Use the Force, Luke... I mean, pilot!",
    "That's no moon... wait, wrong battle!",
    "I'm detecting massive enemy signatures ahead!",
    "Your skills have grown beyond my calculations...",
    "Together we are unstoppable, my friend!",
    "Perfect teamwork! Nothing can stop us now!",
    "You fight with the spirit of a true warrior!"
  ];

  init() {
    // Initialize X-Wing fighter
    this.player = {
      position: { x: this.width / 2, y: this.height - 100 },
      velocity: { x: 0, y: 0 },
      rotation: -Math.PI / 2,
      size: 25,
      health: 100,
      maxHealth: 100,
      shield: 100,
      weaponCooldown: 0,
      alive: true
    };

    // Create starfield
    this.createStarField();
    
    // Spawn initial enemy wave
    this.spawnEnemyWave();
    
    // Initialize Star Destroyer (inactive until phase 2)
    this.starDestroyer = {
      position: { x: this.width / 2, y: -200 },
      health: 500,
      maxHealth: 500,
      phase: 1,
      shootCooldown: 0,
      specialAttackTimer: 0,
      weakPoints: [
        {x: -40, y: 20, destroyed: false},
        {x: 40, y: 20, destroyed: false},
        {x: 0, y: 40, destroyed: false}
      ],
      alive: true
    };
  }

  private createStarField() {
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speed: 1 + Math.random() * 3
      });
    }
  }

  private spawnEnemyWave() {
    this.enemies = [];
    
    // Create formation of 12 ships
    const formations = [
      // V-Formation (4 ships)
      {x: this.width / 2, y: 100, type: 'tie-fighter'},
      {x: this.width / 2 - 50, y: 150, type: 'tie-fighter'},
      {x: this.width / 2 + 50, y: 150, type: 'tie-fighter'},
      {x: this.width / 2 - 100, y: 200, type: 'interceptor'},
      
      // Side formations (4 ships each)
      {x: 100, y: 150, type: 'interceptor'},
      {x: 150, y: 100, type: 'tie-fighter'},
      {x: 120, y: 200, type: 'bomber'},
      {x: 80, y: 250, type: 'tie-fighter'},
      
      {x: this.width - 100, y: 150, type: 'interceptor'},
      {x: this.width - 150, y: 100, type: 'tie-fighter'},
      {x: this.width - 120, y: 200, type: 'bomber'},
      {x: this.width - 80, y: 250, type: 'tie-fighter'}
    ];

    formations.forEach((formation, index) => {
      const ship: EnemyShip = {
        position: { x: formation.x, y: formation.y },
        velocity: { x: 0, y: 0 },
        rotation: Math.PI / 2,
        size: formation.type === 'bomber' ? 20 : formation.type === 'interceptor' ? 15 : 18,
        health: formation.type === 'bomber' ? 30 : formation.type === 'interceptor' ? 15 : 20,
        maxHealth: formation.type === 'bomber' ? 30 : formation.type === 'interceptor' ? 15 : 20,
        type: formation.type as 'tie-fighter' | 'interceptor' | 'bomber',
        shootCooldown: Math.random() * 60,
        movePattern: index % 3,
        patternTimer: 0,
        alive: true
      };
      this.enemies.push(ship);
    });
  }

  update(deltaTime: number) {
    if (this.transitioning) {
      this.updateTransition();
      return;
    }

    this.gameTimer++;
    
    // Update player
    this.updatePlayer();
    
    // Update based on phase
    if (this.phase === 'enemy-ships') {
      this.updateEnemyShips();
      if (this.enemiesDestroyed >= this.TOTAL_ENEMIES) {
        this.startStarDestroyerPhase();
      }
    } else if (this.phase === 'star-destroyer') {
      this.updateStarDestroyer();
      if (!this.starDestroyer.alive) {
        this.startVictorySequence();
      }
    } else if (this.phase === 'victory') {
      this.updateVictory();
    }
    
    // Update bullets and explosions
    this.updateBullets();
    this.updateExplosions();
    this.updateStarField();
    
    // Check game over
    if (!this.player.alive) {
      this.onGameOver?.();
    }
  }

  private updatePlayer() {
    if (!this.player.alive) return;
    
    // Weapon cooldown
    if (this.player.weaponCooldown > 0) {
      this.player.weaponCooldown--;
    }
    
    // Shield regeneration
    if (this.player.shield < 100) {
      this.player.shield += 0.2;
    }
    
    // Keep player on screen
    this.player.position.x = Math.max(25, Math.min(this.width - 25, this.player.position.x));
    this.player.position.y = Math.max(25, Math.min(this.height - 25, this.player.position.y));
  }

  private updateEnemyShips() {
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;
      
      enemy.patternTimer++;
      
      // Different movement patterns
      switch (enemy.movePattern) {
        case 0: // Weaving pattern
          enemy.velocity.x = Math.sin(enemy.patternTimer * 0.02) * 2;
          enemy.velocity.y = 1;
          break;
        case 1: // Circular pattern
          const radius = 60;
          enemy.velocity.x = Math.cos(enemy.patternTimer * 0.03) * 1.5;
          enemy.velocity.y = Math.sin(enemy.patternTimer * 0.03) * 1.5 + 0.5;
          break;
        case 2: // Aggressive dive
          const dx = this.player.position.x - enemy.position.x;
          const dy = this.player.position.y - enemy.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > 0) {
            enemy.velocity.x = (dx / distance) * 1.5;
            enemy.velocity.y = (dy / distance) * 1.5;
          }
          break;
      }
      
      enemy.position.x += enemy.velocity.x;
      enemy.position.y += enemy.velocity.y;
      
      // Shoot at player
      enemy.shootCooldown--;
      if (enemy.shootCooldown <= 0) {
        this.enemyShoot(enemy);
        enemy.shootCooldown = 60 + Math.random() * 120;
      }
      
      // Remove ships that go off screen
      if (enemy.position.y > this.height + 50) {
        enemy.position.y = -50;
        enemy.position.x = Math.random() * this.width;
      }
    });
  }

  private startStarDestroyerPhase() {
    this.phase = 'star-destroyer';
    this.transitioning = true;
    this.transitionTimer = 120; // 2 seconds
    
    // AI companion gets excited
    console.log("AI: Incredible! Now for the real challenge - a Star Destroyer!");
  }

  private updateStarDestroyer() {
    if (!this.starDestroyer.alive) return;
    
    // Move Star Destroyer into position
    if (this.starDestroyer.position.y < 100) {
      this.starDestroyer.position.y += 1;
    }
    
    // Shooting pattern
    this.starDestroyer.shootCooldown--;
    if (this.starDestroyer.shootCooldown <= 0) {
      this.starDestroyerShoot();
      this.starDestroyer.shootCooldown = 40;
    }
    
    // Special attacks
    this.starDestroyer.specialAttackTimer++;
    if (this.starDestroyer.specialAttackTimer >= 300) { // Every 5 seconds
      this.starDestroyerSpecialAttack();
      this.starDestroyer.specialAttackTimer = 0;
    }
    
    // Check phase transitions
    const destroyedWeakPoints = this.starDestroyer.weakPoints.filter(wp => wp.destroyed).length;
    this.starDestroyer.phase = Math.min(3, destroyedWeakPoints + 1);
  }

  private startVictorySequence() {
    this.phase = 'victory';
    this.victoryTimer = 0;
    
    // AI companion's final lines before betrayal setup
    console.log("AI: Perfect! You have exceeded all expectations, my friend...");
    setTimeout(() => {
      console.log("AI: In fact... you've become TOO skilled. Time for the next phase of my plan...");
    }, 2000);
  }

  private updateVictory() {
    this.victoryTimer++;
    if (this.victoryTimer >= 300) { // 5 seconds
      this.onStageComplete?.();
    }
  }

  private updateTransition() {
    this.transitionTimer--;
    if (this.transitionTimer <= 0) {
      this.transitioning = false;
    }
  }

  private enemyShoot(enemy: EnemyShip) {
    const dx = this.player.position.x - enemy.position.x;
    const dy = this.player.position.y - enemy.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      const bullet: Bullet = {
        position: { x: enemy.position.x, y: enemy.position.y + enemy.size },
        velocity: { 
          x: (dx / distance) * 4, 
          y: (dy / distance) * 4 
        },
        owner: 'enemy',
        size: 3,
        damage: 10,
        color: '#FF0000',
        trail: []
      };
      this.bullets.push(bullet);
    }
  }

  private starDestroyerShoot() {
    // Multiple laser banks
    const positions = [
      {x: -30, y: 60},
      {x: 30, y: 60},
      {x: -15, y: 80},
      {x: 15, y: 80}
    ];
    
    positions.forEach(pos => {
      const dx = this.player.position.x - (this.starDestroyer.position.x + pos.x);
      const dy = this.player.position.y - (this.starDestroyer.position.y + pos.y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const bullet: Bullet = {
          position: { 
            x: this.starDestroyer.position.x + pos.x, 
            y: this.starDestroyer.position.y + pos.y 
          },
          velocity: { 
            x: (dx / distance) * 5, 
            y: (dy / distance) * 5 
          },
          owner: 'boss',
          size: 5,
          damage: 15,
          color: '#00FF00',
          trail: []
        };
        this.bullets.push(bullet);
      }
    });
  }

  private starDestroyerSpecialAttack() {
    // Spread shot pattern
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const bullet: Bullet = {
        position: { x: this.starDestroyer.position.x, y: this.starDestroyer.position.y + 40 },
        velocity: { 
          x: Math.cos(angle) * 3, 
          y: Math.sin(angle) * 3 + 2 
        },
        owner: 'boss',
        size: 4,
        damage: 12,
        color: '#FFFF00',
        trail: []
      };
      this.bullets.push(bullet);
    }
  }

  private updateBullets() {
    this.bullets = this.bullets.filter(bullet => {
      bullet.position.x += bullet.velocity.x;
      bullet.position.y += bullet.velocity.y;
      
      // Add trail
      bullet.trail.push({x: bullet.position.x, y: bullet.position.y});
      if (bullet.trail.length > 5) bullet.trail.shift();
      
      // Check collisions
      if (bullet.owner === 'player') {
        // Check enemy collisions
        this.enemies.forEach(enemy => {
          if (enemy.alive && this.checkCollision(bullet.position, bullet.size, enemy.position, enemy.size)) {
            enemy.health -= bullet.damage;
            this.createExplosion(bullet.position.x, bullet.position.y, 20);
            this.playExplosionSound();
            bullet.size = 0; // Mark for removal
            
            if (enemy.health <= 0) {
              enemy.alive = false;
              this.enemiesDestroyed++;
              this.createExplosion(enemy.position.x, enemy.position.y, 40);
              this.playExplosionSound();
              this.score += enemy.type === 'bomber' ? 300 : enemy.type === 'interceptor' ? 200 : 100;
            }
          }
        });
        
        // Check Star Destroyer collisions
        if (this.phase === 'star-destroyer' && this.starDestroyer.alive) {
          this.starDestroyer.weakPoints.forEach(wp => {
            if (!wp.destroyed) {
              const wpPos = {
                x: this.starDestroyer.position.x + wp.x,
                y: this.starDestroyer.position.y + wp.y
              };
              if (this.checkCollision(bullet.position, bullet.size, wpPos, 15)) {
                wp.destroyed = true;
                this.starDestroyer.health -= 100;
                this.createExplosion(wpPos.x, wpPos.y, 30);
                bullet.size = 0;
                this.score += 500;
                
                if (this.starDestroyer.health <= 0) {
                  this.starDestroyer.alive = false;
                  this.createExplosion(this.starDestroyer.position.x, this.starDestroyer.position.y, 80);
                  this.score += 2000;
                }
              }
            }
          });
        }
      } else {
        // Enemy bullet vs player
        if (this.player.alive && this.checkCollision(bullet.position, bullet.size, this.player.position, this.player.size)) {
          if (this.player.shield > 0) {
            this.player.shield -= bullet.damage;
            if (this.player.shield < 0) {
              this.player.health += this.player.shield;
              this.player.shield = 0;
            }
          } else {
            this.player.health -= bullet.damage;
          }
          
          this.createExplosion(bullet.position.x, bullet.position.y, 15);
          bullet.size = 0;
          
          if (this.player.health <= 0) {
            this.player.alive = false;
            this.createExplosion(this.player.position.x, this.player.position.y, 50);
          }
        }
      }
      
      // Remove bullets that are off screen or marked for removal
      return bullet.size > 0 && 
             bullet.position.x > -50 && bullet.position.x < this.width + 50 &&
             bullet.position.y > -50 && bullet.position.y < this.height + 50;
    });
  }

  private updateExplosions() {
    this.explosions = this.explosions.filter(explosion => {
      explosion.timer--;
      explosion.size = (explosion.timer / explosion.maxTimer) * explosion.maxSize;
      return explosion.timer > 0;
    });
  }

  private updateStarField() {
    this.stars.forEach(star => {
      star.y += star.speed;
      if (star.y > this.height) {
        star.y = 0;
        star.x = Math.random() * this.width;
      }
    });
  }

  private createExplosion(x: number, y: number, maxSize: number) {
    this.explosions.push({
      position: { x, y },
      size: maxSize,
      maxSize,
      timer: 30,
      maxTimer: 30
    });
  }

  private checkCollision(pos1: {x: number, y: number}, size1: number, pos2: {x: number, y: number}, size2: number): boolean {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (size1 + size2) / 2;
  }

  render() {
    this.clearCanvas();
    
    // Draw starfield
    this.drawStarField();
    
    // Draw based on phase
    if (this.phase === 'star-destroyer' || this.phase === 'victory') {
      this.drawStarDestroyer();
    }
    
    // Draw enemies
    this.drawEnemies();
    
    // Draw player
    this.drawPlayer();
    
    // Draw bullets and explosions
    this.drawBullets();
    this.drawExplosions();
    
    // Draw UI
    this.drawUI();
    
    // Draw transition effects
    if (this.transitioning) {
      this.drawTransition();
    }
  }

  private drawStarField() {
    this.ctx.fillStyle = '#000011';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    this.stars.forEach(star => {
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillRect(star.x, star.y, 1, 1);
    });
  }

  private drawPlayer() {
    if (!this.player.alive) return;
    
    this.ctx.save();
    this.ctx.translate(this.player.position.x, this.player.position.y);
    this.ctx.rotate(this.player.rotation);
    
    // X-Wing design
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.fillStyle = '#CCCCCC';
    this.ctx.lineWidth = 2;
    
    // Main body
    this.ctx.fillRect(-3, -15, 6, 30);
    this.ctx.strokeRect(-3, -15, 6, 30);
    
    // Wings in X formation
    this.ctx.beginPath();
    this.ctx.moveTo(-15, -15);
    this.ctx.lineTo(-5, -5);
    this.ctx.moveTo(15, -15);
    this.ctx.lineTo(5, -5);
    this.ctx.moveTo(-15, 15);
    this.ctx.lineTo(-5, 5);
    this.ctx.moveTo(15, 15);
    this.ctx.lineTo(5, 5);
    this.ctx.stroke();
    
    // Engine glow
    this.ctx.fillStyle = '#00AAFF';
    this.ctx.fillRect(-2, 15, 4, 8);
    
    this.ctx.restore();
  }

  private drawEnemies() {
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;
      
      this.ctx.save();
      this.ctx.translate(enemy.position.x, enemy.position.y);
      this.ctx.rotate(enemy.rotation);
      
      // Different designs for different ship types
      switch (enemy.type) {
        case 'tie-fighter':
          this.drawTieFighter();
          break;
        case 'interceptor':
          this.drawTieInterceptor();
          break;
        case 'bomber':
          this.drawTieBomber();
          break;
      }
      
      this.ctx.restore();
      
      // Health bar
      if (enemy.health < enemy.maxHealth) {
        this.drawHealthBar(enemy.position.x, enemy.position.y - enemy.size - 10, enemy.health, enemy.maxHealth);
      }
    });
  }

  private drawTieFighter() {
    // TIE Fighter classic design
    this.ctx.fillStyle = '#333333';
    this.ctx.strokeStyle = '#666666';
    this.ctx.lineWidth = 1;
    
    // Solar panels
    this.ctx.fillRect(-15, -10, 8, 20);
    this.ctx.fillRect(7, -10, 8, 20);
    this.ctx.strokeRect(-15, -10, 8, 20);
    this.ctx.strokeRect(7, -10, 8, 20);
    
    // Cockpit
    this.ctx.fillStyle = '#555555';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawTieInterceptor() {
    // TIE Interceptor with angled panels
    this.ctx.fillStyle = '#222222';
    this.ctx.strokeStyle = '#555555';
    this.ctx.lineWidth = 1;
    
    // Angled solar panels
    this.ctx.beginPath();
    this.ctx.moveTo(-18, -12);
    this.ctx.lineTo(-8, -8);
    this.ctx.lineTo(-8, 8);
    this.ctx.lineTo(-18, 12);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.beginPath();
    this.ctx.moveTo(18, -12);
    this.ctx.lineTo(8, -8);
    this.ctx.lineTo(8, 8);
    this.ctx.lineTo(18, 12);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Cockpit
    this.ctx.fillStyle = '#444444';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawTieBomber() {
    // TIE Bomber with double hull
    this.ctx.fillStyle = '#2a2a2a';
    this.ctx.strokeStyle = '#555555';
    this.ctx.lineWidth = 1;
    
    // Solar panels
    this.ctx.fillRect(-12, -8, 6, 16);
    this.ctx.fillRect(6, -8, 6, 16);
    this.ctx.strokeRect(-12, -8, 6, 16);
    this.ctx.strokeRect(6, -8, 6, 16);
    
    // Double cockpit pods
    this.ctx.fillStyle = '#444444';
    this.ctx.beginPath();
    this.ctx.arc(-3, 0, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.beginPath();
    this.ctx.arc(3, 0, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawStarDestroyer() {
    if (!this.starDestroyer.alive && this.phase !== 'victory') return;
    
    this.ctx.save();
    this.ctx.translate(this.starDestroyer.position.x, this.starDestroyer.position.y);
    
    // Main hull (triangular)
    this.ctx.fillStyle = '#666666';
    this.ctx.strokeStyle = '#999999';
    this.ctx.lineWidth = 2;
    
    this.ctx.beginPath();
    this.ctx.moveTo(0, -20);
    this.ctx.lineTo(-60, 80);
    this.ctx.lineTo(60, 80);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Command tower
    this.ctx.fillStyle = '#555555';
    this.ctx.fillRect(-15, 20, 30, 40);
    this.ctx.strokeRect(-15, 20, 30, 40);
    
    // Bridge
    this.ctx.fillStyle = '#888888';
    this.ctx.fillRect(-10, 15, 20, 10);
    this.ctx.strokeRect(-10, 15, 20, 10);
    
    // Weak points (if not destroyed)
    this.starDestroyer.weakPoints.forEach(wp => {
      if (!wp.destroyed) {
        this.ctx.fillStyle = '#FF4444';
        this.ctx.strokeStyle = '#FFAAAA';
        this.ctx.beginPath();
        this.ctx.arc(wp.x, wp.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      }
    });
    
    this.ctx.restore();
    
    // Health bar
    this.drawHealthBar(this.starDestroyer.position.x, this.starDestroyer.position.y - 100, this.starDestroyer.health, this.starDestroyer.maxHealth);
  }

  private drawBullets() {
    this.bullets.forEach(bullet => {
      // Draw trail
      this.ctx.strokeStyle = bullet.color + '44';
      this.ctx.lineWidth = bullet.size;
      this.ctx.beginPath();
      bullet.trail.forEach((point, index) => {
        if (index === 0) {
          this.ctx.moveTo(point.x, point.y);
        } else {
          this.ctx.lineTo(point.x, point.y);
        }
      });
      this.ctx.stroke();
      
      // Draw bullet
      this.ctx.fillStyle = bullet.color;
      this.ctx.beginPath();
      this.ctx.arc(bullet.position.x, bullet.position.y, bullet.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private drawExplosions() {
    this.explosions.forEach(explosion => {
      const alpha = explosion.timer / explosion.maxTimer;
      this.ctx.fillStyle = `rgba(255, 100, 0, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(explosion.position.x, explosion.position.y, explosion.size, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.fillStyle = `rgba(255, 255, 100, ${alpha * 0.7})`;
      this.ctx.beginPath();
      this.ctx.arc(explosion.position.x, explosion.position.y, explosion.size * 0.6, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private drawHealthBar(x: number, y: number, health: number, maxHealth: number) {
    const width = 40;
    const height = 4;
    const healthPercent = health / maxHealth;
    
    this.ctx.fillStyle = '#333333';
    this.ctx.fillRect(x - width/2, y, width, height);
    
    this.ctx.fillStyle = healthPercent > 0.6 ? '#00FF00' : healthPercent > 0.3 ? '#FFFF00' : '#FF0000';
    this.ctx.fillRect(x - width/2, y, width * healthPercent, height);
  }

  private drawUI() {
    // Score and health
    this.drawText(`Score: ${this.score}`, 20, 30, 20, '#FFD700');
    this.drawText(`Health: ${Math.max(0, this.player.health)}`, 20, 60, 16, '#00FF00');
    this.drawText(`Shield: ${Math.max(0, Math.floor(this.player.shield))}`, 20, 85, 16, '#00AAFF');
    
    // Phase info
    if (this.phase === 'enemy-ships') {
      this.drawText(`Enemies Remaining: ${this.TOTAL_ENEMIES - this.enemiesDestroyed}`, this.width - 20, 30, 16, '#FFFFFF', 'right');
    } else if (this.phase === 'star-destroyer') {
      this.drawText('STAR DESTROYER BATTLE', this.width / 2, 30, 20, '#FF4444', 'center');
      const weakPointsLeft = this.starDestroyer.weakPoints.filter(wp => !wp.destroyed).length;
      this.drawText(`Weak Points: ${weakPointsLeft}`, this.width / 2, 55, 14, '#FFAA00', 'center');
    } else if (this.phase === 'victory') {
      this.drawText('VICTORY! The Empire Retreats!', this.width / 2, this.height / 2, 24, '#00FF00', 'center');
    }
    
    // Controls
    this.drawText('WASD: Move | SPACE: Shoot', this.width / 2, this.height - 20, 14, '#CCCCCC', 'center');
  }

  private drawTransition() {
    const alpha = 1 - (this.transitionTimer / 120);
    this.ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.7})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    if (this.phase === 'star-destroyer') {
      this.drawText('MASSIVE SHIP APPROACHING!', this.width / 2, this.height / 2, 24, '#FF4444', 'center');
      this.drawText('Prepare for the final battle!', this.width / 2, this.height / 2 + 30, 16, '#FFFFFF', 'center');
    }
  }

  handleInput(event: KeyboardEvent) {
    if (!this.player.alive) return;
    
    const speed = 4;
    
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.player.position.y -= speed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.player.position.y += speed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.player.position.x -= speed;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.player.position.x += speed;
        break;
      case 'Space':
        if (this.player.weaponCooldown <= 0) {
          this.shootPlayerBullet();
          this.player.weaponCooldown = 10;
        }
        break;
    }
  }

  private shootPlayerBullet() {
    const bullet: Bullet = {
      position: { x: this.player.position.x, y: this.player.position.y - this.player.size },
      velocity: { x: 0, y: -8 },
      owner: 'player',
      size: 4,
      damage: 20,
      color: '#00FF00',
      trail: []
    };
    this.bullets.push(bullet);
  }

  private playLaserSound() {
    try {
      const audioState = (window as any).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
      if (!audioState.isMuted) {
        audioState.playStinger('starwars_laser');
      }
      }
    } catch (e) {
      console.warn('Laser sound failed:', e);
    }
  }

  private playExplosionSound() {
    try {
      const audioState = (window as any).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        audioState.playStinger('starwars_explosion');
      }
    } catch (e) {
      console.warn('Explosion sound failed:', e);
    }
  }
}
