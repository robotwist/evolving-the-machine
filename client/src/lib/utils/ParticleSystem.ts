// Extend window interface for game globals
declare global {
  interface Window {
    __CULTURAL_ARCADE_QUALITY__: string;
  }
}

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
  // Enhanced properties for wow factor
  type?: 'normal' | 'spark' | 'glow' | 'smoke' | 'debris';
  rotation?: number;
  rotationSpeed?: number;
  glowIntensity?: number;
  colorTransition?: { from: string; to: string };
  bounceCount?: number;
  maxBounces?: number;
  trail?: Array<{ x: number; y: number; life: number }>;
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

  addExplosion(x: number, y: number, count = 20, color = '#FFD700', type: 'subtle' | 'dramatic' | 'epic' = 'subtle') {
    const quality = window.__CULTURAL_ARCADE_QUALITY__ || 'medium';
    const particleMultiplier = quality === 'high' ? 1.5 : quality === 'low' ? 0.7 : 1;
    const finalCount = Math.floor(count * particleMultiplier);
    
    // Create variety of particle types based on explosion type
    const particleTypes: Array<'normal' | 'spark' | 'glow' | 'smoke' | 'debris'> = 
      type === 'subtle' ? ['normal', 'spark'] :
      type === 'dramatic' ? ['normal', 'spark', 'glow'] :
      ['normal', 'spark', 'glow', 'smoke', 'debris'];
    
    for (let i = 0; i < finalCount; i++) {
      const angle = (Math.PI * 2 * i) / finalCount;
      const speed = 2 + Math.random() * 4;
      const p = this.getParticle();
      if (!p) break;
      
      // Base properties
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 60;
      p.maxLife = 60;
      p.size = 2 + Math.random() * 3;
      p.gravity = 0.1;
      p.color = color;
      
      // Enhanced properties
      p.type = particleTypes[Math.floor(Math.random() * particleTypes.length)];
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 0.2;
      p.glowIntensity = Math.random() * 0.5 + 0.5;
      p.bounceCount = 0;
      p.maxBounces = Math.floor(Math.random() * 3);
      
      // Color transitions for dramatic effects
      if (type === 'dramatic' || type === 'epic') {
        const colors = ['#FFD700', '#FFA500', '#FF4500', '#FF0000'];
        p.colorTransition = {
          from: colors[Math.floor(Math.random() * colors.length)],
          to: '#FFD700'
        };
        p.color = p.colorTransition.from;
      }
      
      // Trails for epic explosions
      if (type === 'epic' && p.type === 'glow') {
        p.trail = [];
      }
      
      this.particles.push(p);
    }
    
    // Add screen flash for dramatic/epic explosions
    if (type === 'dramatic' || type === 'epic') {
      this.addScreenFlash(x, y, type === 'epic' ? 0.3 : 0.15);
    }
    
    // Audio feedback for explosions
    (async () => {
      try {
        const { useAudio } = await import('../stores/useAudio');
        const audioState = useAudio.getState();
        if (audioState.isMuted) return;
        
        if (type === 'epic') {
          audioState.playStinger('starwars_explosion');
        } else if (type === 'dramatic') {
          audioState.playStinger('defender_explosion');
        } else {
          // Subtle explosion sound
          audioState.playStinger('arcade_hit');
        }
      } catch {
        // Audio system not available
      }
    })();
  }

  addScreenFlash(x: number, y: number, intensity: number) {
    // Create a brief screen flash effect
    const flash = this.getParticle();
    if (!flash) return;
    
    flash.x = x;
    flash.y = y;
    flash.vx = 0;
    flash.vy = 0;
    flash.life = 10;
    flash.maxLife = 10;
    flash.size = 1000; // Large enough to cover screen
    flash.color = '#FFFFFF';
    flash.type = 'glow';
    flash.glowIntensity = intensity;
    flash.gravity = 0;
    
    this.particles.push(flash);
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
    p.type = 'spark';
    p.gravity = undefined;
    this.particles.push(p);
  }

  update() {
    // In-place compaction to avoid allocations
    let write = 0;
    for (let read = 0; read < this.particles.length; read++) {
      const particle = this.particles[read];
      
      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      // Update rotation
      if (particle.rotation !== undefined && particle.rotationSpeed !== undefined) {
        particle.rotation += particle.rotationSpeed;
      }
      
      // Physics: gravity and bouncing
      if (particle.gravity) {
        particle.vy += particle.gravity;
      }
      
      // Bounce off screen edges
      if (particle.bounceCount !== undefined && particle.maxBounces !== undefined) {
        if (particle.x <= 0 || particle.x >= this.ctx.canvas.width) {
          particle.vx = -particle.vx * 0.7;
          particle.bounceCount++;
        }
        if (particle.y >= this.ctx.canvas.height) {
          particle.vy = -particle.vy * 0.7;
          particle.bounceCount++;
        }
      }
      
      // Update trails
      if (particle.trail) {
        particle.trail.push({ x: particle.x, y: particle.y, life: 10 });
        particle.trail = particle.trail.filter(t => --t.life > 0);
      }
      
      // Color transitions
      if (particle.colorTransition) {
        const progress = 1 - (particle.life / particle.maxLife);
        particle.color = this.interpolateColor(particle.colorTransition.from, particle.colorTransition.to, progress);
      }
      
      particle.life--;
      
      // Keep particle if still alive and within bounce limits
      if (particle.life > 0 && 
          (particle.bounceCount === undefined || particle.maxBounces === undefined || particle.bounceCount <= particle.maxBounces)) {
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
      
      // Render trails first
      if (particle.trail && particle.trail.length > 0) {
        this.ctx.globalCompositeOperation = 'lighter';
        particle.trail.forEach((trailPoint, _index) => {
          const trailAlpha = (trailPoint.life / 10) * alpha * 0.3;
          this.ctx.globalAlpha = trailAlpha;
          this.ctx.fillStyle = particle.color;
          this.ctx.beginPath();
          this.ctx.arc(trailPoint.x, trailPoint.y, particle.size * 0.5, 0, Math.PI * 2);
          this.ctx.fill();
        });
      }
      
      // Main particle rendering
      this.ctx.globalAlpha = alpha;
      
      // Glow effect for glow particles
      if (particle.type === 'glow' && particle.glowIntensity) {
        this.ctx.shadowColor = particle.color;
        this.ctx.shadowBlur = particle.size * 3 * particle.glowIntensity;
      }
      
      this.ctx.fillStyle = particle.color;
      
      // Different shapes based on particle type
      switch (particle.type) {
        case 'spark':
          // Spark: small, bright, fast
          this.ctx.beginPath();
          this.ctx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2);
          this.ctx.fill();
          break;
          
        case 'debris':
          // Debris: rotating rectangle
          this.ctx.translate(particle.x, particle.y);
          this.ctx.rotate(particle.rotation || 0);
          this.ctx.fillRect(-particle.size * 0.5, -particle.size * 0.5, particle.size, particle.size);
          break;
          
        case 'smoke':
          // Smoke: soft, expanding circle
          this.ctx.globalAlpha = alpha * 0.3;
          this.ctx.beginPath();
          this.ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
          this.ctx.fill();
          break;
          
        default:
          // Normal: standard circle
          this.ctx.beginPath();
          this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          this.ctx.fill();
      }
      
      this.ctx.restore();
    });
  }

  private interpolateColor(from: string, to: string, progress: number): string {
    // Simple color interpolation
    const fromRGB = this.hexToRgb(from);
    const toRGB = this.hexToRgb(to);
    
    if (!fromRGB || !toRGB) return from;
    
    const r = Math.round(fromRGB.r + (toRGB.r - fromRGB.r) * progress);
    const g = Math.round(fromRGB.g + (toRGB.g - fromRGB.g) * progress);
    const b = Math.round(fromRGB.b + (toRGB.b - fromRGB.b) * progress);
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
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
