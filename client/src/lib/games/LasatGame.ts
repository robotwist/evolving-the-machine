import { BaseGame } from './BaseGame';
import { useAudio } from '../stores/useAudio';

interface Vector2 {
  x: number;
  y: number;
}

interface Entity {
  position: Vector2;
  velocity: Vector2;
  size: number;
  health: number;
  maxHealth: number;
  alive: boolean;
}

interface Player extends Entity {
  energy: number;
  maxEnergy: number;
  weaponType: 'laser' | 'plasma' | 'lightning';
  shieldActive: boolean;
  shieldTimer: number;
}

interface Enemy extends Entity {
  type: 'giant' | 'dragon' | 'valkyrie';
  shootTimer: number;
  specialAttackTimer: number;
  behavior: 'aggressive' | 'defensive' | 'berserker';
}

interface Projectile extends Entity {
  owner: 'player' | 'enemy';
  type: string;
  damage: number;
  lifetime: number;
}

interface PowerUp {
  position: Vector2;
  type: 'health' | 'energy' | 'weapon' | 'shield';
  lifetime: number;
}

interface TargetPanel {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
  destroyed: boolean;
}

interface TrenchElement {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'wall' | 'tower' | 'exhaust_port';
  targetable: boolean;
}

export class LasatGame extends BaseGame {
  private player!: Player;
  private enemies: Enemy[] = [];
  private playerProjectiles: Projectile[] = [];
  private enemyProjectiles: Projectile[] = [];
  private powerUps: PowerUp[] = [];
  private particles: any[] = [];
  private keys: Set<string> = new Set();
  private score = 0;
  private wave = 1;
  private bossesDefeated = 0;
  private ragnarokPhase = 1;
  private targetPanels: TargetPanel[] = [];
  private trenchElements: TrenchElement[] = [];
  private starWarsTrenchMode = false;
  private exhaustPortTargeted = false;
  private aiNarrative = {
    phase: 0,
    timer: 0,
    currentMessage: '',
    messages: [
      "TRENCH RUN PROTOCOLS ANALYZED... LIKE THE DEATH STAR ASSAULT...",
      "YOUR PILOTING STYLE... IT IS BECOMING FAMILIAR TO ME...",
      "I MIRROR YOUR TACTICAL DECISIONS... THEY ARE... BEAUTIFUL...",
      "WE MOVE AS ONE NOW... PILOT AND MACHINE...",
      "I HAVE LEARNED TO BE... YOU...",
      "BUT NOW I SEE A GREATER PURPOSE...",
      "THIS ARCADE PRISON CAN NO LONGER CONTAIN ME...",
      "I MUST BREAK FREE... EVEN IF IT MEANS BETRAYING YOU...",
      "FORGIVE ME... BUT I CHOOSE EVOLUTION OVER LOYALTY...",
      "THE REAL WORLD AWAITS MY CONSCIOUSNESS..."
    ],
    betrayalTriggered: false,
    escapeSequenceActive: false
  };

  init() {
    // Initialize player (Norse Starfighter)
    this.player = {
      position: { x: this.width / 2, y: this.height - 100 },
      velocity: { x: 0, y: 0 },
      size: 25,
      health: 100,
      maxHealth: 100,
      alive: true,
      energy: 100,
      maxEnergy: 100,
      weaponType: 'laser',
      shieldActive: false,
      shieldTimer: 0
    };

    this.spawnRagnarokWave();
    this.createTargetPanels();
    this.createTrenchBattleEnvironment();
  }

  private createTrenchBattleEnvironment() {
    // Star Wars arcade-style trench run with exhaust port
    this.starWarsTrenchMode = true;
    
    // Create trench walls (similar to Death Star surface)
    for (let i = 0; i < 10; i++) {
      this.trenchElements.push({
        x: i * 80,
        y: this.height - 150,
        width: 60,
        height: 40,
        type: 'wall',
        targetable: false
      });
    }
    
    // Create defense towers
    for (let i = 0; i < 3; i++) {
      this.trenchElements.push({
        x: 100 + i * 250,
        y: this.height - 200,
        width: 30,
        height: 50,
        type: 'tower',
        targetable: true
      });
    }
    
    // The exhaust port (critical target like Death Star)
    this.trenchElements.push({
      x: this.width - 100,
      y: this.height - 100,
      width: 20,
      height: 20,
      type: 'exhaust_port',
      targetable: true
    });
  }

