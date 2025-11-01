import { BaseGame } from './BaseGame';
import { Vector2 } from './types';
import { LasatGameState } from './modules/LasatGameState';
import { LasatPlayerManager } from './modules/LasatPlayerManager';
import { LasatEnemyManager } from './modules/LasatEnemyManager';
import { LasatCombatSystem, ProjectileData, PowerUpData } from './modules/LasatCombatSystem';
import { LasatRenderer } from './modules/LasatRenderer';

interface EnemyHit {
  enemy?: any;
  enemyIndex?: number;
  projectile: ProjectileData;
  projIndex: number;
  damage: number;
}

interface CollisionData {
  playerHit: boolean;
  enemiesHit: EnemyHit[];
  powerUpsCollected: PowerUpData[];
  score: number;
}

export class LasatGame extends BaseGame {
  // Game modules
  private gameState: LasatGameState;
  private playerManager: LasatPlayerManager;
  private enemyManager: LasatEnemyManager;
  private combatSystem: LasatCombatSystem;
  private renderer: LasatRenderer;

  // Game data
  private keys: Set<string> = new Set();
  private score = 0;
  private lastReportedScore = 0;
  private gracePeriod = 180; // 3 seconds of invulnerability
  private waveCompleteTimer = 0;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    super(ctx, width, height);
    
