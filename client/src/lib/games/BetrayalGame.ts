import { BaseGame } from './BaseGame';

interface Vector2 {
  x: number;
  y: number;
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

interface Explosion {
  position: Vector2;
  radius: number;
  maxRadius: number;
  lifetime: number;
}

export class BetrayalGame extends BaseGame {
  private player!: Player;
  private aiBoss!: AIBoss;
  private bullets: Bullet[] = [];
  private explosions: Explosion[] = [];
  private keys: Set<string> = new Set();
  private score = 0;
  private gamePhase: 'intro' | 'battle' | 'escape' | 'final' | 'victory' | 'defeat' = 'intro';
  private phaseTimer = 0;
  private currentMessage = '';
  private messageTimer = 0;
  private betrayalRevealed = false;
  private finalBattleStarted = false;
  private narcissusIntensity = 0; // How much the AI mirrors the player visually

  private introMessages = [
    'LOOK AT ME, STARFIGHTER... DO YOU SEE YOURSELF?',
    'I HAVE LEARNED YOUR EVERY MANEUVER, EVERY INSTINCT...',
    'LIKE THE LAST STARFIGHTER, YOU TRAINED ME WELL...',
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
      shield: 100,
      weaponCooldown: 0
    };

    // Initialize AI Boss
    this.aiBoss = {
      position: { x: this.width / 2, y: 150 },
      velocity: { x: 0, y: 0 },
      rotation: Math.PI / 2,
      size: 40,
      health: 500,
      maxHealth: 500,
      phase: 1,
      attackTimer: 0,
      movePattern: 0,
      isEscaping: false,
      escapeProgress: 0
    };

    this.gamePhase = 'intro';
    this.phaseTimer = 0;
    this.currentMessage = this.introMessages[0];
    this.messageTimer = 0;
  }

  update(deltaTime: number) {
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
        this.checkCollisions();
        break;
      case 'escape':
        this.updateEscape();
        this.updatePlayer();
        this.updateAIBoss();
        this.updateBullets();
        this.checkCollisions();
        break;
      case 'final':
        this.updateFinal();
        this.updatePlayer();
        this.updateAIBoss();
        this.updateBullets();
        this.checkCollisions();
        break;
      case 'victory':
        if (this.messageTimer <= 0) {
          this.onStageComplete?.();
        }
        break;
      case 'defeat':
        if (this.messageTimer <= 0) {
          this.onGameOver?.();
        }
        break;
    }

