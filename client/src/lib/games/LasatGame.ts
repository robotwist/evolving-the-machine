import { BaseGame } from './BaseGame';
import { AudioState, WindowExtensions } from '@shared/types';

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
  weaponType: 'laser' | 'ion_cannon';
  shieldActive: boolean;
  shieldTimer: number;
  // Last Starfighter specific
  cockpitView: boolean;
  targetingLock: boolean;
  targetLocked: Enemy | null;
  deathBlossomReady: boolean;
  deathBlossomCooldown: number;
  weaponEnergy: {
    laser: number;
    ion: number;
  };
}

interface Enemy extends Entity {
  type: 'fighter' | 'destroyer' | 'mothership' | 'sinistar_boss';
  shootTimer: number;
  specialAttackTimer: number;
  behavior: 'aggressive' | 'defensive' | 'berserker' | 'boss_phase1' | 'boss_phase2' | 'boss_phase3';
  rage: number;
  enraged: boolean;
  enrageTimer: number;
  // Last Starfighter specific
  squadron: number;
  formationPosition: number;
  targetable: boolean;
  lockOnTimer: number;
  // Boss-specific properties
  phase?: number;
  invulnerableTimer?: number;
  spawnTimer?: number;
  deathBlossomCooldown?: number;
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
  shootCooldown?: number;
}

export class LasatGame extends BaseGame {
  private player!: Player;
  private enemies: Enemy[] = [];
  private playerProjectiles: Projectile[] = [];
  private enemyProjectiles: Projectile[] = [];
  private powerUps: PowerUp[] = [];
  private keys: Set<string> = new Set();
  private score = 0;
  private wave = 1;
  private bossesDefeated = 0;
  private ragnarokPhase = 1;
  private targetPanels: TargetPanel[] = [];
  private trenchElements: TrenchElement[] = [];
  private starWarsTrenchMode = false;
  private exhaustPortTargeted = false;
  private gracePeriod = 180; // 3 seconds of invulnerability
  private waveCompleteTimer = 0; // Timer for wave completion delay
  private bossActive = false; // Whether Sinistar boss is active
  private bossPhase = 1; // Current boss phase (1-3)
  private enemyCommandTimer = 0; // Timer for enemy command announcements
  private lives = 5; // Number of lives remaining
  private gameState: 'start' | 'playing' | 'gameOver' | 'select' = 'start'; // Game state
  private konamiCode: string[] = []; // Konami code input sequence
  private konamiCodeSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']; // ↑↑↓↓←→←→BA
  private konamiCodeActivated = false; // Whether Konami code has been activated
  private enemiesDefeated = 0; // Total enemies defeated
  private bossDefeated = false; // Whether boss has been defeated
  private enemyCommands = [
    "KO-DAN ARMADA: DEPLOY FIGHTER SQUADRONS!",
    "DESTROY THE GUNSTAR FIGHTER!",
    "SEND IN THE DESTROYERS!",
    "MOTHERSHIP APPROACHING!",
    "ALL UNITS ATTACK!",
    "THE SINISTAR AWAKENS...",
    "RUN COWARD! RUN!",
    "I HUNGER! I HUNGER!"
  ];
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
    // Initialize game state
    this.gameState = 'start';
    this.lives = 5;
    this.score = 0;
    this.ragnarokPhase = 1;
    this.bossActive = false;
    this.bossPhase = 1;
    this.enemiesDefeated = 0;
    this.bossDefeated = false;
    this.konamiCode = [];
    this.konamiCodeActivated = false;
    
