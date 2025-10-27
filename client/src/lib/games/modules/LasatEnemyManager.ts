import { Vector2 } from '../types';

export interface EnemyData {
  position: Vector2;
  velocity: Vector2;
  size: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  type: 'fighter' | 'destroyer' | 'mothership' | 'sinistar_boss';
  shootTimer: number;
  specialAttackTimer: number;
  behavior: 'aggressive' | 'defensive' | 'berserker' | 'boss_phase1' | 'boss_phase2' | 'boss_phase3';
  rage: number;
  enraged: boolean;
  enrageTimer: number;
  squadron: number;
  formationPosition: number;
  targetable: boolean;
  lockOnTimer: number;
  phase?: number;
  invulnerableTimer?: number;
  spawnTimer?: number;
  deathBlossomCooldown?: number;
}

export class LasatEnemyManager {
  private enemies: EnemyData[] = [];
  private width: number;
  private height: number;
  private wave = 1;
  private ragnarokPhase = 1;
  private bossActive = false;
  private bossPhase = 1;
  private enemyCommandTimer = 0;
  private enemyCommands = [
    "KO-DAN ARMADA APPROACHING...",
    "SEND IN THE FIGHTERS!",
    "DESTROY THE GUNSTAR!",
    "FLEET DEPLOYMENT INITIATED...",
    "ALL SQUADRONS ATTACK!",
    "THE SINISTAR AWAKENS...",
    "RUN COWARD! RUN!",
    "I HUNGER! I HUNGER!"
  ];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getEnemies(): EnemyData[] {
    return this.enemies;
  }

  getWave(): number {
    return this.wave;
  }

  getRagnarokPhase(): number {
    return this.ragnarokPhase;
  }

  isBossActive(): boolean {
    return this.bossActive;
  }

  getBossPhase(): number {
    return this.bossPhase;
  }

  spawnRagnarokWave() {
    const enemyCount = Math.min(8 + this.wave * 2, 20); // Cap at 20 enemies
    const squadronSize = 4;
    
    for (let i = 0; i < enemyCount; i++) {
      const squadron = Math.floor(i / squadronSize) + 1;
      const formationPos = i % squadronSize;
      
      let enemyType: EnemyData['type'] = 'fighter';
      if (this.wave >= 3 && Math.random() < 0.3) {
        enemyType = 'destroyer';
      }
      if (this.wave >= 5 && Math.random() < 0.1) {
        enemyType = 'mothership';
      }
      
      this.spawnEnemy(enemyType, squadron, formationPos);
    }
    
    this.wave++;
  }

  private spawnEnemy(type: EnemyData['type'], squadron: number, formationPosition: number) {
    const enemy: EnemyData = {
      position: {
        x: Math.random() * (this.width - 100) + 50,
        y: Math.random() * 200 + 50
      },
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: Math.random() * 1 + 0.5
      },
      size: type === 'fighter' ? 15 : type === 'destroyer' ? 25 : type === 'mothership' ? 35 : 50,
      health: type === 'fighter' ? 30 : type === 'destroyer' ? 60 : type === 'mothership' ? 100 : 500,
      maxHealth: type === 'fighter' ? 30 : type === 'destroyer' ? 60 : type === 'mothership' ? 100 : 500,
      alive: true,
      type,
      shootTimer: Math.random() * 60,
      specialAttackTimer: Math.random() * 120,
      behavior: 'aggressive',
      rage: 0,
      enraged: false,
      enrageTimer: 0,
      squadron,
      formationPosition,
      targetable: true,
      lockOnTimer: 0
    };

    if (type === 'sinistar_boss') {
      enemy.behavior = 'boss_phase1';
      enemy.phase = 1;
      enemy.invulnerableTimer = 0;
      enemy.spawnTimer = 0;
      enemy.deathBlossomCooldown = 0;
      this.bossActive = true;
      this.bossPhase = 1;
    }

