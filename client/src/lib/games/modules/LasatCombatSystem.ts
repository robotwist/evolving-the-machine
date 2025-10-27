import { Vector2 } from '../types';

export interface ProjectileData {
  position: Vector2;
  velocity: Vector2;
  size: number;
  damage: number;
  type: 'laser' | 'ion_cannon' | 'destroyer_blast';
  owner: 'player' | 'enemy';
  lifetime: number;
}

export interface PowerUpData {
  position: Vector2;
  size: number;
  type: 'health' | 'energy' | 'shield' | 'weapon_upgrade';
  lifetime: number;
  collected: boolean;
}

export class LasatCombatSystem {
  private playerProjectiles: ProjectileData[] = [];
  private enemyProjectiles: ProjectileData[] = [];
  private powerUps: PowerUpData[] = [];
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getPlayerProjectiles(): ProjectileData[] {
    return this.playerProjectiles;
  }

  getEnemyProjectiles(): ProjectileData[] {
    return this.enemyProjectiles;
  }

  getPowerUps(): PowerUpData[] {
    return this.powerUps;
  }

  shootPlayerProjectile(position: Vector2, velocity: Vector2, type: 'laser' | 'ion_cannon', damage: number) {
    const projectile: ProjectileData = {
      position: { ...position },
      velocity: { ...velocity },
      size: type === 'laser' ? 3 : 5,
      damage,
      type,
      owner: 'player',
      lifetime: 120
    };
    this.playerProjectiles.push(projectile);
  }

  shootEnemyProjectile(position: Vector2, velocity: Vector2, type: 'laser' | 'destroyer_blast', damage: number) {
    const projectile: ProjectileData = {
      position: { ...position },
      velocity: { ...velocity },
      size: type === 'laser' ? 2 : 8,
      damage,
      type,
      owner: 'enemy',
      lifetime: 180
    };
    this.enemyProjectiles.push(projectile);
  }

  spawnPowerUp(position: Vector2, type: PowerUpData['type']) {
    const powerUp: PowerUpData = {
      position: { ...position },
      size: 15,
      type,
      lifetime: 600, // 10 seconds
      collected: false
    };
    this.powerUps.push(powerUp);
  }

  updateProjectiles() {
    // Update player projectiles
    this.playerProjectiles = this.playerProjectiles.filter(projectile => {
      projectile.position.x += projectile.velocity.x;
      projectile.position.y += projectile.velocity.y;
      projectile.lifetime--;

      return projectile.lifetime > 0 && 
             projectile.position.x >= 0 && 
             projectile.position.x <= this.width &&
             projectile.position.y >= 0 && 
             projectile.position.y <= this.height;
    });

    // Update enemy projectiles
    this.enemyProjectiles = this.enemyProjectiles.filter(projectile => {
      projectile.position.x += projectile.velocity.x;
      projectile.position.y += projectile.velocity.y;
      projectile.lifetime--;

      return projectile.lifetime > 0 && 
             projectile.position.x >= 0 && 
             projectile.position.x <= this.width &&
             projectile.position.y >= 0 && 
             projectile.position.y <= this.height;
    });
  }

  updatePowerUps() {
    this.powerUps = this.powerUps.filter(powerUp => {
      powerUp.lifetime--;
      return powerUp.lifetime > 0 && !powerUp.collected;
    });
  }

  checkCollisions(playerPosition: Vector2, playerSize: number, enemies: any[], playerManager: any): any {
    const collisions = {
      playerHit: false,
      enemiesHit: [] as any[],
      powerUpsCollected: [] as PowerUpData[],
      score: 0
    };

    // Player projectiles vs enemies
    this.playerProjectiles.forEach((projectile, projIndex) => {
      enemies.forEach((enemy, enemyIndex) => {
        if (enemy.alive && this.isColliding(projectile, enemy)) {
          // Enemy hit
          collisions.enemiesHit.push({
            enemy,
            enemyIndex,
            projectile,
            projIndex,
            damage: projectile.damage
          });
          collisions.score += this.getEnemyScore(enemy.type);
        }
      });
    });

    // Enemy projectiles vs player
    this.enemyProjectiles.forEach((projectile, projIndex) => {
      if (this.isColliding(projectile, { position: playerPosition, size: playerSize })) {
        collisions.playerHit = true;
        collisions.enemiesHit.push({
          projectile,
          projIndex,
          damage: projectile.damage
        });
      }
    });

    // Player vs powerups
    this.powerUps.forEach((powerUp, powerUpIndex) => {
      if (!powerUp.collected && this.isColliding(powerUp, { position: playerPosition, size: playerSize })) {
        powerUp.collected = true;
        collisions.powerUpsCollected.push(powerUp);
      }
    });

    return collisions;
  }

  private isColliding(obj1: any, obj2: any): boolean {
    const dx = obj1.position.x - obj2.position.x;
    const dy = obj1.position.y - obj2.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = (obj1.size || 0) + (obj2.size || 0);
    return distance < minDistance;
  }

  private getEnemyScore(enemyType: string): number {
    switch (enemyType) {
      case 'fighter': return 100;
      case 'destroyer': return 250;
      case 'mothership': return 500;
      case 'sinistar_boss': return 2000;
      default: return 50;
    }
  }

  removeProjectile(projectile: ProjectileData, isPlayer: boolean) {
    if (isPlayer) {
      const index = this.playerProjectiles.indexOf(projectile);
      if (index > -1) {
        this.playerProjectiles.splice(index, 1);
      }
    } else {
      const index = this.enemyProjectiles.indexOf(projectile);
      if (index > -1) {
        this.enemyProjectiles.splice(index, 1);
      }
    }
  }

  removePowerUp(powerUp: PowerUpData) {
    const index = this.powerUps.indexOf(powerUp);
    if (index > -1) {
      this.powerUps.splice(index, 1);
    }
  }

  clearAllProjectiles() {
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
  }

  clearAllPowerUps() {
    this.powerUps = [];
  }

  spawnRandomPowerUp() {
    if (Math.random() < 0.01 && this.powerUps.length < 3) { // 1% chance per frame, max 3 powerups
      const types: PowerUpData['type'][] = ['health', 'energy', 'shield', 'weapon_upgrade'];
      const randomType = types[Math.floor(Math.random() * types.length)];
      
      this.spawnPowerUp({
        x: Math.random() * (this.width - 50) + 25,
        y: Math.random() * (this.height - 100) + 50
      }, randomType);
    }
  }

  getProjectileCount(): number {
    return this.playerProjectiles.length + this.enemyProjectiles.length;
  }

  getPowerUpCount(): number {
    return this.powerUps.length;
  }

  reset() {
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.powerUps = [];
  }
}