    // Initialize modules
    this.gameState = new LasatGameState();
    this.playerManager = new LasatPlayerManager(width, height);
    this.enemyManager = new LasatEnemyManager(width, height);
    this.combatSystem = new LasatCombatSystem(width, height);
    this.renderer = new LasatRenderer(ctx, width, height);
  }

  async init() {
    console.log('🎮 Initializing starfighter game...');
    this.reset();
  }

  private reset() {
    this.gameState.reset();
    this.enemyManager.reset();
    this.combatSystem.reset();
    this.score = 0;
    this.gracePeriod = 180;
    this.waveCompleteTimer = 0;
  }

  update(deltaTime: number) {
    // Handle input
    this.handleGameInput();

    // Update based on game state
    switch (this.gameState.getGameState()) {
      case 'start':
        // Start screen - no updates needed
        break;
      case 'select':
        // Select screen - no updates needed
        break;
      case 'playing':
        this.updateGameplay(deltaTime);
        break;
      case 'gameOver':
        // Game over screen - no updates needed
        break;
    }
  }

  private handleGameInput() {
    // Handle Konami code
    if (this.gameState.getGameState() === 'start') {
      // Check for Konami code input
      this.keys.forEach(key => {
        if (this.gameState.handleKonamiCodeInput(key)) {
          console.log('🎮 Konami Code activated!');
        }
      });
    }
  }

  private updateGameplay(deltaTime: number) {
    // Update grace period
    if (this.gracePeriod > 0) {
      this.gracePeriod--;
    }

    // Update modules
    this.playerManager.updateKeys(this.keys);
    this.playerManager.update(deltaTime);
    this.enemyManager.updateEnemies(deltaTime);
    this.combatSystem.updateProjectiles();
    this.combatSystem.updatePowerUps();
    this.combatSystem.spawnRandomPowerUp();

    // Handle combat
    this.handleCombat();

    // Check wave completion
    this.checkWaveCompletion();

    // Only update score when it actually changes
    if (this.score !== this.lastReportedScore) {
      this.onScoreUpdate?.(this.score);
      this.lastReportedScore = this.score;
    }
  }

  private handleCombat() {
    const player = this.playerManager.getPlayer();
    const enemies = this.enemyManager.getEnemies();
    
    // Check collisions
    const collisions = this.combatSystem.checkCollisions(
      player.position, 
      player.size, 
      enemies, 
      this.playerManager
    );

    // Handle player hits
    if (collisions.playerHit && this.gracePeriod <= 0) {
      const hitData = collisions.enemiesHit.find((hit: EnemyHit) => hit.damage);
      if (hitData) {
        const damageTaken = this.playerManager.takeDamage(hitData.damage);
        if (damageTaken) {
          this.gameState.loseLife();
          this.gracePeriod = 180; // 3 seconds of invulnerability
        }
        this.combatSystem.removeProjectile(hitData.projectile, false);
      }
    }

    // Handle enemy hits
    collisions.enemiesHit.forEach((hit: EnemyHit) => {
      if (hit.enemy) {
        const enemyDied = this.enemyManager.takeDamage(hit.enemy, hit.damage);
        if (enemyDied) {
          this.gameState.addEnemyDefeated();
          this.score += hit.damage * 10; // Bonus for damage dealt
        }
        this.combatSystem.removeProjectile(hit.projectile, true);
      }
    });

    // Handle powerup collection
    collisions.powerUpsCollected.forEach((powerUp: PowerUpData) => {
      this.collectPowerUp(powerUp);
      this.combatSystem.removePowerUp(powerUp);
    });

    // Handle shooting
    this.handleShooting();
  }

  private handleShooting() {
    const player = this.playerManager.getPlayer();
    
    // Player shooting
    if (this.keys.has('Space')) {
      const weaponEnergy = player.weaponEnergy;
      if (weaponEnergy.laser >= 5) {
        weaponEnergy.laser -= 5;
        this.combatSystem.shootPlayerProjectile(
          player.position,
          { x: 0, y: -8 },
          'laser',
          15
        );
      }
    }

    // Enemy shooting
    this.enemyManager.getEnemies().forEach(enemy => {
      if (this.enemyManager.canShoot(enemy)) {
        this.enemyManager.resetShootTimer(enemy);
        this.combatSystem.shootEnemyProjectile(
          enemy.position,
          { x: 0, y: 2 },
          'laser',
          enemy.type === 'fighter' ? 10 : enemy.type === 'destroyer' ? 20 : 15
        );
      }
    });
  }

  private collectPowerUp(powerUp: PowerUpData) {
    const player = this.playerManager.getPlayer();
    
    switch (powerUp.type) {
      case 'health':
        this.playerManager.heal(50);
        break;
      case 'energy':
        this.playerManager.addEnergy(25);
        break;
      case 'shield':
        this.playerManager.activateShield();
        break;
      case 'weapon_upgrade':
        // Upgrade weapon energy capacity
        player.weaponEnergy.laser = Math.min(150, player.weaponEnergy.laser + 25);
        player.weaponEnergy.ion = Math.min(75, player.weaponEnergy.ion + 15);
        break;
    }
  }

  private checkWaveCompletion() {
    const aliveEnemies = this.enemyManager.getAliveEnemies();
    
    if (aliveEnemies.length === 0) {
      if (this.waveCompleteTimer === 0) {
        this.waveCompleteTimer = 180; // 3 seconds
        console.log(`Wave ${this.enemyManager.getWave()} complete!`);
      } else {
        this.waveCompleteTimer--;
        if (this.waveCompleteTimer <= 0) {
          // Spawn next wave or boss
          if (this.enemyManager.getRagnarokPhase() >= 4) {
            this.enemyManager.spawnSinistarBoss();
          } else {
            this.enemyManager.spawnRagnarokWave();
          }
          this.waveCompleteTimer = 0;
        }
      }
    } else {
      this.waveCompleteTimer = 0; // Reset timer if enemies are still alive
    }
  }

  render() {
    this.renderer.clearCanvas();
    
    switch (this.gameState.getGameState()) {
      case 'start':
        this.renderer.drawStartScreen();
        break;
      case 'select':
        this.renderer.drawSelectScreen();
        break;
      case 'playing':
        this.renderGameplay();
        break;
      case 'gameOver':
        this.renderer.drawGameOverScreen(
          this.score,
          this.gameState.getEnemiesDefeated(),
          this.gameState.getLives()
        );
        break;
    }
  }

  private renderGameplay() {
    // Draw background
    this.renderer.drawBackground();
    
    // Draw game objects
    this.renderer.drawPlayer(this.playerManager.getPlayer());
    
    this.enemyManager.getEnemies().forEach(enemy => {
      this.renderer.drawEnemy(enemy);
    });
    
    this.combatSystem.getPlayerProjectiles().forEach(projectile => {
      this.renderer.drawProjectile(projectile);
    });
    
    this.combatSystem.getEnemyProjectiles().forEach(projectile => {
      this.renderer.drawProjectile(projectile);
    });
    
    this.combatSystem.getPowerUps().forEach(powerUp => {
      this.renderer.drawPowerUp(powerUp);
    });
    
    // Draw HUD
    const boss = this.enemyManager.getBoss();
    this.renderer.drawHUD(
      this.playerManager.getPlayer(),
      this.score,
      this.enemyManager.getWave(),
      this.gameState.getLives(),
      boss
    );
    
    // Draw enemy commands
    const command = this.enemyManager.updateEnemyCommands();
    if (command) {
      this.renderer.drawEnemyCommand(command);
    }
    
    // Draw wave completion message
    if (this.waveCompleteTimer > 0) {
      this.renderer.drawEnemyCommand(`WAVE ${this.enemyManager.getWave()} COMPLETE!`);
    }
  }

  handleInput(event: KeyboardEvent) {
    if (event.type === 'keydown') {
      this.keys.add(event.code);
      
      // Handle game state transitions
      switch (this.gameState.getGameState()) {
        case 'start':
          if (this.gameState.handleStartScreenInput(event.code)) {
            return;
          }
          break;
        case 'select':
          if (this.gameState.handleSelectScreenInput(event.code)) {
            return;
          }
          break;
        case 'gameOver':
          if (this.gameState.handleGameOverInput(event.code)) {
            return;
          }
          break;
      }
    } else if (event.type === 'keyup') {
      this.keys.delete(event.code);
    }
  }

  resize(width: number, height: number) {
    super.resize(width, height);
    this.playerManager = new LasatPlayerManager(width, height);
    this.enemyManager = new LasatEnemyManager(width, height);
    this.combatSystem = new LasatCombatSystem(width, height);
    this.renderer.resize(width, height);
  }
}
