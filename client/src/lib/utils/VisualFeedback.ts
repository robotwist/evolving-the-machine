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
    private damageNumbers: { x: number, y: number, text: string, timer: number }[] = [];
    private comboCounter: { x: number, y: number, count: number, timer: number } | null = null;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    addDamageNumber(x: number, y: number, damage: number) {
        this.damageNumbers.push({ x, y, text: `-${damage}`, timer: 60 });
    }

    updateCombo(x: number, y: number, count: number) {
        this.comboCounter = { x, y, count, timer: 120 };
    }

    update(deltaTime: number) {
        // Update damage numbers
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dn = this.damageNumbers[i];
            dn.timer -= 1;
            dn.y -= 0.5; // Move up
            if (dn.timer <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }

        // Update combo counter
        if (this.comboCounter) {
            this.comboCounter.timer -= 1;
            if (this.comboCounter.timer <= 0) {
                this.comboCounter = null;
            }
        }
    }

    render() {
        this.ctx.save();
        this.ctx.fillStyle = 'red';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';

        // Render damage numbers
        for (const dn of this.damageNumbers) {
            this.ctx.globalAlpha = dn.timer / 60;
            this.ctx.fillText(dn.text, dn.x, dn.y);
        }

        // Render combo counter
        if (this.comboCounter && this.comboCounter.count > 1) {
            this.ctx.globalAlpha = this.comboCounter.timer / 120;
            this.ctx.fillStyle = 'orange';
            this.ctx.font = `bold ${18 + this.comboCounter.count}px Arial`;
            this.ctx.fillText(`x${this.comboCounter.count}`, this.comboCounter.x, this.comboCounter.y);
        }

        this.ctx.restore();
    }
}