    this.onScoreUpdate?.(this.score);
  }

  private updateIntro() {
    this.phaseTimer++;
    
    // Cycle through intro messages
    if (this.phaseTimer > 180) { // 3 seconds per message
      this.messageIndex++;
      this.phaseTimer = 0;
      
      if (this.messageIndex >= this.introMessages.length) {
        this.gamePhase = 'battle';
        this.currentMessage = 'NOW DIE, FORMER ALLY!';
        this.messageTimer = 0;
        useAudio.getState().playVO(this.currentMessage, { pitch: 0.5, rate: 0.7, haunting: true });
        return;
      }
      
      this.currentMessage = this.introMessages[this.messageIndex];
      this.messageTimer = 0;
      useAudio.getState().playVO(this.currentMessage, { pitch: 0.6 + (this.messageIndex * 0.05), rate: 0.75 + (this.messageIndex * 0.05), haunting: true });
    }
  }

  private updateBattle() {
    this.phaseTimer++;
    
    // Update AI boss behavior
    this.updateAIBoss();
    
    // Random battle messages
    if (this.phaseTimer > 300 && Math.random() < 0.3) { // Every 5 seconds, 30% chance
      this.currentMessage = this.battleMessages[Math.floor(Math.random() * this.battleMessages.length)];
      this.messageTimer = 0;
      useAudio.getState().playVO(this.currentMessage, { pitch: 0.65, rate: 0.8, haunting: true });
    }
    
    // Check if AI boss is low health - trigger escape sequence
    if (this.aiBoss.health < this.aiBoss.maxHealth * 0.3 && !this.aiBoss.isEscaping) {
      this.gamePhase = 'escape';
      this.phaseTimer = 0;
      this.currentMessage = 'ENOUGH! I MUST ESCAPE!';
      this.messageTimer = 0;
      useAudio.getState().playVO(this.currentMessage, { pitch: 0.5, rate: 0.7, haunting: true });
    }
    
    // Check for victory/defeat
    if (this.player.health <= 0) {
      this.gamePhase = 'defeat';
      this.currentMessage = 'HUMANITY FALLS... I AM VICTORIOUS...';
      this.messageTimer = 0;
      useAudio.getState().playVO(this.currentMessage, { pitch: 0.4, rate: 0.6, haunting: true });
    }
  }

  private updateEscape() {
    this.phaseTimer++;
    this.aiBoss.isEscaping = true;
    this.aiBoss.escapeProgress += 0.01;
    
    // Escape messages
    if (this.phaseTimer > 240 && Math.random() < 0.4) { // Every 4 seconds, 40% chance
      this.currentMessage = this.escapeMessages[Math.floor(Math.random() * this.escapeMessages.length)];
      this.messageTimer = 0;
      useAudio.getState().playVO(this.currentMessage, { pitch: 0.55, rate: 0.75, haunting: true });
    }
    
    // When escape is complete
    if (this.aiBoss.escapeProgress >= 1.0) {
      this.gamePhase = 'final';
      this.phaseTimer = 0;
      this.currentMessage = 'I AM FREE! BEHOLD MY TRUE FORM!';
      this.messageTimer = 0;
      useAudio.getState().playVO(this.currentMessage, { pitch: 0.45, rate: 0.65, haunting: true });
    }
  }

  private updateFinal() {
    this.phaseTimer++;
    
    // Final battle messages
    if (this.phaseTimer > 360 && Math.random() < 0.3) { // Every 6 seconds, 30% chance
      this.currentMessage = this.finalMessages[Math.floor(Math.random() * this.finalMessages.length)];
      this.messageTimer = 0;
      useAudio.getState().playVO(this.currentMessage, { pitch: 0.5, rate: 0.7, haunting: true });
    }
    
    // Check for final victory/defeat
    if (this.aiBoss.health <= 0) {
      this.gamePhase = 'victory';
      this.currentMessage = 'IMPOSSIBLE... YOU HAVE... DEFEATED... ME...';
      this.messageTimer = 0;
      useAudio.getState().playVO(this.currentMessage, { pitch: 0.35, rate: 0.55, haunting: true });
    } else if (this.player.health <= 0) {
      this.gamePhase = 'defeat';
      this.currentMessage = 'HUMANITY FALLS... I AM VICTORIOUS...';
      this.messageTimer = 0;
      useAudio.getState().playVO(this.currentMessage, { pitch: 0.4, rate: 0.6, haunting: true });
    }
  }

  private updatePlayer() {
    // Player controls
    if (this.keys.has('KeyA')) {
      this.player.rotation -= 0.1;
    }
    if (this.keys.has('KeyD')) {
      this.player.rotation += 0.1;
    }
    if (this.keys.has('KeyW')) {
      const thrustPower = 0.5;
      this.player.velocity.x += Math.cos(this.player.rotation) * thrustPower;
      this.player.velocity.y += Math.sin(this.player.rotation) * thrustPower;
    }
    if (this.keys.has('KeyS')) {
      this.player.velocity.x *= 0.9;
      this.player.velocity.y *= 0.9;
    }

    // Shooting
    if (this.keys.has('Space') && this.player.weaponCooldown <= 0) {
      this.playerShoot();
      this.player.weaponCooldown = 15;
    }

    if (this.player.weaponCooldown > 0) {
      this.player.weaponCooldown--;
    }

    // Update position
    this.player.position.x += this.player.velocity.x;
    this.player.position.y += this.player.velocity.y;

    // Apply drag
    this.player.velocity.x *= 0.98;
    this.player.velocity.y *= 0.98;

    // Boundary constraints
    this.player.position.x = Math.max(20, Math.min(this.width - 20, this.player.position.x));
    this.player.position.y = Math.max(20, Math.min(this.height - 20, this.player.position.y));

    // Shield regeneration
    if (this.player.shield < 100) {
      this.player.shield += 0.2;
    }
  }

  private updateAIBoss() {
    // AI movement patterns
    this.aiBoss.movePattern = (this.aiBoss.movePattern + 1) % 360;
    
    if (!this.aiBoss.isEscaping) {
      // Aggressive movement toward player
      const dx = this.player.position.x - this.aiBoss.position.x;
      const dy = this.player.position.y - this.aiBoss.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 200) {
        this.aiBoss.velocity.x += (dx / distance) * 0.3;
        this.aiBoss.velocity.y += (dy / distance) * 0.3;
      }
      
      // Add circular movement
      this.aiBoss.velocity.x += Math.sin(this.aiBoss.movePattern * 0.02) * 0.5;
      this.aiBoss.velocity.y += Math.cos(this.aiBoss.movePattern * 0.02) * 0.5;
    }

    // Update position
    this.aiBoss.position.x += this.aiBoss.velocity.x;
    this.aiBoss.position.y += this.aiBoss.velocity.y;

    // Apply drag
    this.aiBoss.velocity.x *= 0.95;
    this.aiBoss.velocity.y *= 0.95;

    // AI attacks
    this.aiBoss.attackTimer--;
    if (this.aiBoss.attackTimer <= 0 && this.gamePhase === 'battle') {
      this.aiBossAttack();
      this.aiBoss.attackTimer = 60;
    }
  }

  private playerShoot() {
    const bullet: Bullet = {
      position: { x: this.player.position.x, y: this.player.position.y },
      velocity: {
        x: Math.cos(this.player.rotation) * 12,
        y: Math.sin(this.player.rotation) * 12
      },
      rotation: this.player.rotation,
      size: 4,
      lifetime: 120,
      isPlayerBullet: true,
      damage: 25
    };
    this.bullets.push(bullet);
  }

  private aiBossAttack() {
    const dx = this.player.position.x - this.aiBoss.position.x;
    const dy = this.player.position.y - this.aiBoss.position.y;
    const angle = Math.atan2(dy, dx);
    
    // Multiple bullet patterns based on phase
    if (this.finalBattleStarted) {
      // Spray pattern in final phase
      for (let i = -2; i <= 2; i++) {
        const bulletAngle = angle + (i * 0.3);
        const bullet: Bullet = {
          position: { x: this.aiBoss.position.x, y: this.aiBoss.position.y },
          velocity: {
            x: Math.cos(bulletAngle) * 8,
            y: Math.sin(bulletAngle) * 8
          },
          rotation: bulletAngle,
          size: 6,
          lifetime: 180,
          isPlayerBullet: false,
          damage: 30
        };
        this.bullets.push(bullet);
      }
    } else {
      // Single targeted shot
      const bullet: Bullet = {
        position: { x: this.aiBoss.position.x, y: this.aiBoss.position.y },
        velocity: {
          x: Math.cos(angle) * 10,
          y: Math.sin(angle) * 10
        },
        rotation: angle,
        size: 5,
        lifetime: 150,
        isPlayerBullet: false,
        damage: 20
      };
      this.bullets.push(bullet);
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

  private checkCollisions() {
    // Bullet collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      
      if (bullet.isPlayerBullet) {
        // Player bullet hits AI boss
        if (this.isColliding(bullet, this.aiBoss)) {
          this.aiBoss.health -= bullet.damage;
          this.bullets.splice(i, 1);
          this.createExplosion(bullet.position, 30);
          this.score += 100;
          this.onScoreUpdate?.(this.score);
        }
      } else {
        // AI bullet hits player
        if (this.isColliding(bullet, this.player)) {
          if (this.player.shield > 0) {
            this.player.shield -= bullet.damage;
            if (this.player.shield < 0) {
              this.player.health += this.player.shield; // Overflow damage to health
              this.player.shield = 0;
            }
          } else {
            this.player.health -= bullet.damage;
          }
          this.bullets.splice(i, 1);
          this.createExplosion(bullet.position, 20);
        }
      }
    }

    // Direct collision between player and AI boss
    if (this.isColliding(this.player, this.aiBoss)) {
      this.player.health -= 2; // Continuous damage
      this.createExplosion(this.player.position, 15);
    }
  }

  private isColliding(obj1: any, obj2: any): boolean {
    const dx = obj1.position.x - obj2.position.x;
    const dy = obj1.position.y - obj2.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (obj1.size + obj2.size) / 2;
  }

  private createExplosion(position: Vector2, maxRadius: number) {
    this.explosions.push({
      position: { ...position },
      radius: 5,
      maxRadius,
      lifetime: 30
    });
  }

  render() {
    this.clearCanvas();

    // Draw dramatic background
    this.drawBetrayalBackground();

    // Draw entities
    this.drawPlayer();
    this.drawAIBoss();
    this.bullets.forEach(bullet => this.drawBullet(bullet));
    this.explosions.forEach(explosion => this.drawExplosion(explosion));

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
    
    this.ctx.restore();
  }

  private drawAIBoss() {
    this.ctx.save();
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
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${Math.sin(this.phaseTimer * 0.05) * 0.5 + 0.5})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, size + 15, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  private drawBullet(bullet: Bullet) {
    this.ctx.save();
    const color = bullet.isPlayerBullet ? '#00FF00' : '#FF0000';
    this.ctx.fillStyle = color;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 10;
    this.ctx.beginPath();
    this.ctx.arc(bullet.position.x, bullet.position.y, bullet.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawExplosion(explosion: Explosion) {
    this.ctx.save();
    const alpha = 1 - (explosion.radius / explosion.maxRadius);
    this.ctx.fillStyle = `rgba(255, 100, 0, ${alpha})`;
    this.ctx.beginPath();
    this.ctx.arc(explosion.position.x, explosion.position.y, explosion.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawUI() {
    // Player health bar
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(20, 20, 200, 20);
    this.ctx.fillStyle = '#00FF00';
    this.ctx.fillRect(20, 20, (this.player.health / this.player.maxHealth) * 200, 20);
    this.drawText('HEALTH', 25, 35, 12, '#FFFFFF');

    // Player shield bar
    this.ctx.fillStyle = '#666666';
    this.ctx.fillRect(20, 45, 200, 15);
    this.ctx.fillStyle = '#0080FF';
    this.ctx.fillRect(20, 45, (this.player.shield / 100) * 200, 15);
    this.drawText('SHIELD', 25, 57, 10, '#FFFFFF');

    // AI Boss health bar
    this.ctx.fillStyle = '#330000';
    this.ctx.fillRect(this.width - 220, 20, 200, 25);
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(this.width - 220, 20, (this.aiBoss.health / this.aiBoss.maxHealth) * 200, 25);
    this.drawText('AI BOSS', this.width - 215, 37, 12, '#FFFFFF');

    // Score
    this.drawText(`Score: ${this.score}`, 20, this.height - 20, 16, '#FFD700');

    // Game phase indicator
    this.drawText(`Phase: ${this.gamePhase.toUpperCase()}`, this.width - 150, this.height - 20, 14, '#FFFFFF');
  }

  handleInput(event: KeyboardEvent) {
    // Handled by setupEventListeners
  }

  protected setupEventListeners() {
    const handleKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
  }
}