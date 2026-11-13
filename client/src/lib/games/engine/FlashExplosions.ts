interface FlashExplosion {
  x: number;
  y: number;
  maxRadius: number;
  radius: number;
  framesLeft: number;
  totalFrames: number;
}

/** Simple shrinking, fading fireball used by the space-combat stages. */
export class FlashExplosions {
  private explosions: FlashExplosion[] = [];

  spawn(x: number, y: number, maxRadius: number, frames = 30) {
    this.explosions.push({ x, y, maxRadius, radius: maxRadius, framesLeft: frames, totalFrames: frames });
  }

  update() {
    this.explosions = this.explosions.filter(explosion => {
      explosion.framesLeft--;
      explosion.radius = (explosion.framesLeft / explosion.totalFrames) * explosion.maxRadius;
      return explosion.framesLeft > 0;
    });
  }

  render(ctx: CanvasRenderingContext2D, options: { core?: boolean } = {}) {
    for (const explosion of this.explosions) {
      const alpha = explosion.framesLeft / explosion.totalFrames;
      ctx.fillStyle = `rgba(255, 100, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
      ctx.fill();

      if (options.core) {
        ctx.fillStyle = `rgba(255, 255, 100, ${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  get count(): number {
    return this.explosions.length;
  }

  clear() {
    this.explosions = [];
  }
}
