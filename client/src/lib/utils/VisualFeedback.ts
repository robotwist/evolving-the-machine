interface HitMarker {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  damage?: number;
  combo?: number;
  type: 'hit' | 'critical' | 'miss' | 'combo';
}

interface DamageNumber {
  x: number;
  y: number;
  value: number;
  life: number;
  maxLife: number;
  velocity: { x: number; y: number };
  type: 'damage' | 'heal' | 'combo';
}

export class VisualFeedback {
  private ctx: CanvasRenderingContext2D;
  private hitMarkers: HitMarker[] = [];
  private damageNumbers: DamageNumber[] = [];
  private comboCounter = 0;
  private lastHitTime = 0;
  private comboTimeout = 2000; // 2 seconds to maintain combo

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  addHitMarker(x: number, y: number, damage?: number, type: 'hit' | 'critical' | 'miss' = 'hit') {
    const now = Date.now();
    
    // Check if we should increment combo
    if (now - this.lastHitTime < this.comboTimeout) {
      this.comboCounter++;
    } else {
      this.comboCounter = 1;
    }
    this.lastHitTime = now;

    // Add hit marker
    this.hitMarkers.push({
      x,
      y,
      life: 1.0,
      maxLife: 1.0,
      damage,
      combo: this.comboCounter,
      type
    });

    // Add damage number if damage provided
    if (damage) {
      this.addDamageNumber(x, y, damage, type === 'critical' ? 'combo' : 'damage');
    }
  }

  addDamageNumber(x: number, y: number, value: number, type: 'damage' | 'heal' | 'combo' = 'damage') {
    this.damageNumbers.push({
      x,
      y,
      value,
      life: 1.0,
      maxLife: 1.0,
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: -2 - Math.random() * 2
      },
      type
    });
  }

  update(deltaTime: number) {
    // Update hit markers
    this.hitMarkers = this.hitMarkers.filter(marker => {
      marker.life -= deltaTime * 2; // Fade out over 0.5 seconds
      return marker.life > 0;
    });

    // Update damage numbers
    this.damageNumbers = this.damageNumbers.filter(number => {
      number.life -= deltaTime * 1.5; // Fade out over ~0.67 seconds
      number.x += number.velocity.x;
      number.y += number.velocity.y;
      number.velocity.y += 0.1; // Gravity
      return number.life > 0;
    });

    // Reset combo if timeout exceeded
    if (Date.now() - this.lastHitTime > this.comboTimeout) {
      this.comboCounter = 0;
    }
  }

  render() {
    // Render hit markers
    this.hitMarkers.forEach(marker => {
      const alpha = marker.life / marker.maxLife;
      const size = 20 + (1 - alpha) * 10;
      
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      
      // Draw hit marker based on type
      switch (marker.type) {
        case 'hit':
          this.drawHitMarker(marker.x, marker.y, size, '#00FF00');
          break;
        case 'critical':
          this.drawHitMarker(marker.x, marker.y, size, '#FF0000');
          break;
        case 'miss':
          this.drawHitMarker(marker.x, marker.y, size, '#FFFF00');
          break;
      }
      
      // Draw combo counter
      if (marker.combo && marker.combo > 1) {
        this.drawComboCounter(marker.x, marker.y - 30, marker.combo);
      }
      
      this.ctx.restore();
    });

    // Render damage numbers
    this.damageNumbers.forEach(number => {
      const alpha = number.life / number.maxLife;
      const scale = 1 + (1 - alpha) * 0.5;
      
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.font = `${Math.floor(16 * scale)}px monospace`;
      this.ctx.textAlign = 'center';
      
      // Color based on type
      switch (number.type) {
        case 'damage':
          this.ctx.fillStyle = '#FF4444';
          break;
        case 'heal':
          this.ctx.fillStyle = '#44FF44';
          break;
        case 'combo':
          this.ctx.fillStyle = '#FFAA00';
          break;
      }
      
      this.ctx.fillText(number.value.toString(), number.x, number.y);
      this.ctx.restore();
    });
  }

  private drawHitMarker(x: number, y: number, size: number, color: string) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    
    // Draw cross
    this.ctx.beginPath();
    this.ctx.moveTo(x - size, y);
    this.ctx.lineTo(x + size, y);
    this.ctx.moveTo(x, y - size);
    this.ctx.lineTo(x, y + size);
    this.ctx.stroke();
    
    // Draw circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawComboCounter(x: number, y: number, combo: number) {
    this.ctx.font = '14px monospace';
    this.ctx.fillStyle = '#FFAA00';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`COMBO x${combo}`, x, y);
  }

  getComboCount() {
    return this.comboCounter;
  }

  resetCombo() {
    this.comboCounter = 0;
  }
}
