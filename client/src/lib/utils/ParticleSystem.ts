interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity?: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  addExplosion(x: number, y: number, count = 20, color = '#FFD700') {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 4;
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 60,
        maxLife: 60,
        size: 2 + Math.random() * 3,
        color,
        gravity: 0.1
      });
    }
  }

  addTrail(x: number, y: number, vx: number, vy: number, color = '#00FFFF') {
    this.particles.push({
      x,
      y,
      vx: vx * 0.1 + (Math.random() - 0.5) * 0.5,
      vy: vy * 0.1 + (Math.random() - 0.5) * 0.5,
      life: 30,
      maxLife: 30,
      size: 1 + Math.random() * 2,
      color
    });
  }

  update() {
    this.particles = this.particles.filter(particle => {
      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      // Apply gravity if specified
      if (particle.gravity) {
        particle.vy += particle.gravity;
      }
      
      // Update life
      particle.life--;
      
      return particle.life > 0;
    });
  }

  render() {
    this.particles.forEach(particle => {
      const alpha = particle.life / particle.maxLife;
      
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  clear() {
    this.particles = [];
  }
}
