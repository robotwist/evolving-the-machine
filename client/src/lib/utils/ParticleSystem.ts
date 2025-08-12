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
  private pool: Particle[] = [];
  private maxParticles: number;
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D, maxParticles = 800) {
    this.ctx = ctx;
    this.maxParticles = maxParticles;
  }

  addExplosion(x: number, y: number, count = 20, color = '#FFD700') {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 4;
      const p = this.getParticle();
      if (!p) break;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 60;
      p.maxLife = 60;
      p.size = 2 + Math.random() * 3;
      (p as any).gravity = 0.1;
      p.color = color;
      this.particles.push(p);
    }
  }

  addTrail(x: number, y: number, vx: number, vy: number, color = '#00FFFF') {
    const p = this.getParticle();
    if (!p) return;
    p.x = x;
    p.y = y;
    p.vx = vx * 0.1 + (Math.random() - 0.5) * 0.5;
    p.vy = vy * 0.1 + (Math.random() - 0.5) * 0.5;
    p.life = 30;
    p.maxLife = 30;
    p.size = 1 + Math.random() * 2;
    p.color = color;
    (p as any).gravity = undefined;
    this.particles.push(p);
  }

  update() {
    // In-place compaction to avoid allocations
    let write = 0;
    for (let read = 0; read < this.particles.length; read++) {
      const particle = this.particles[read];
      particle.x += particle.vx;
      particle.y += particle.vy;
      if ((particle as any).gravity) {
        particle.vy += (particle as any).gravity;
      }
      particle.life--;
      if (particle.life > 0) {
        if (write !== read) this.particles[write] = particle;
        write++;
      } else {
        this.pool.push(particle);
      }
    }
    this.particles.length = write;
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
    this.pool.push(...this.particles);
    this.particles.length = 0;
  }

  private getParticle(): Particle | null {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    if (this.particles.length + this.pool.length >= this.maxParticles) {
      return null;
    }
    // create new
    return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 1, color: '#fff' };
    }
}