    // Initialize player (Gunstar Fighter) - increased health for better survivability
    this.player = {
      position: { x: this.width / 2, y: this.height - 100 },
      velocity: { x: 0, y: 0 },
      size: 25,
      health: 200, // Increased from 100
      maxHealth: 200,
      alive: true,
      energy: 100,
      maxEnergy: 100,
      weaponType: 'laser',
      shieldActive: false,
      shieldTimer: 0,
      cockpitView: true,
      targetingLock: false,
      targetLocked: null,
      deathBlossomReady: true,
      deathBlossomCooldown: 0,
      weaponEnergy: {
        laser: 100,
        ion: 100
      }
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
        targetable: true,
        shootCooldown: 60 + Math.random() * 60
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
    
    // Increased difficulty - 2X harder than before
    const squadronCount = Math.min(2 + Math.floor(this.ragnarokPhase / 2), 4); // Max 4 squadrons
    
    for (let squadron = 0; squadron < squadronCount; squadron++) {
      // Each squadron has different composition - increased enemy count
      const squadronTypes = [
        { type: 'fighter' as const, count: Math.min(4 + this.ragnarokPhase * 2, 8) }, // Max 8 fighters per squadron
        { type: 'destroyer' as const, count: this.ragnarokPhase >= 1 ? 1 + Math.floor(this.ragnarokPhase / 2) : 0 }, // Destroyers from wave 1+
        { type: 'mothership' as const, count: this.ragnarokPhase >= 3 ? 1 : 0 } // Motherships from wave 3+
      ];

      squadronTypes.forEach(({ type, count }) => {
        for (let i = 0; i < count; i++) {
          this.spawnEnemy(type, squadron);
        }
      });
    }
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

  private spawnEnemy(type: Enemy['type'], squadron: number) {
    const enemy: Enemy = {
      position: {
        x: Math.random() * (this.width - 100) + 50,
        y: Math.random() * 200 + 150 // Lower on screen to avoid panels
      },
      velocity: { x: 0, y: 0 },
      size: type === 'mothership' ? 80 : type === 'destroyer' ? 60 : 30,
      health: type === 'mothership' ? 500 : type === 'destroyer' ? 300 : 100,
      maxHealth: type === 'mothership' ? 500 : type === 'destroyer' ? 300 : 100,
      alive: true,
      type,
      shootTimer: Math.random() * 40,
      specialAttackTimer: 80 + Math.random() * 120,
      behavior: ['aggressive', 'berserker', 'aggressive'][Math.floor(Math.random() * 3)] as 'aggressive' | 'defensive' | 'berserker',
      rage: 0,
      enraged: false,
      enrageTimer: 0,
      squadron: squadron,
      formationPosition: Math.random() * 360, // Formation angle
      targetable: true,
      lockOnTimer: 0
    };

    this.enemies.push(enemy);
  }

  private spawnSinistarBoss() {
    this.bossActive = true;
    this.bossPhase = 1;
    
    const boss: Enemy = {
      position: { x: this.width / 2, y: 100 },
      velocity: { x: 0, y: 0 },
      size: 120, // Massive boss ship
      health: 1000,
      maxHealth: 1000,
      alive: true,
      type: 'sinistar_boss',
      shootTimer: 0,
      specialAttackTimer: 0,
      behavior: 'boss_phase1',
      rage: 0,
      enraged: false,
      enrageTimer: 0,
      squadron: 0,
      formationPosition: 0,
      targetable: true,
      lockOnTimer: 0,
      phase: 1,
      invulnerableTimer: 0,
      spawnTimer: 0,
      deathBlossomCooldown: 0
    };
    
    this.enemies.push(boss);
    
    // Play boss spawn sound
    this.playStinger('boss_spawn');
  }

  update(_deltaTime: number) {
    // Handle different game states
    if (this.gameState === 'start' || this.gameState === 'select') {
      this.handleStartScreenInput();
      return;
    }
    
    if (this.gameState === 'gameOver') {
      this.handleGameOverInput();
      return;
    }
    
    // Playing state - normal game logic
    this.updateGameplay(_deltaTime);
  }

  private updateGameplay(_deltaTime: number) {
    // Handle input
    this.handleMovement();

    // Update grace period
    if (this.gracePeriod > 0) {
      this.gracePeriod--;
    }

    // Update AI betrayal narrative
    this.updateAIBetrayal();

    // Update enemy command announcements
    this.updateEnemyCommands();

    // Update player
    this.updatePlayer();

    // Update enemies
    this.enemies.forEach(enemy => {
      if (enemy.alive) {
        if (enemy.type === 'sinistar_boss') {
          this.updateBossBehavior(enemy);
        } else {
          this.updateEnemy(enemy);
        }
      }
    });

    // Update projectiles
    this.updateProjectiles();

    // Update power-ups
    this.updatePowerUps();

    // Update trench elements
    if (this.starWarsTrenchMode) {
        this.updateTrenchElements();
    }

    // Check collisions
    this.checkCollisions();

    // Spawn power-ups occasionally
    if (Math.random() < 0.005) {
      this.spawnPowerUp();
    }

    // Check wave completion with proper delay
    if (this.enemies.filter(e => e.alive).length === 0) {
      if (this.waveCompleteTimer === 0) {
        // Start wave completion sequence
        this.waveCompleteTimer = 180; // 3 seconds delay
      } else {
        this.waveCompleteTimer--;
        if (this.waveCompleteTimer <= 0) {
          // Wave completed! Advance to next phase
          this.ragnarokPhase++;
          this.waveCompleteTimer = 0; // Reset timer
          
          if (this.ragnarokPhase >= 5 && !this.bossActive) {
            // Spawn Sinistar boss at wave 5
            this.spawnSinistarBoss();
          } else if (this.ragnarokPhase > 5) {
            this.onStageComplete?.(); // Ragnarok completed!
          } else {
            this.spawnRagnarokWave();
          }
        }
      }
    } else {
      // Reset timer if enemies are still alive
      this.waveCompleteTimer = 0;
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

  private handleStartScreenInput() {
    // Handle Konami code input
    this.keys.forEach(key => {
      if (this.konamiCodeSequence[this.konamiCode.length] === key) {
        this.konamiCode.push(key);
        if (this.konamiCode.length === this.konamiCodeSequence.length) {
          this.konamiCodeActivated = true;
          this.konamiCode = []; // Reset for next time
        }
      } else {
        this.konamiCode = []; // Reset if wrong input
      }
    });
    
    // Start game with Enter or Space
    if (this.keys.has('Enter') || this.keys.has('Space')) {
      this.gameState = 'playing';
      this.keys.clear();
    }
  }

  private handleGameOverInput() {
    // Restart game with Enter or Space
    if (this.keys.has('Enter') || this.keys.has('Space')) {
      this.init();
      this.keys.clear();
    }
  }

  private updateEnemyCommands() {
    this.enemyCommandTimer--;
    if (this.enemyCommandTimer <= 0) {
      // Show random enemy command
      const command = this.enemyCommands[Math.floor(Math.random() * this.enemyCommands.length)];
      this.showEnemyCommand(command);
      this.enemyCommandTimer = 300 + Math.random() * 300; // 5-10 seconds between commands
    }
  }

  private showEnemyCommand(_command: string) {
    // Visual feedback for enemy commands
    this.playStinger('enemy_command');
  }

  private updateBossBehavior(boss: Enemy) {
    // Sinistar boss has 3 phases with different behaviors
    const healthPercent = boss.health / boss.maxHealth;
    
    if (healthPercent > 0.66) {
      // Phase 1: Slow approach, spawn fighters
      boss.behavior = 'boss_phase1';
      boss.phase = 1;
      this.updateBossPhase1(boss);
    } else if (healthPercent > 0.33) {
      // Phase 2: Aggressive attack, spawn destroyers
      boss.behavior = 'boss_phase2';
      boss.phase = 2;
      this.updateBossPhase2(boss);
    } else {
      // Phase 3: Berserker mode, Death Blossom attacks
      boss.behavior = 'boss_phase3';
      boss.phase = 3;
      this.updateBossPhase3(boss);
    }
  }

  private updateBossPhase1(boss: Enemy) {
    // Slow movement toward player
    const dx = this.player.position.x - boss.position.x;
    const dy = this.player.position.y - boss.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 200) {
      boss.velocity.x = (dx / distance) * 1; // Slow approach
      boss.velocity.y = (dy / distance) * 1;
    } else {
      boss.velocity.x = 0;
      boss.velocity.y = 0;
    }
    
    // Spawn fighters periodically
    boss.spawnTimer = (boss.spawnTimer ?? 0) - 1;
    if (boss.spawnTimer <= 0) {
      this.spawnEnemy('fighter', 0);
      boss.spawnTimer = 180; // Every 3 seconds
    }
    
    // Slow shooting
    boss.shootTimer--;
    if (boss.shootTimer <= 0) {
      this.enemyShoot(boss);
      boss.shootTimer = 120; // Every 2 seconds
    }
  }

  private updateBossPhase2(boss: Enemy) {
    // More aggressive movement
    const dx = this.player.position.x - boss.position.x;
    const dy = this.player.position.y - boss.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    boss.velocity.x = (dx / distance) * 2; // Faster approach
    boss.velocity.y = (dy / distance) * 2;
    
    // Spawn destroyers
    boss.spawnTimer = (boss.spawnTimer ?? 0) - 1;
    if (boss.spawnTimer <= 0) {
      this.spawnEnemy('destroyer', 0);
      boss.spawnTimer = 300; // Every 5 seconds
    }
    
    // Faster shooting
    boss.shootTimer--;
    if (boss.shootTimer <= 0) {
      this.enemyShoot(boss);
      boss.shootTimer = 60; // Every 1 second
    }
  }

  private updateBossPhase3(boss: Enemy) {
    // Berserker movement - erratic and fast
    const dx = this.player.position.x - boss.position.x;
    const dy = this.player.position.y - boss.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    boss.velocity.x = (dx / distance) * 3 + (Math.random() - 0.5) * 2; // Erratic movement
    boss.velocity.y = (dy / distance) * 3 + (Math.random() - 0.5) * 2;
    
    // Spawn motherships
    boss.spawnTimer = (boss.spawnTimer ?? 0) - 1;
    if (boss.spawnTimer <= 0) {
      this.spawnEnemy('mothership', 0);
      boss.spawnTimer = 600; // Every 10 seconds
    }
    
    // Rapid shooting
    boss.shootTimer--;
    if (boss.shootTimer <= 0) {
      this.enemyShoot(boss);
      boss.shootTimer = 30; // Every 0.5 seconds
    }
    
    // Death Blossom attacks
    boss.deathBlossomCooldown = (boss.deathBlossomCooldown ?? 0) - 1;
    if (boss.deathBlossomCooldown <= 0) {
      this.bossDeathBlossom(boss);
      boss.deathBlossomCooldown = 600; // Every 10 seconds
    }
  }

  private bossDeathBlossom(boss: Enemy) {
    // Boss fires projectiles in all directions
    for (let angle = 0; angle < 360; angle += 15) {
      const radians = (angle * Math.PI) / 180;
      const projectile: Projectile = {
        position: { x: boss.position.x, y: boss.position.y },
        velocity: { 
          x: Math.cos(radians) * 4, 
          y: Math.sin(radians) * 4 
        },
        size: 8,
        health: 1,
        maxHealth: 1,
        alive: true,
        owner: 'enemy',
        type: 'boss_death_blossom',
        damage: 30,
        lifetime: 300
      };
      this.enemyProjectiles.push(projectile);
    }
    
    this.playStinger('boss_death_blossom');
  }

  private handleMovement() {
    const speed = 6;
    
    // Gunstar Fighter controls (WASD + targeting)
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

    // Weapon systems
    if (this.keys.has('Space')) {
      this.shootPlayerProjectile();
    }

    // Ion Cannon (heavier hitting)
    if (this.keys.has('KeyX') && this.player.weaponEnergy.ion >= 20) {
      this.shootIonCannon();
      this.keys.delete('KeyX');
    }

    // Death Blossom (last resort)
    if (this.keys.has('KeyZ') && this.player.deathBlossomReady && this.player.deathBlossomCooldown <= 0) {
      this.activateDeathBlossom();
      this.keys.delete('KeyZ');
    }

    // Targeting system
    this.updateTargeting();
  }

  private updatePlayer() {
    // Update position
    this.player.position.x += this.player.velocity.x;
    this.player.position.y += this.player.velocity.y;

    // Keep player in bounds
    this.player.position.x = Math.max(this.player.size, Math.min(this.width - this.player.size, this.player.position.x));
    this.player.position.y = Math.max(this.player.size, Math.min(this.height - this.player.size, this.player.position.y));
    
    // Update Death Blossom cooldown
    if (this.player.deathBlossomCooldown > 0) {
      this.player.deathBlossomCooldown--;
    }
    
    // Regenerate weapon energy
    this.player.weaponEnergy.laser = Math.min(100, this.player.weaponEnergy.laser + 0.5);
    this.player.weaponEnergy.ion = Math.min(100, this.player.weaponEnergy.ion + 0.2);
  }

  private updateTargeting() {
    // Find nearest enemy for targeting
    let nearestEnemy: Enemy | null = null;
    let nearestDistance = Infinity;
    
    this.enemies.forEach(enemy => {
      if (!enemy.alive || !enemy.targetable) return;
      
      const dx = enemy.position.x - this.player.position.x;
      const dy = enemy.position.y - this.player.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < nearestDistance && distance < 200) { // Targeting range
        nearestDistance = distance;
        nearestEnemy = enemy;
      }
    });
    
    // Update targeting lock
    if (nearestEnemy) {
      this.player.targetLocked = nearestEnemy;
      this.player.targetingLock = true;
      (nearestEnemy as Enemy).lockOnTimer = 60; // 1 second lock
    } else {
      this.player.targetLocked = null;
      this.player.targetingLock = false;
    }
  }

  private shootIonCannon() {
    if (this.player.weaponEnergy.ion < 20) return;
    
    this.player.weaponEnergy.ion -= 20;
    
    const projectile: Projectile = {
      position: { ...this.player.position },
      velocity: { x: 0, y: -15 },
      size: 8,
      health: 1,
      maxHealth: 1,
      alive: true,
      owner: 'player',
      type: 'ion_cannon',
      damage: 50,
      lifetime: 120
    };

    this.playerProjectiles.push(projectile);
  }

  private activateDeathBlossom() {
    if (!this.player.deathBlossomReady || this.player.deathBlossomCooldown > 0) return;
    
    this.player.deathBlossomReady = false;
    this.player.deathBlossomCooldown = 1800; // 30 second cooldown
    
    // Create energy burst that destroys all nearby enemies
    const burstRadius = 150;
    
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;
      
      const dx = enemy.position.x - this.player.position.x;
      const dy = enemy.position.y - this.player.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < burstRadius) {
        enemy.health = 0;
        enemy.alive = false;
        this.score += enemy.type === 'sinistar_boss' ? 10000 : enemy.type === 'mothership' ? 1000 : enemy.type === 'destroyer' ? 500 : 200;
      }
    });
    
    // Visual effect
    this.playStinger('boss_enrage');
  }

  private updateTrenchElements() {
    // Increased difficulty - activate turrets from wave 2+
    if (this.ragnarokPhase >= 2) {
      this.trenchElements.forEach(element => {
          if (element.type === 'tower') {
              element.shootCooldown = (element.shootCooldown ?? 0) - 1;
              if (element.shootCooldown <= 0) {
                  const dx = this.player.position.x - element.x;
                  const dy = this.player.position.y - element.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);

                  if (distance > 0 && distance < 400) { // Only shoot if player is in range
                      const bullet: Projectile = {
                          position: { x: element.x + element.width / 2, y: element.y },
                          velocity: { x: (dx / distance) * 5, y: (dy / distance) * 5 },
                          size: 4,
                          health: 1,
                          maxHealth: 1,
                          alive: true,
                          owner: 'enemy',
                          type: 'turret_shot',
                          damage: 10, // Increased damage for difficulty
                          lifetime: 120
                      };
                      this.enemyProjectiles.push(bullet);
                      element.shootCooldown = 90 + Math.random() * 60; // Faster shooting
                  }
              }
          }
      });
    }
  }

  private updateEnemy(enemy: Enemy) {
    // Ko-Dan Armada behavior based on type
    switch (enemy.type) {
      case 'fighter':
        this.updateFighterBehavior(enemy);
        break;
      case 'destroyer':
        this.updateDestroyerBehavior(enemy);
        break;
      case 'mothership':
        this.updateMothershipBehavior(enemy);
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

    if (enemy.enraged) {
        enemy.enrageTimer--;
        if (enemy.enrageTimer <= 0) {
            enemy.enraged = false;
        }
    }

    // Shooting - increased difficulty, faster shooting
    enemy.shootTimer--;
    if (enemy.shootTimer <= 0) {
      this.enemyShoot(enemy);
      enemy.shootTimer = 45 + Math.random() * (enemy.enraged ? 15 : 45); // 0.75-1.5 seconds
    }

    // Special attacks
    enemy.specialAttackTimer--;
    if (enemy.specialAttackTimer <= 0) {
      this.enemySpecialAttack(enemy);
      enemy.specialAttackTimer = 180 + Math.random() * (enemy.enraged ? 100 : 300);
    }
  }

  private updateFighterBehavior(enemy: Enemy) {
    // Ko-Dan Fighters - fast, agile, swarm tactics
    const dx = this.player.position.x - enemy.position.x;
    const dy = this.player.position.y - enemy.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      // Swarm behavior - move in formation
      const formationAngle = enemy.formationPosition * Math.PI / 180;
      const swarmOffset = Math.sin(Date.now() * 0.003 + enemy.squadron) * 30;
      
      enemy.velocity.x = Math.cos(formationAngle) * 2 + (dx / distance) * 1.5;
      enemy.velocity.y = Math.sin(formationAngle) * 2 + (dy / distance) * 1.5 + swarmOffset * 0.1;
    }
  }

  private updateDestroyerBehavior(enemy: Enemy) {
    // Ko-Dan Destroyers - heavy, slow, powerful
    const dx = this.player.position.x - enemy.position.x;
    const dy = this.player.position.y - enemy.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      // Heavy pursuit - slower but relentless
      enemy.velocity.x = (dx / distance) * 1.2;
      enemy.velocity.y = (dy / distance) * 1.2;
    }
  }

  private updateMothershipBehavior(enemy: Enemy) {
    // Ko-Dan Mothership - massive, slow, spawns fighters
    const dx = this.player.position.x - enemy.position.x;
    const dy = this.player.position.y - enemy.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      // Slow but steady approach
      enemy.velocity.x = (dx / distance) * 0.8;
      enemy.velocity.y = (dy / distance) * 0.8;
    }
    
    // Spawn fighters occasionally
    if (Math.random() < 0.01) {
      this.spawnEnemy('fighter', enemy.squadron);
    }
  }

  private shootPlayerProjectile() {
    if (this.player.weaponEnergy.laser < 5) return;
    
    this.player.weaponEnergy.laser -= 5;
    
    const projectile: Projectile = {
      position: { ...this.player.position },
      velocity: { x: 0, y: -12 },
      size: 5,
      health: 1,
      maxHealth: 1,
      alive: true,
      owner: 'player',
      type: 'laser',
      damage: 20,
      lifetime: 100
    };

    this.playerProjectiles.push(projectile);
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
        damage: enemy.type === 'sinistar_boss' ? 50 : enemy.type === 'mothership' ? 24 : enemy.type === 'destroyer' ? 16 : 10,
        lifetime: 150
      };
      
      this.enemyProjectiles.push(projectile);
    }
  }

  private enemySpecialAttack(enemy: Enemy) {
    switch (enemy.type) {
      case 'destroyer':
        // Heavy ion blast
        for (let i = 0; i < 3; i++) {
          const angle = -Math.PI / 6 + (i / 2) * (Math.PI / 3);
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
            type: 'destroyer_blast',
            damage: 30,
            lifetime: 80
          };
          
          this.enemyProjectiles.push(projectile);
        }
        break;
      case 'mothership':
        // Spawn fighter wave
        for (let i = 0; i < 3; i++) {
          this.spawnEnemy('fighter', enemy.squadron);
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
          enemy.rage += proj.damage;
          if (enemy.rage >= 100 && !enemy.enraged) {
              enemy.enraged = true;
              enemy.enrageTimer = 300; // 5 seconds
              enemy.rage = 0;
              this.playStinger('boss_enrage');
          }
          proj.alive = false;
          
          if (enemy.health <= 0) {
            enemy.alive = false;
            this.enemiesDefeated++;
            this.score += enemy.type === 'sinistar_boss' ? 10000 : enemy.type === 'mothership' ? 1000 : enemy.type === 'destroyer' ? 500 : 200;
            if (enemy.type === 'sinistar_boss') {
              this.bossDefeated = true;
            }
            this.bossesDefeated++;
          }
          
          this.playHitSound();
        }
      });
    });

    // Enemy projectiles vs player
    if (!this.player.shieldActive && this.gracePeriod <= 0) {
      this.enemyProjectiles.forEach(proj => {
        if (this.isColliding(proj, this.player)) {
          this.player.health -= proj.damage;
          proj.alive = false;
          
          if (this.player.health <= 0) {
            this.lives--;
            if (this.lives <= 0) {
              this.gameState = 'gameOver';
              this.onGameOver?.();
            } else {
              // Respawn player with full health
              this.player.health = this.player.maxHealth;
              this.player.position = { x: this.width / 2, y: this.height - 100 };
              this.player.velocity = { x: 0, y: 0 };
              this.gracePeriod = 180; // 3 seconds invulnerability
            }
          }
        }
      });
    }

    // Player vs power-ups
    this.powerUps.forEach((powerUp, index) => {
      const dx = this.player.position.x - powerUp.position.x;
      const dy = this.player.position.y - powerUp.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 30) { // 20 (powerup size) + 25 (player size) / 2
        this.collectPowerUp(powerUp);
        this.powerUps.splice(index, 1);
      }
    });
  }

  private isColliding(obj1: Entity, obj2: Entity): boolean {
    const dx = obj1.position.x - obj2.position.x;
    const dy = obj1.position.y - obj2.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (obj1.size + obj2.size) / 2;
  }

  private playStinger(stinger: string) {
    try {
        const audioState = (window as unknown as { __CULTURAL_ARCADE_AUDIO__?: AudioState }).__CULTURAL_ARCADE_AUDIO__;
        if (audioState && !audioState.isMuted) {
            audioState.playStinger(stinger);
        }
    } catch (e) {
        console.warn('Stinger sound failed:', e);
    }
  }

  private collectPowerUp(powerUp: PowerUp) {
    switch (powerUp.type) {
      case 'health':
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 30);
        break;
      case 'energy':
        this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 50);
        break;
      case 'weapon': {
        const weapons: Player['weaponType'][] = ['laser', 'ion_cannon'];
        this.player.weaponType = weapons[Math.floor(Math.random() * weapons.length)];
        break;
      }
      case 'shield':
        this.player.shieldActive = true;
        this.player.shieldTimer = 300;
        break;
    }
    
    const audioState = (window as unknown as WindowExtensions).__CULTURAL_ARCADE_AUDIO__;
    if (audioState && !audioState.isMuted) {
      audioState.playSuccess();
    }
  }

  render() {
    this.clearCanvas();

    // Handle different game states
    if (this.gameState === 'start') {
      this.drawStartScreen();
      return;
    }
    
    if (this.gameState === 'select') {
      this.drawSelectScreen();
      return;
    }
    
    if (this.gameState === 'gameOver') {
      this.drawGameOverScreen();
      return;
    }

    // Playing state - normal game rendering
    this.drawGameplay();
  }

  private drawStartScreen() {
    // Draw background
    this.drawNorseBackground();
    
    // Title
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = '48px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('THE LAST STARFIGHTER', this.width / 2, this.height / 2 - 100);
    
    // Subtitle
    this.ctx.fillStyle = '#00FF00';
    this.ctx.font = '24px monospace';
    this.ctx.fillText('GUNSTAR FIGHTER', this.width / 2, this.height / 2 - 50);
    
    // Instructions
    this.ctx.fillStyle = '#DDD';
    this.ctx.font = '18px monospace';
    this.ctx.fillText('PRESS ENTER OR SPACE TO START', this.width / 2, this.height / 2 + 50);
    
    // Konami code hint
    this.ctx.fillStyle = '#666';
    this.ctx.font = '14px monospace';
    this.ctx.fillText('Try the Konami Code: ↑↑↓↓←→←→BA', this.width / 2, this.height / 2 + 100);
    
    // Konami code progress
    if (this.konamiCode.length > 0) {
      this.ctx.fillStyle = '#00FF00';
      this.ctx.font = '16px monospace';
      this.ctx.fillText(`Code Progress: ${this.konamiCode.length}/${this.konamiCodeSequence.length}`, this.width / 2, this.height / 2 + 130);
    }
    
    // Konami code success
    if (this.konamiCodeActivated) {
      this.ctx.fillStyle = '#FFD700';
      this.ctx.font = '20px monospace';
      this.ctx.fillText('KONAMI CODE ACTIVATED!', this.width / 2, this.height / 2 + 160);
      this.ctx.fillText('↑↑↓↓←→←→BA', this.width / 2, this.height / 2 + 190);
    }
  }

  private drawSelectScreen() {
    // Draw background
    this.drawNorseBackground();
    
    // Title
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = '36px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('SELECT DIFFICULTY', this.width / 2, this.height / 2 - 100);
    
    // Options
    this.ctx.fillStyle = '#DDD';
    this.ctx.font = '20px monospace';
    this.ctx.fillText('1 - EASY', this.width / 2, this.height / 2 - 20);
    this.ctx.fillText('2 - NORMAL', this.width / 2, this.height / 2 + 20);
    this.ctx.fillText('3 - HARD', this.width / 2, this.height / 2 + 60);
    
    // Instructions
    this.ctx.fillStyle = '#666';
    this.ctx.font = '16px monospace';
    this.ctx.fillText('PRESS NUMBER TO SELECT', this.width / 2, this.height / 2 + 120);
  }

  private drawGameOverScreen() {
    // Draw background
    this.drawNorseBackground();
    
    // Game Over title
    this.ctx.fillStyle = '#FF0000';
    this.ctx.font = '48px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 150);
    
    // Stats
    this.ctx.fillStyle = '#DDD';
    this.ctx.font = '20px monospace';
    this.ctx.fillText(`FINAL SCORE: ${this.score}`, this.width / 2, this.height / 2 - 80);
    this.ctx.fillText(`WAVE REACHED: ${this.ragnarokPhase}`, this.width / 2, this.height / 2 - 50);
    this.ctx.fillText(`ENEMIES DEFEATED: ${this.enemiesDefeated}`, this.width / 2, this.height / 2 - 20);
    this.ctx.fillText(`BOSS DEFEATED: ${this.bossDefeated ? 'YES' : 'NO'}`, this.width / 2, this.height / 2 + 10);
    
    // Lives remaining
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = '18px monospace';
    this.ctx.fillText(`LIVES REMAINING: ${this.lives}`, this.width / 2, this.height / 2 + 40);
    
    // Restart instructions
    this.ctx.fillStyle = '#00FF00';
    this.ctx.font = '18px monospace';
    this.ctx.fillText('PRESS ENTER OR SPACE TO RESTART', this.width / 2, this.height / 2 + 100);
  }

  private drawGameplay() {
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
    // Last Starfighter-style HUD with authentic elements
    this.ctx.save();
    
    // Main HUD background - much more transparent so game is visible
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Central targeting reticle (Last Starfighter style)
    this.ctx.strokeStyle = this.player.targetingLock ? '#00FF00' : '#FFD700';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = this.player.targetingLock ? '#00FF00' : '#FFD700';
    this.ctx.shadowBlur = 10;
    
    // Main reticle circle
    this.ctx.beginPath();
    this.ctx.arc(this.width / 2, this.height / 2, 30, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Crosshairs
    this.ctx.beginPath();
    this.ctx.moveTo(this.width / 2 - 40, this.height / 2);
    this.ctx.lineTo(this.width / 2 + 40, this.height / 2);
    this.ctx.moveTo(this.width / 2, this.height / 2 - 40);
    this.ctx.lineTo(this.width / 2, this.height / 2 + 40);
    this.ctx.stroke();
    
    // Targeting lock indicator
    if (this.player.targetingLock && this.player.targetLocked) {
      this.ctx.strokeStyle = '#00FF00';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(this.player.targetLocked.position.x, this.player.targetLocked.position.y, 25, 0, Math.PI * 2);
      this.ctx.stroke();
      
      // Lock-on text
      this.ctx.fillStyle = '#00FF00';
      this.ctx.font = '12px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('LOCK ON', this.width / 2, this.height / 2 - 50);
    }
    
    this.ctx.shadowBlur = 0;
    
    // Weapon energy displays (left and right)
    this.drawWeaponDisplay('LASER ENERGY', this.player.weaponEnergy.laser, 50, 50, '#00FFFF');
    this.drawWeaponDisplay('ION CANNON', this.player.weaponEnergy.ion, this.width - 150, 50, '#FF4500');
    
    // Hull temperature and ship status
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = '14px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`HULL TEMP: ${Math.round(this.player.health)}`, 20, this.height - 80);
    this.ctx.fillText(`SCORE: ${this.score}`, 20, this.height - 60);
    this.ctx.fillText(`GROUP: ${this.ragnarokPhase}`, 20, this.height - 40);
    this.ctx.fillText(`LIVES: ${this.lives}`, 20, this.height - 20);
    
    // Grace period indicator
    if (this.gracePeriod > 0) {
      this.ctx.fillStyle = '#00FF00';
      this.ctx.font = '16px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`INVULNERABLE: ${Math.ceil(this.gracePeriod / 60)}s`, this.width / 2, this.height - 80);
    }
    
    // Wave completion indicator
    if (this.waveCompleteTimer > 0) {
      this.ctx.fillStyle = '#FFD700';
      this.ctx.font = '20px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`WAVE ${this.ragnarokPhase} COMPLETE!`, this.width / 2, this.height - 100);
      this.ctx.fillStyle = '#00FF00';
      this.ctx.font = '16px monospace';
      this.ctx.fillText(`NEXT WAVE IN: ${Math.ceil(this.waveCompleteTimer / 60)}s`, this.width / 2, this.height - 80);
    }
    
    // Boss health bar
    if (this.bossActive) {
      const boss = this.enemies.find(e => e.type === 'sinistar_boss' && e.alive);
      if (boss) {
        this.drawBossHealthBar(boss);
      }
    }
    
    // Enemy command display
    if (this.enemyCommandTimer > 0 && this.enemyCommandTimer < 60) {
      const command = this.enemyCommands[Math.floor(Math.random() * this.enemyCommands.length)];
      this.ctx.fillStyle = '#FF0000';
      this.ctx.font = '18px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(command, this.width / 2, 50);
    }
    
    // Death Blossom status
    if (this.player.deathBlossomReady && this.player.deathBlossomCooldown <= 0) {
      this.ctx.fillStyle = '#FF0000';
      this.ctx.font = '16px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('DEATH BLOSSOM READY', this.width / 2, this.height - 20);
    } else if (this.player.deathBlossomCooldown > 0) {
      this.ctx.fillStyle = '#FFD700';
      this.ctx.font = '12px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`DEATH BLOSSOM: ${Math.ceil(this.player.deathBlossomCooldown / 60)}s`, this.width / 2, this.height - 20);
    }
    
    // Squadron indicators
    this.drawSquadronRadar();
    
    this.ctx.restore();
  }

  private drawWeaponDisplay(label: string, energy: number, x: number, y: number, color: string) {
    this.ctx.save();
    
    // Weapon label
    this.ctx.fillStyle = color;
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(label, x, y);
    
    // Energy value
    this.ctx.fillText(`${(energy / 100).toFixed(2)}`, x, y + 20);
    
    // Energy bar
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(x, y + 25, 100, 10);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y + 25, (energy / 100) * 100, 10);
    
    this.ctx.restore();
  }

  private drawSquadronRadar() {
    // Spherical radar displays (top corners)
    const radarSize = 60;
    
    // Top-left radar
    this.ctx.save();
    this.ctx.strokeStyle = '#00FF00';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(radarSize, radarSize, radarSize, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Draw enemies as dots on radar
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;
      
      const relativeX = (enemy.position.x - this.player.position.x) / 10;
      const relativeY = (enemy.position.y - this.player.position.y) / 10;
      
      if (Math.abs(relativeX) < radarSize && Math.abs(relativeY) < radarSize) {
        this.ctx.fillStyle = enemy.type === 'mothership' ? '#FF0000' : enemy.type === 'destroyer' ? '#FF4500' : '#FFFF00';
        this.ctx.beginPath();
        this.ctx.arc(radarSize + relativeX, radarSize + relativeY, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
    
    this.ctx.restore();
    
    // Top-right radar (mirror)
    this.ctx.save();
    this.ctx.strokeStyle = '#00FF00';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(this.width - radarSize, radarSize, radarSize, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Draw projectiles as dots
    this.enemyProjectiles.forEach(proj => {
      const relativeX = (proj.position.x - this.player.position.x) / 10;
      const relativeY = (proj.position.y - this.player.position.y) / 10;
      
      if (Math.abs(relativeX) < radarSize && Math.abs(relativeY) < radarSize) {
        this.ctx.fillStyle = '#FF0000';
        this.ctx.beginPath();
        this.ctx.arc(this.width - radarSize + relativeX, radarSize + relativeY, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
    
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

  private drawBossHealthBar(boss: Enemy) {
    const barWidth = 400;
    const barHeight = 20;
    const x = (this.width - barWidth) / 2;
    const y = 20;
    
    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(x - 5, y - 5, barWidth + 10, barHeight + 10);
    
    // Health bar background
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(x, y, barWidth, barHeight);
    
    // Health bar
    const healthPercent = boss.health / boss.maxHealth;
    const healthColor = healthPercent > 0.66 ? '#00FF00' : healthPercent > 0.33 ? '#FFD700' : '#FF0000';
    this.ctx.fillStyle = healthColor;
    this.ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
    
    // Border
    this.ctx.strokeStyle = '#FFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, barWidth, barHeight);
    
    // Boss name and phase
    this.ctx.fillStyle = '#FF0000';
    this.ctx.font = '16px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`SINISTAR BOSS - PHASE ${boss.phase}`, this.width / 2, y - 10);
    
    // Health text
    this.ctx.fillStyle = '#FFF';
    this.ctx.font = '14px monospace';
    this.ctx.fillText(`${Math.round(boss.health)}/${boss.maxHealth}`, this.width / 2, y + barHeight + 20);
  }

  private drawEnemy(enemy: Enemy) {
    this.ctx.save();
    this.ctx.translate(enemy.position.x, enemy.position.y);

    // Ko-Dan Armada ship designs
    if (enemy.enraged) {
        const pulse = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
        this.ctx.shadowColor = `rgba(255, 0, 0, ${pulse})`;
        this.ctx.shadowBlur = 20;
    }

    switch (enemy.type) {
      case 'fighter':
        // Ko-Dan Fighter - small, fast, angular
        this.ctx.fillStyle = '#8B0000';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -enemy.size/2);
        this.ctx.lineTo(-enemy.size/3, enemy.size/2);
        this.ctx.lineTo(enemy.size/3, enemy.size/2);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Wing details
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Squadron indicator
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = '8px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${enemy.squadron}`, 0, -enemy.size/2 - 8);
        break;
        
      case 'destroyer':
        // Ko-Dan Destroyer - heavy, blocky, powerful
        this.ctx.fillStyle = '#2C3E50';
        this.ctx.fillRect(-enemy.size/2, -enemy.size/2, enemy.size, enemy.size);
        
        // Heavy armor plating
        this.ctx.strokeStyle = '#FF4500';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(-enemy.size/2, -enemy.size/2, enemy.size, enemy.size);
        
        // Weapon ports
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(-enemy.size/4, -enemy.size/4, enemy.size/2, enemy.size/2);
        
        // Destroyer label
        this.ctx.fillStyle = '#FF4500';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('DESTROYER', 0, -enemy.size/2 - 10);
        break;
        
      case 'mothership':
        // Ko-Dan Mothership - massive, intimidating
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, enemy.size/2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Outer ring
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, enemy.size/2, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Inner structure
        this.ctx.fillStyle = '#FF0000';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, enemy.size/4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Mothership label
        this.ctx.fillStyle = '#FF0000';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MOTHERSHIP', 0, -enemy.size/2 - 15);
        break;
        
      case 'sinistar_boss': {
        // Sinistar Boss - massive, sinister, pulsing
        const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
        this.ctx.shadowColor = `rgba(255, 0, 0, ${pulse})`;
        this.ctx.shadowBlur = 30;
        
        // Main body - dark red with pulsing effect
        this.ctx.fillStyle = `rgba(139, 0, 0, ${pulse})`;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, enemy.size/2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Outer ring - menacing red
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, enemy.size/2, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Inner core - pulsing white
        this.ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, enemy.size/4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Sinister spikes
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI * 2) / 8;
          const x1 = Math.cos(angle) * (enemy.size/2 - 10);
          const y1 = Math.sin(angle) * (enemy.size/2 - 10);
          const x2 = Math.cos(angle) * (enemy.size/2 + 10);
          const y2 = Math.sin(angle) * (enemy.size/2 + 10);
          
          this.ctx.beginPath();
          this.ctx.moveTo(x1, y1);
          this.ctx.lineTo(x2, y2);
          this.ctx.stroke();
        }
        
        // Boss label
        this.ctx.fillStyle = '#FF0000';
        this.ctx.font = '16px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SINISTAR', 0, -enemy.size/2 - 20);
        break;
      }
    }

    // Health bar
    const barWidth = enemy.size;
    const barHeight = 4;
    const healthPercent = enemy.health / enemy.maxHealth;
    
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(-barWidth/2, -enemy.size/2 - 15, barWidth, barHeight);
    this.ctx.fillStyle = '#00FF00';
    this.ctx.fillRect(-barWidth/2, -enemy.size/2 - 15, barWidth * healthPercent, barHeight);

    this.ctx.restore();
  }

  private drawPlayerProjectile(proj: Projectile) {
    this.ctx.save();
    
    switch (proj.type) {
      case 'ion_cannon':
        this.ctx.fillStyle = '#FF4500';
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#FF4500';
        this.ctx.shadowBlur = 8;
        break;
      case 'laser':
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.strokeStyle = '#0080FF';
        this.ctx.lineWidth = 1;
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.shadowBlur = 5;
        break;
      default:
        this.ctx.fillStyle = '#00FFFF';
    }
    
    this.ctx.beginPath();
    this.ctx.arc(proj.position.x, proj.position.y, proj.size, 0, Math.PI * 2);
    this.ctx.fill();
    if (proj.type === 'ion_cannon') {
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  private drawEnemyProjectile(proj: Projectile) {
    this.ctx.save();
    this.ctx.fillStyle = proj.type === 'destroyer_blast' ? '#FF4500' : '#DC143C';
    this.ctx.shadowColor = '#FF0000';
    this.ctx.shadowBlur = 5;
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
    this.drawText('WASD: Move | Space: Laser | X: Ion Cannon | Z: Death Blossom', this.width / 2, this.height - 60, 12, '#DDD', 'center');
    
    // Targeting explanation
    this.drawText('CENTRAL TARGETING: Move ship to aim reticle at enemies for auto-lock', this.width / 2, this.height - 40, 10, '#00FF00', 'center');
    
    // Last Starfighter theme
    this.drawText('GUNSTAR FIGHTER: Defend Earth from the Ko-Dan Armada!', this.width / 2, this.height - 20, 12, '#FFD700', 'center');
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

  handleInput(_event: KeyboardEvent) {
    // Handled in update method through keys Set
  }

  private playHitSound() {
    const audioState = (window as unknown as WindowExtensions).__CULTURAL_ARCADE_AUDIO__;
    if (audioState && !audioState.isMuted) {
      audioState.playHit();
    }
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