    this.enemies.push(enemy);
  }

  spawnSinistarBoss() {
    if (this.bossActive) return;
    
    const boss: EnemyData = {
      position: {
        x: this.width / 2,
        y: 100
      },
      velocity: { x: 0, y: 0 },
      size: 80,
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
    this.bossActive = true;
    this.bossPhase = 1;
  }

  updateEnemies(deltaTime: number) {
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;

      if (enemy.type === 'sinistar_boss') {
        this.updateBossBehavior(enemy);
      } else {
        this.updateEnemyBehavior(enemy);
      }

      // Update position
      enemy.position.x += enemy.velocity.x;
      enemy.position.y += enemy.velocity.y;

      // Keep enemies in bounds
      enemy.position.x = Math.max(enemy.size, Math.min(this.width - enemy.size, enemy.position.x));
      enemy.position.y = Math.max(enemy.size, Math.min(this.height - enemy.size, enemy.position.y));

      // Update timers
      if (enemy.shootTimer > 0) enemy.shootTimer--;
      if (enemy.specialAttackTimer > 0) enemy.specialAttackTimer--;
      if (enemy.enrageTimer > 0) enemy.enrageTimer--;
      if (enemy.lockOnTimer > 0) enemy.lockOnTimer--;
      if (enemy.invulnerableTimer && enemy.invulnerableTimer > 0) enemy.invulnerableTimer--;
      if (enemy.spawnTimer && enemy.spawnTimer > 0) enemy.spawnTimer--;
      if (enemy.deathBlossomCooldown && enemy.deathBlossomCooldown > 0) enemy.deathBlossomCooldown--;
    });

    // Remove dead enemies
    this.enemies = this.enemies.filter(enemy => enemy.alive);
  }

  private updateEnemyBehavior(enemy: EnemyData) {
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
  }

  private updateFighterBehavior(enemy: EnemyData) {
    // Simple AI: move towards player and shoot
    enemy.velocity.x += (Math.random() - 0.5) * 0.1;
    enemy.velocity.y += 0.1;
    
    // Limit speed
    const maxSpeed = 2;
    const speed = Math.sqrt(enemy.velocity.x ** 2 + enemy.velocity.y ** 2);
    if (speed > maxSpeed) {
      enemy.velocity.x = (enemy.velocity.x / speed) * maxSpeed;
      enemy.velocity.y = (enemy.velocity.y / speed) * maxSpeed;
    }
  }

  private updateDestroyerBehavior(enemy: EnemyData) {
    // Slower, more deliberate movement
    enemy.velocity.x += (Math.random() - 0.5) * 0.05;
    enemy.velocity.y += 0.05;
    
    const maxSpeed = 1;
    const speed = Math.sqrt(enemy.velocity.x ** 2 + enemy.velocity.y ** 2);
    if (speed > maxSpeed) {
      enemy.velocity.x = (enemy.velocity.x / speed) * maxSpeed;
      enemy.velocity.y = (enemy.velocity.y / speed) * maxSpeed;
    }
  }

  private updateMothershipBehavior(enemy: EnemyData) {
    // Very slow movement, spawns fighters
    enemy.velocity.x += (Math.random() - 0.5) * 0.02;
    enemy.velocity.y += 0.02;
    
    const maxSpeed = 0.5;
    const speed = Math.sqrt(enemy.velocity.x ** 2 + enemy.velocity.y ** 2);
    if (speed > maxSpeed) {
      enemy.velocity.x = (enemy.velocity.x / speed) * maxSpeed;
      enemy.velocity.y = (enemy.velocity.y / speed) * maxSpeed;
    }
  }

  private updateBossBehavior(boss: EnemyData) {
    switch (boss.behavior) {
      case 'boss_phase1':
        this.updateBossPhase1(boss);
        break;
      case 'boss_phase2':
        this.updateBossPhase2(boss);
        break;
      case 'boss_phase3':
        this.updateBossPhase3(boss);
        break;
    }
  }

  private updateBossPhase1(boss: EnemyData) {
    // Slow movement, basic attacks
    boss.velocity.x += (Math.random() - 0.5) * 0.1;
    boss.velocity.y += 0.05;
    
    const maxSpeed = 1;
    const speed = Math.sqrt(boss.velocity.x ** 2 + boss.velocity.y ** 2);
    if (speed > maxSpeed) {
      boss.velocity.x = (boss.velocity.x / speed) * maxSpeed;
      boss.velocity.y = (boss.velocity.y / speed) * maxSpeed;
    }

    // Transition to phase 2 at 66% health
    if (boss.health <= boss.maxHealth * 0.66) {
      boss.behavior = 'boss_phase2';
      boss.phase = 2;
      this.bossPhase = 2;
    }
  }

  private updateBossPhase2(boss: EnemyData) {
    // Faster movement, more aggressive
    boss.velocity.x += (Math.random() - 0.5) * 0.2;
    boss.velocity.y += 0.1;
    
    const maxSpeed = 2;
    const speed = Math.sqrt(boss.velocity.x ** 2 + boss.velocity.y ** 2);
    if (speed > maxSpeed) {
      boss.velocity.x = (boss.velocity.x / speed) * maxSpeed;
      boss.velocity.y = (boss.velocity.y / speed) * maxSpeed;
    }

    // Transition to phase 3 at 33% health
    if (boss.health <= boss.maxHealth * 0.33) {
      boss.behavior = 'boss_phase3';
      boss.phase = 3;
      this.bossPhase = 3;
    }
  }

  private updateBossPhase3(boss: EnemyData) {
    // Very fast, erratic movement
    boss.velocity.x += (Math.random() - 0.5) * 0.3;
    boss.velocity.y += (Math.random() - 0.5) * 0.1;
    
    const maxSpeed = 3;
    const speed = Math.sqrt(boss.velocity.x ** 2 + boss.velocity.y ** 2);
    if (speed > maxSpeed) {
      boss.velocity.x = (boss.velocity.x / speed) * maxSpeed;
      boss.velocity.y = (boss.velocity.y / speed) * maxSpeed;
    }
  }

  canShoot(enemy: EnemyData): boolean {
    return enemy.shootTimer <= 0;
  }

  canSpecialAttack(enemy: EnemyData): boolean {
    return enemy.specialAttackTimer <= 0;
  }

  resetShootTimer(enemy: EnemyData) {
    enemy.shootTimer = enemy.type === 'fighter' ? 30 : enemy.type === 'destroyer' ? 60 : enemy.type === 'mothership' ? 90 : 120;
  }

  resetSpecialAttackTimer(enemy: EnemyData) {
    enemy.specialAttackTimer = enemy.type === 'destroyer' ? 180 : enemy.type === 'mothership' ? 300 : 120;
  }

  takeDamage(enemy: EnemyData, damage: number) {
    if (enemy.invulnerableTimer && enemy.invulnerableTimer > 0) return false;
    
    enemy.health -= damage;
    if (enemy.health <= 0) {
      enemy.alive = false;
      enemy.health = 0;
      
      if (enemy.type === 'sinistar_boss') {
        this.bossActive = false;
        this.bossPhase = 1;
      }
      
      return true; // Enemy died
    }
    return false; // Enemy survived
  }

  getAliveEnemies(): EnemyData[] {
    return this.enemies.filter(enemy => enemy.alive);
  }

  getBoss(): EnemyData | null {
    return this.enemies.find(enemy => enemy.type === 'sinistar_boss' && enemy.alive) || null;
  }

  updateEnemyCommands() {
    this.enemyCommandTimer++;
    if (this.enemyCommandTimer > 300) { // Every 5 seconds
      const command = this.enemyCommands[Math.floor(Math.random() * this.enemyCommands.length)];
      this.enemyCommandTimer = 0;
      return command;
    }
    return null;
  }

  nextWave() {
    this.wave++;
    this.ragnarokPhase++;
  }

  reset() {
    this.enemies = [];
    this.wave = 1;
    this.ragnarokPhase = 1;
    this.bossActive = false;
    this.bossPhase = 1;
    this.enemyCommandTimer = 0;
  }
}
