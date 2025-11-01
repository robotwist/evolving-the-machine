export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export class LasatRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  drawBackground() {
    // Norse-inspired space background
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#0a0a1a');
    gradient.addColorStop(0.5, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw stars
    this.ctx.fillStyle = '#FFD700';
    for (let i = 0; i < 200; i++) {
      const x = (i * 137.5) % this.width;
      const y = (i * 247.3) % this.height;
      const size = Math.random() * 2;
      this.ctx.fillRect(x, y, size, size);
    }
  }

  drawPlayer(player: any) {
    this.ctx.save();
    this.ctx.translate(player.position.x, player.position.y);

    // Shield effect
    if (player.shieldActive) {
      this.ctx.strokeStyle = '#00FFFF';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, player.size + 10, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Gunstar fighter
    this.ctx.fillStyle = '#FFD700';
    this.ctx.strokeStyle = '#FFA500';
    this.ctx.lineWidth = 2;

    // Main body
    this.ctx.beginPath();
    this.ctx.moveTo(0, -player.size);
    this.ctx.lineTo(-player.size * 0.7, player.size * 0.3);
    this.ctx.lineTo(-player.size * 0.3, player.size);
    this.ctx.lineTo(player.size * 0.3, player.size);
    this.ctx.lineTo(player.size * 0.7, player.size * 0.3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Cockpit
    this.ctx.fillStyle = '#00FFFF';
    this.ctx.beginPath();
    this.ctx.arc(0, -player.size * 0.3, player.size * 0.3, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  drawEnemy(enemy: any) {
    this.ctx.save();
    this.ctx.translate(enemy.position.x, enemy.position.y);

    if (enemy.type === 'sinistar_boss') {
      this.drawSinistarBoss(enemy);
    } else {
      this.drawKoDanShip(enemy);
    }

    this.ctx.restore();
  }

  private drawKoDanShip(enemy: any) {
    const color = enemy.type === 'fighter' ? '#FF4444' : 
                  enemy.type === 'destroyer' ? '#FF8800' : '#FF0088';

    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1;

    // Ko-Dan ship design
    this.ctx.beginPath();
    this.ctx.moveTo(0, -enemy.size);
    this.ctx.lineTo(-enemy.size * 0.8, enemy.size * 0.2);
    this.ctx.lineTo(-enemy.size * 0.4, enemy.size);
    this.ctx.lineTo(enemy.size * 0.4, enemy.size);
    this.ctx.lineTo(enemy.size * 0.8, enemy.size * 0.2);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Target lock indicator
    if (enemy.targetable) {
      this.ctx.strokeStyle = '#00FF00';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, enemy.size + 5, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  private drawSinistarBoss(boss: any) {
    // Sinistar boss - large, menacing ship
    const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
    
    this.ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
    this.ctx.strokeStyle = '#FF0000';
    this.ctx.lineWidth = 3;

    // Main body - angular and menacing
    this.ctx.beginPath();
    this.ctx.moveTo(0, -boss.size);
    this.ctx.lineTo(-boss.size * 0.9, -boss.size * 0.3);
    this.ctx.lineTo(-boss.size * 0.7, boss.size * 0.5);
    this.ctx.lineTo(-boss.size * 0.3, boss.size);
    this.ctx.lineTo(boss.size * 0.3, boss.size);
    this.ctx.lineTo(boss.size * 0.7, boss.size * 0.5);
    this.ctx.lineTo(boss.size * 0.9, -boss.size * 0.3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Glowing core
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, boss.size * 0.3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawProjectile(projectile: any) {
    this.ctx.save();
    
    if (projectile.type === 'ion_cannon') {
      this.ctx.fillStyle = '#00FFFF';
      this.ctx.strokeStyle = '#0080FF';
      this.ctx.lineWidth = 2;
    } else if (projectile.type === 'destroyer_blast') {
      this.ctx.fillStyle = '#FF4500';
      this.ctx.strokeStyle = '#FF0000';
      this.ctx.lineWidth = 2;
    } else {
      this.ctx.fillStyle = '#FFFF00';
      this.ctx.strokeStyle = '#FFA500';
      this.ctx.lineWidth = 1;
    }

    this.ctx.beginPath();
    this.ctx.arc(projectile.position.x, projectile.position.y, projectile.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawPowerUp(powerUp: any) {
    this.ctx.save();
    
    const colors = {
      health: '#00FF00',
      energy: '#00FFFF',
      shield: '#0080FF',
      weapon_upgrade: '#FFD700'
    };

    this.ctx.fillStyle = colors[powerUp.type as keyof typeof colors] || '#FFFFFF';
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.arc(powerUp.position.x, powerUp.position.y, powerUp.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Pulsing effect
    const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
    this.ctx.globalAlpha = pulse;
    this.ctx.beginPath();
    this.ctx.arc(powerUp.position.x, powerUp.position.y, powerUp.size * 1.5, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawHUD(player: any, score: number, wave: number, lives: number, boss: any) {
    this.ctx.save();
    
    // HUD background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.fillRect(0, 0, this.width, 120);

    // Weapon energy display
    this.drawWeaponDisplay('LASER', player.weaponEnergy.laser, 20, 30, '#FFFF00');
    this.drawWeaponDisplay('ION', player.weaponEnergy.ion, 20, 50, '#00FFFF');

    // Hull temperature (health)
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillRect(20, 70, 200, 10);
    this.ctx.fillStyle = '#00FF00';
    this.ctx.fillRect(20, 70, (player.health / player.maxHealth) * 200, 10);

    // Score and wave
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = '16px monospace';
    this.ctx.fillText(`SCORE: ${score}`, this.width - 200, 30);
    this.ctx.fillText(`WAVE: ${wave}`, this.width - 200, 50);
    this.ctx.fillText(`LIVES: ${lives}`, this.width - 200, 70);

    // Death Blossom status
    if (player.deathBlossomReady) {
      this.ctx.fillStyle = '#00FF00';
      this.ctx.fillText('DEATH BLOSSOM READY', this.width - 200, 90);
    } else {
      this.ctx.fillStyle = '#FF0000';
      this.ctx.fillText(`DEATH BLOSSOM: ${Math.ceil(player.deathBlossomCooldown / 60)}s`, this.width - 200, 90);
    }

    // Boss health bar
    if (boss) {
      this.drawBossHealthBar(boss);
    }

    this.ctx.restore();
  }

  private drawWeaponDisplay(label: string, energy: number, x: number, y: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`${label}:`, x, y);
    
    const barWidth = 100;
    const barHeight = 8;
    
    // Background
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.fillRect(x + 50, y - 8, barWidth, barHeight);
    
    // Energy bar
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x + 50, y - 8, (energy / 100) * barWidth, barHeight);
  }

  private drawBossHealthBar(boss: any) {
    const barWidth = this.width - 100;
    const barHeight = 20;
    const x = 50;
    const y = this.height - 50;

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(x, y, barWidth, barHeight);

    // Health bar
    const healthPercent = boss.health / boss.maxHealth;
    this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
    this.ctx.fillRect(x, y, healthPercent * barWidth, barHeight);

    // Border
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, barWidth, barHeight);

    // Label
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '14px monospace';
    this.ctx.fillText('SINISTAR', x, y - 5);
  }

  drawStartScreen() {
    this.ctx.save();
    
    // Background
    this.drawBackground();
    
    // Title
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = '48px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('STARFIGHTER', this.width / 2, this.height / 2 - 50);
    
    // Subtitle
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '24px monospace';
    this.ctx.fillText('Press SPACE to begin', this.width / 2, this.height / 2 + 50);
    
    // Instructions
    this.ctx.font = '16px monospace';
    this.ctx.fillText('WASD: Move | Q: Ion Cannon | E: Death Blossom | T: Target Lock', this.width / 2, this.height / 2 + 100);
    
    this.ctx.restore();
  }

  drawGameOverScreen(score: number, enemiesDefeated: number, lives: number) {
    this.ctx.save();
    
    // Background
    this.drawBackground();
    
    // Game Over
    this.ctx.fillStyle = '#FF0000';
    this.ctx.font = '48px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 100);
    
    // Stats
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '24px monospace';
    this.ctx.fillText(`Final Score: ${score}`, this.width / 2, this.height / 2 - 50);
    this.ctx.fillText(`Enemies Defeated: ${enemiesDefeated}`, this.width / 2, this.height / 2 - 20);
    this.ctx.fillText(`Lives Lost: ${5 - lives}`, this.width / 2, this.height / 2 + 10);
    
    // Restart instruction
    this.ctx.fillText('Press SPACE to try again', this.width / 2, this.height / 2 + 80);
    
    this.ctx.restore();
  }

  drawSelectScreen() {
    this.ctx.save();
    
    // Background
    this.drawBackground();
    
    // Title
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = '36px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('SELECT DIFFICULTY', this.width / 2, this.height / 2 - 100);
    
    // Options
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '24px monospace';
    this.ctx.fillText('Press SPACE to start', this.width / 2, this.height / 2);
    
    this.ctx.restore();
  }

  drawEnemyCommand(command: string) {
    this.ctx.save();
    
    this.ctx.fillStyle = '#FF0000';
    this.ctx.font = '20px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(command, this.width / 2, 150);
    
    this.ctx.restore();
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}