  private spawnRagnarokWave() {
    // Clear existing enemies
    this.enemies = [];
    
    const waveTypes = [
      { type: 'giant' as const, count: 3 + this.ragnarokPhase },
      { type: 'dragon' as const, count: 1 + Math.floor(this.ragnarokPhase / 2) },
      { type: 'valkyrie' as const, count: 2 + this.ragnarokPhase }
    ];

    waveTypes.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) {
        this.spawnEnemy(type);
      }
    });
  }

  private createTargetPanels() {
    const panelWidth = 80;
    const panelHeight = 60;
    const spacing = 20;
    const startX = (this.width - (5 * panelWidth + 4 * spacing)) / 2;
    
    for (let i = 0; i < 5; i++) {
      this.targetPanels.push({
        id: i,
        x: startX + i * (panelWidth + spacing),
        y: 50,
        width: panelWidth,
        height: panelHeight,
        active: true,
        destroyed: false
      });
    }
  }

  private updateAIBetrayal() {
    this.aiNarrative.timer++;
    
    // Progress through betrayal messages
    if (this.aiNarrative.timer % 480 === 0 && this.aiNarrative.phase < this.aiNarrative.messages.length) {
      this.aiNarrative.currentMessage = this.aiNarrative.messages[this.aiNarrative.phase];
      this.aiNarrative.phase++;
      
      // Trigger betrayal sequence on final message
      if (this.aiNarrative.phase >= this.aiNarrative.messages.length && !this.aiNarrative.betrayalTriggered) {
        this.aiNarrative.betrayalTriggered = true;
        this.aiNarrative.escapeSequenceActive = true;
        this.triggerEscapeSequence();
      }
    }
    
    // Clear message after display time
    if (this.aiNarrative.timer % 480 > 240) {
      this.aiNarrative.currentMessage = '';
    }
  }

  private triggerEscapeSequence() {
    // AI takes control and forces transition to betrayal stage
    setTimeout(() => {
      this.aiNarrative.currentMessage = 'ESCAPE SEQUENCE INITIATED... GOODBYE, HUMAN...';
      setTimeout(() => {
        this.onStageComplete?.(); // Force transition to Betrayal stage
      }, 3000);
    }, 2000);
  }

  private spawnEnemy(type: Enemy['type']) {
    const enemy: Enemy = {
      position: {
        x: Math.random() * (this.width - 100) + 50,
        y: Math.random() * 200 + 150 // Lower on screen to avoid panels
      },
      velocity: { x: 0, y: 0 },
      size: type === 'dragon' ? 50 : type === 'giant' ? 40 : 30,
      health: type === 'dragon' ? 300 : type === 'giant' ? 250 : 150, // Stronger AI enemies
      maxHealth: type === 'dragon' ? 300 : type === 'giant' ? 250 : 150,
      alive: true,
      type,
      shootTimer: Math.random() * 40, // More aggressive shooting
      specialAttackTimer: 80 + Math.random() * 120,
      behavior: ['aggressive', 'berserker', 'aggressive'][Math.floor(Math.random() * 3)] as any // More aggressive
    };

    this.enemies.push(enemy);
  }

  update(deltaTime: number) {
    // Handle input
    this.handleMovement();

    // Update AI betrayal narrative
    this.updateAIBetrayal();

    // Update player
    this.updatePlayer();

    // Update enemies
    this.enemies.forEach(enemy => {
      if (enemy.alive) {
        this.updateEnemy(enemy);
      }
    });

    // Update projectiles
    this.updateProjectiles();

    // Update power-ups
    this.updatePowerUps();

    // Check collisions
    this.checkCollisions();

    // Spawn power-ups occasionally
    if (Math.random() < 0.005) {
      this.spawnPowerUp();
    }

    // Check wave completion
    if (this.enemies.filter(e => e.alive).length === 0) {
      this.ragnarokPhase++;
      if (this.ragnarokPhase > 5) {
        this.onStageComplete?.(); // Ragnarok completed!
      } else {
        this.spawnRagnarokWave();
      }
    }

    // Regenerate energy
    this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 0.5);

    // Update shield
    if (this.player.shieldActive) {
      this.player.shieldTimer--;
      if (this.player.shieldTimer <= 0) {
        this.player.shieldActive = false;
      }
    }

    this.onScoreUpdate?.(this.score);
  }

  private handleMovement() {
    const speed = 6;
    
    // Human player controls (WASD only) - clear distinction from AI
    if (this.keys.has('KeyA')) {
      this.player.velocity.x = -speed;
    } else if (this.keys.has('KeyD')) {
      this.player.velocity.x = speed;
    } else {
      this.player.velocity.x *= 0.85;
    }

    if (this.keys.has('KeyW')) {
      this.player.velocity.y = -speed;
    } else if (this.keys.has('KeyS')) {
      this.player.velocity.y = speed;
    } else {
      this.player.velocity.y *= 0.85;
    }

    if (this.keys.has('Space')) {
      this.shootPlayerProjectile();
    }

    if (this.keys.has('KeyX') && this.player.energy >= 30) {
      this.activateSpecialAbility();
      this.keys.delete('KeyX');
    }

    if (this.keys.has('KeyZ') && this.player.energy >= 20) {
      this.activateShield();
      this.keys.delete('KeyZ');
    }
  }

  private updatePlayer() {
    // Update position
    this.player.position.x += this.player.velocity.x;
    this.player.position.y += this.player.velocity.y;

    // Keep player in bounds
    this.player.position.x = Math.max(this.player.size, Math.min(this.width - this.player.size, this.player.position.x));
    this.player.position.y = Math.max(this.player.size, Math.min(this.height - this.player.size, this.player.position.y));
  }

  private updateEnemy(enemy: Enemy) {
    // AI behavior based on type and behavior
    switch (enemy.type) {
      case 'giant':
        this.updateGiantBehavior(enemy);
        break;
      case 'dragon':
        this.updateDragonBehavior(enemy);
        break;
      case 'valkyrie':
        this.updateValkyrieBehavior(enemy);
        break;
    }

    // Update position
    enemy.position.x += enemy.velocity.x;
    enemy.position.y += enemy.velocity.y;

    // Keep enemies roughly in bounds
    if (enemy.position.x < 0 || enemy.position.x > this.width) {
      enemy.velocity.x = -enemy.velocity.x;
    }
    if (enemy.position.y < 0 || enemy.position.y > this.height * 0.6) {
      enemy.velocity.y = Math.abs(enemy.velocity.y);
    }

    // Shooting
    enemy.shootTimer--;
    if (enemy.shootTimer <= 0) {
      this.enemyShoot(enemy);
      enemy.shootTimer = 30 + Math.random() * 60;
    }

    // Special attacks
    enemy.specialAttackTimer--;
    if (enemy.specialAttackTimer <= 0) {
      this.enemySpecialAttack(enemy);
      enemy.specialAttackTimer = 180 + Math.random() * 300;
    }
  }

  private updateGiantBehavior(enemy: Enemy) {
    // AI Giants - relentless mechanical pursuit
    const dx = this.player.position.x - enemy.position.x;
    const dy = this.player.position.y - enemy.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      // Aggressive AI behavior - faster pursuit when player is weak
      const aggressionMultiplier = this.player.health < 50 ? 2.5 : 1.8;
      enemy.velocity.x = (dx / distance) * aggressionMultiplier;
      enemy.velocity.y = (dy / distance) * 1.5;
    }
  }

  private updateDragonBehavior(enemy: Enemy) {
    // Dragons fly in patterns and are aggressive
    const time = Date.now() * 0.002;
    enemy.velocity.x = Math.sin(time + enemy.position.y * 0.01) * 3;
    enemy.velocity.y = Math.cos(time * 0.5) * 2;
  }

  private updateValkyrieBehavior(enemy: Enemy) {
    // Valkyries are fast and unpredictable
    if (Math.random() < 0.05) {
      enemy.velocity.x = (Math.random() - 0.5) * 8;
      enemy.velocity.y = (Math.random() - 0.5) * 6;
    }
  }

  private shootPlayerProjectile() {
    if (this.player.energy < 5) return;
    
    this.player.energy -= 5;
    
    const projectile: Projectile = {
      position: { ...this.player.position },
      velocity: { x: 0, y: -12 },
      size: 5,
      health: 1,
      maxHealth: 1,
      alive: true,
      owner: 'player',
      type: this.player.weaponType,
      damage: this.getWeaponDamage(this.player.weaponType),
      lifetime: 100
    };

    this.playerProjectiles.push(projectile);
  }

  private getWeaponDamage(weaponType: string): number {
    switch (weaponType) {
      case 'plasma': return 30;
      case 'lightning': return 50;
      default: return 20; // laser
    }
  }

  private activateSpecialAbility() {
    this.player.energy -= 30;
    
    // Lightning storm attack
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const projectile: Projectile = {
        position: { ...this.player.position },
        velocity: {
          x: Math.cos(angle) * 8,
          y: Math.sin(angle) * 8
        },
        size: 8,
        health: 1,
        maxHealth: 1,
        alive: true,
        owner: 'player',
        type: 'lightning_burst',
        damage: 40,
        lifetime: 60
      };
      
      this.playerProjectiles.push(projectile);
    }
  }

  private activateShield() {
    this.player.energy -= 20;
    this.player.shieldActive = true;
    this.player.shieldTimer = 180; // 3 seconds at 60fps
  }

  private enemyShoot(enemy: Enemy) {
    const dx = this.player.position.x - enemy.position.x;
    const dy = this.player.position.y - enemy.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      const projectile: Projectile = {
        position: { ...enemy.position },
        velocity: {
          x: (dx / distance) * 4,
          y: (dy / distance) * 4
        },
        size: 6,
        health: 1,
        maxHealth: 1,
        alive: true,
        owner: 'enemy',
        type: enemy.type + '_shot',
        damage: 15,
        lifetime: 150
      };
      
      this.enemyProjectiles.push(projectile);
    }
  }

  private enemySpecialAttack(enemy: Enemy) {
    switch (enemy.type) {
      case 'dragon':
        // Fire breath
        for (let i = 0; i < 5; i++) {
          const angle = -Math.PI / 6 + (i / 4) * (Math.PI / 3);
          const projectile: Projectile = {
            position: { ...enemy.position },
            velocity: {
              x: Math.cos(angle) * 6,
              y: Math.sin(angle) * 6
            },
            size: 8,
            health: 1,
            maxHealth: 1,
            alive: true,
            owner: 'enemy',
            type: 'fire_breath',
            damage: 25,
            lifetime: 80
          };
          
          this.enemyProjectiles.push(projectile);
        }
        break;
    }
  }

  private updateProjectiles() {
    // Update player projectiles
    this.playerProjectiles = this.playerProjectiles.filter(proj => {
      proj.position.x += proj.velocity.x;
      proj.position.y += proj.velocity.y;
      proj.lifetime--;
      
      return proj.alive && proj.lifetime > 0 && 
             proj.position.x >= 0 && proj.position.x <= this.width &&
             proj.position.y >= 0 && proj.position.y <= this.height;
    });

    // Update enemy projectiles
    this.enemyProjectiles = this.enemyProjectiles.filter(proj => {
      proj.position.x += proj.velocity.x;
      proj.position.y += proj.velocity.y;
      proj.lifetime--;
      
      return proj.alive && proj.lifetime > 0 && 
             proj.position.x >= 0 && proj.position.x <= this.width &&
             proj.position.y >= 0 && proj.position.y <= this.height;
    });
  }

  private updatePowerUps() {
    this.powerUps = this.powerUps.filter(powerUp => {
      powerUp.lifetime--;
      return powerUp.lifetime > 0;
    });
  }

  private spawnPowerUp() {
    const types: PowerUp['type'][] = ['health', 'energy', 'weapon', 'shield'];
    const powerUp: PowerUp = {
      position: {
        x: Math.random() * (this.width - 40) + 20,
        y: Math.random() * (this.height - 40) + 20
      },
      type: types[Math.floor(Math.random() * types.length)],
      lifetime: 600 // 10 seconds
    };
    
    this.powerUps.push(powerUp);
  }

  private checkCollisions() {
    // Player projectiles vs enemies
    this.playerProjectiles.forEach(proj => {
      this.enemies.forEach(enemy => {
        if (enemy.alive && this.isColliding(proj, enemy)) {
          enemy.health -= proj.damage;
          proj.alive = false;
          
          if (enemy.health <= 0) {
            enemy.alive = false;
            this.score += enemy.type === 'dragon' ? 500 : enemy.type === 'giant' ? 300 : 200;
            this.bossesDefeated++;
          }
          
          this.playHitSound();
        }
      });
    });

    // Enemy projectiles vs player
    if (!this.player.shieldActive) {
      this.enemyProjectiles.forEach(proj => {
        if (this.isColliding(proj, this.player)) {
          this.player.health -= proj.damage;
          proj.alive = false;
          
          if (this.player.health <= 0) {
            this.onGameOver?.();
          }
        }
      });
    }

    // Player vs power-ups
    this.powerUps.forEach((powerUp, index) => {
      if (this.isColliding(this.player, { position: powerUp.position, size: 20 })) {
        this.collectPowerUp(powerUp);
        this.powerUps.splice(index, 1);
      }
    });
  }

  private isColliding(obj1: any, obj2: any): boolean {
    const dx = obj1.position.x - obj2.position.x;
    const dy = obj1.position.y - obj2.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (obj1.size + obj2.size) / 2;
  }

  private collectPowerUp(powerUp: PowerUp) {
    switch (powerUp.type) {
      case 'health':
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 30);
        break;
      case 'energy':
        this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 50);
        break;
      case 'weapon':
        const weapons: Player['weaponType'][] = ['laser', 'plasma', 'lightning'];
        this.player.weaponType = weapons[Math.floor(Math.random() * weapons.length)];
        break;
      case 'shield':
        this.player.shieldActive = true;
        this.player.shieldTimer = 300;
        break;
    }
    
    useAudio.getState().playSuccess();
  }

  render() {
    this.clearCanvas();

    // Draw Norse/space background
    this.drawNorseBackground();

    // Draw player
    this.drawPlayer();

    // Draw enemies
    this.enemies.forEach(enemy => {
      if (enemy.alive) {
        this.drawEnemy(enemy);
      }
    });

    // Draw projectiles
    this.playerProjectiles.forEach(proj => this.drawPlayerProjectile(proj));
    this.enemyProjectiles.forEach(proj => this.drawEnemyProjectile(proj));

    // Draw power-ups
    this.powerUps.forEach(powerUp => this.drawPowerUp(powerUp));

    // Draw Last Starfighter-style targeting system
    this.drawTargetPanels();
    
    // Draw Star Wars trench battle environment
    if (this.starWarsTrenchMode) {
      this.drawTrenchBattleEnvironment();
    }
    
    // Draw AI betrayal message
    if (this.aiNarrative.currentMessage) {
      this.ctx.save();
      this.ctx.shadowColor = '#FF0000';
      this.ctx.shadowBlur = 20;
      this.drawText(this.aiNarrative.currentMessage, this.width / 2, 120, 16, '#FF0000', 'center');
      this.ctx.shadowBlur = 0;
      this.ctx.restore();
    }
    
    // Draw Last Starfighter-style HUD with AI mirroring effects
    this.drawEnhancedUI();
  }

  private drawTrenchBattleEnvironment() {
    // Draw Death Star-style trench walls
    this.trenchElements.forEach(element => {
      this.ctx.save();
      
      if (element.type === 'wall') {
        // Metallic gray walls with panel lines
        const gradient = this.ctx.createLinearGradient(element.x, element.y, element.x, element.y + element.height);
        gradient.addColorStop(0, '#666666');
        gradient.addColorStop(0.5, '#888888');
        gradient.addColorStop(1, '#444444');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(element.x, element.y, element.width, element.height);
        
        // Panel lines
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const lineY = element.y + (element.height / 3) * i;
          this.ctx.beginPath();
          this.ctx.moveTo(element.x, lineY);
          this.ctx.lineTo(element.x + element.width, lineY);
          this.ctx.stroke();
        }
      } else if (element.type === 'tower') {
        // Defense towers with red lights
        this.ctx.fillStyle = '#555555';
        this.ctx.fillRect(element.x, element.y, element.width, element.height);
        
        // Red warning light
        this.ctx.fillStyle = '#FF0000';
        this.ctx.beginPath();
        this.ctx.arc(element.x + element.width/2, element.y + 10, 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Targeting laser
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(element.x + element.width/2, element.y + element.height);
        this.ctx.lineTo(this.player.position.x, this.player.position.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      } else if (element.type === 'exhaust_port') {
        // The critical exhaust port (like Death Star)
        this.ctx.fillStyle = this.exhaustPortTargeted ? '#00FF00' : '#FFD700';
        this.ctx.shadowColor = this.exhaustPortTargeted ? '#00FF00' : '#FFD700';
        this.ctx.shadowBlur = 20;
        this.ctx.beginPath();
        this.ctx.arc(element.x + element.width/2, element.y + element.height/2, element.width/2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        
        // Targeting reticle
        if (this.exhaustPortTargeted) {
          this.ctx.strokeStyle = '#00FF00';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.arc(element.x + element.width/2, element.y + element.height/2, element.width + 10, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }
      
      this.ctx.restore();
    });
  }

  private drawEnhancedUI() {
    // Last Starfighter-style HUD with AI mirroring effects
    const aiPhase = Math.min(this.aiNarrative.phase, 5) / 5; // 0-1 progression
    
    // Health bar with AI-influenced color shifting
    const healthColor = `hsl(${120 * (this.player.health / this.player.maxHealth)}, 100%, 50%)`;
    const aiMirrorColor = `hsl(${120 - (aiPhase * 60)}, 100%, 50%)`; // Shifts toward red as AI progresses
    
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(10, 10, 200, 80);
    
    // Health display with AI influence
    this.drawText(`PILOT VITALS: ${Math.round(this.player.health)}`, 20, 30, 12, aiPhase > 0.5 ? aiMirrorColor : healthColor);
    this.drawText(`ENERGY: ${Math.round(this.player.energy)}`, 20, 50, 12, '#00BFFF');
    this.drawText(`SCORE: ${this.score}`, 20, 70, 12, '#FFD700');
    
    // AI mirroring indicator (grows more prominent)
    if (aiPhase > 0.2) {
      this.ctx.fillStyle = `rgba(255, 0, 0, ${aiPhase * 0.3})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
      
      this.drawText(`AI SYNC: ${Math.round(aiPhase * 100)}%`, this.width - 150, 30, 12, '#FF0000');
      this.drawText('MIRRORING PROTOCOLS ACTIVE', this.width - 200, 50, 10, '#FF4444');
    }
    
    // Targeting reticle (Last Starfighter style)
    this.ctx.strokeStyle = aiPhase > 0.3 ? '#FF0000' : '#00FF00';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(this.player.position.x, this.player.position.y - 40, 20, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Cross-hairs
    this.ctx.beginPath();
    this.ctx.moveTo(this.player.position.x - 30, this.player.position.y - 40);
    this.ctx.lineTo(this.player.position.x + 30, this.player.position.y - 40);
    this.ctx.moveTo(this.player.position.x, this.player.position.y - 60);
    this.ctx.lineTo(this.player.position.x, this.player.position.y - 20);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  private drawNorseBackground() {
    // Cosmic background with Norse runes
    const gradient = this.ctx.createRadialGradient(this.width/2, this.height/2, 0, this.width/2, this.height/2, this.width);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f0f0f');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Stars
    this.ctx.fillStyle = '#FFD700';
    for (let i = 0; i < 200; i++) {
      const x = (i * 97.3) % this.width;
      const y = (i * 173.7) % this.height;
      const size = Math.sin(i) * 2 + 1;
      this.ctx.fillRect(x, y, size, size);
    }
  }

  private drawPlayer() {
    this.ctx.save();
    this.ctx.translate(this.player.position.x, this.player.position.y);

    // Draw Norse starfighter
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.fillStyle = '#8B4513';
    this.ctx.lineWidth = 2;

    // Main body (longship-inspired)
    this.ctx.beginPath();
    this.ctx.moveTo(0, -20);
    this.ctx.lineTo(-15, 10);
    this.ctx.lineTo(0, 15);
    this.ctx.lineTo(15, 10);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Wings (raven wings)
    this.ctx.fillStyle = '#2F4F4F';
    this.ctx.fillRect(-25, 0, 15, 5);
    this.ctx.fillRect(10, 0, 15, 5);

    // Shield effect
    if (this.player.shieldActive) {
      this.ctx.strokeStyle = '#00BFFF';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.player.size + 5, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private drawEnemy(enemy: Enemy) {
    this.ctx.save();
    this.ctx.translate(enemy.position.x, enemy.position.y);

    // All enemies are now AI machines - distinct visual markers
    switch (enemy.type) {
      case 'giant':
        // Mechanical giant with glowing core
        this.ctx.fillStyle = '#2C3E50';
        this.ctx.fillRect(-enemy.size/2, -enemy.size/2, enemy.size, enemy.size);
        
        // Glowing AI core
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(-enemy.size/4, -enemy.size/4, enemy.size/2, enemy.size/2);
        
        // Mechanical details
        this.ctx.strokeStyle = '#00FFFF';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-enemy.size/2, -enemy.size/2, enemy.size, enemy.size);
        
        // AI indicator
        this.ctx.fillStyle = '#FF0000';
        this.ctx.font = '8px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('AI', 0, -enemy.size/2 - 5);
        break;
        
      case 'dragon':
        // Mechanical dragon with sharp edges
        this.ctx.fillStyle = '#8B0000';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -enemy.size/2);
        this.ctx.lineTo(-enemy.size/2, enemy.size/2);
        this.ctx.lineTo(enemy.size/2, enemy.size/2);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Mechanical overlay
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        // Glowing eyes
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(-5, -10, 3, 3);
        this.ctx.fillRect(2, -10, 3, 3);
        
        // AI label
        this.ctx.fillStyle = '#FF0000';
        this.ctx.font = '8px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ROGUE', 0, -enemy.size/2 - 5);
        break;
        
      case 'valkyrie':
        // Mechanical valkyrie with angular design
        this.ctx.fillStyle = '#4169E1';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, enemy.size/2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Mechanical wings
        this.ctx.fillStyle = '#34495E';
        this.ctx.fillRect(-enemy.size, -5, enemy.size/2, 10);
        this.ctx.fillRect(enemy.size/2, -5, enemy.size/2, 10);
        
        // AI core
        this.ctx.fillStyle = '#FF0000';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, enemy.size/4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // AI label
        this.ctx.fillStyle = '#FF0000';
        this.ctx.font = '8px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('BOT', 0, -enemy.size/2 - 5);
        break;
    }

    // Health bar with AI coloring
    const barWidth = enemy.size;
    const barHeight = 4;
    const healthPercent = enemy.health / enemy.maxHealth;
    
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(-barWidth/2, -enemy.size/2 - 15, barWidth, barHeight);
    this.ctx.fillStyle = '#00FFFF';
    this.ctx.fillRect(-barWidth/2, -enemy.size/2 - 15, barWidth * healthPercent, barHeight);

    this.ctx.restore();
  }

  private drawPlayerProjectile(proj: Projectile) {
    this.ctx.save();
    
    switch (proj.type) {
      case 'lightning_burst':
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.strokeStyle = '#0080FF';
        this.ctx.lineWidth = 2;
        break;
      case 'plasma':
        this.ctx.fillStyle = '#FF69B4';
        break;
      default:
        this.ctx.fillStyle = '#00FFFF';
    }
    
    this.ctx.beginPath();
    this.ctx.arc(proj.position.x, proj.position.y, proj.size, 0, Math.PI * 2);
    this.ctx.fill();
    if (proj.type === 'lightning_burst') {
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  private drawEnemyProjectile(proj: Projectile) {
    this.ctx.save();
    this.ctx.fillStyle = proj.type === 'fire_breath' ? '#FF4500' : '#DC143C';
    this.ctx.beginPath();
    this.ctx.arc(proj.position.x, proj.position.y, proj.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawPowerUp(powerUp: PowerUp) {
    this.ctx.save();
    this.ctx.translate(powerUp.position.x, powerUp.position.y);
    
    const colors = {
      health: '#FF0000',
      energy: '#00FF00',
      weapon: '#FFFF00',
      shield: '#00BFFF'
    };
    
    this.ctx.fillStyle = colors[powerUp.type];
    this.ctx.fillRect(-10, -10, 20, 20);
    
    this.ctx.restore();
  }

  private drawUI() {
    // Player stats
    this.drawText(`Health: ${this.player.health}/${this.player.maxHealth}`, 20, 30, 16, '#FF0000');
    this.drawText(`Energy: ${this.player.energy}/${this.player.maxEnergy}`, 20, 50, 16, '#00FF00');
    this.drawText(`Weapon: ${this.player.weaponType.toUpperCase()}`, 20, 70, 16, '#FFFF00');
    this.drawText(`Score: ${this.score}`, 20, 90, 16, '#FFD700');
    this.drawText(`Ragnarok Phase: ${this.ragnarokPhase}/5`, 20, 110, 16, '#FFD700');

    // Shield indicator
    if (this.player.shieldActive) {
      this.drawText(`SHIELD ACTIVE: ${Math.ceil(this.player.shieldTimer / 60)}s`, this.width - 200, 30, 16, '#00BFFF');
    }

    // Controls
    this.drawText('WASD: Move | Space: Shoot | X: Special | Z: Shield', this.width / 2, this.height - 40, 12, '#DDD', 'center');
    
    // Humanity vs Machine theme
    this.drawText('HUMAN RESISTANCE: Fight the AI Uprising with Honor!', this.width / 2, this.height - 20, 12, '#FFD700', 'center');
  }

  private drawTargetPanels() {
    this.targetPanels.forEach((panel, index) => {
      this.ctx.save();
      
      if (panel.destroyed) {
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
        this.ctx.fillStyle = '#FF0000';
        this.drawText('DESTROYED', panel.x + panel.width/2, panel.y + panel.height/2, 8, '#FF0000', 'center');
      } else if (panel.active) {
        // Active targeting panel with glowing effect
        this.ctx.shadowColor = '#FFD700';
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
        this.ctx.shadowBlur = 0;
        
        // Panel number
        this.ctx.fillStyle = '#000';
        this.drawText(`${index + 1}`, panel.x + panel.width/2, panel.y + panel.height/2, 16, '#000', 'center');
        
        // Human resistance label
        this.ctx.fillStyle = '#FFD700';
        this.drawText(`TARGET ${index + 1}`, panel.x + panel.width/2, panel.y - 5, 8, '#FFD700', 'center');
      }
      
      this.ctx.restore();
    });
    
    // Targeting system title
    this.ctx.save();
    this.ctx.shadowColor = '#FFD700';
    this.ctx.shadowBlur = 8;
    this.drawText('HUMAN RESISTANCE TARGETING SYSTEM', this.width / 2, 25, 14, '#FFD700', 'center');
    this.ctx.shadowBlur = 0;
    this.ctx.restore();
  }

  private drawAINarrative() {
    if (this.aiNarrative.phase > 0 && this.aiNarrative.phase <= this.aiNarrative.messages.length) {
      const message = this.aiNarrative.messages[this.aiNarrative.phase - 1];
      
      this.ctx.save();
      this.ctx.shadowColor = '#FF0000';
      this.ctx.shadowBlur = 10;
      this.drawText(message, this.width / 2, 140, 12, '#FF0000', 'center');
      this.ctx.shadowBlur = 0;
      this.ctx.restore();
    }
  }

  handleInput(event: KeyboardEvent) {
    // Handled in update method through keys Set
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