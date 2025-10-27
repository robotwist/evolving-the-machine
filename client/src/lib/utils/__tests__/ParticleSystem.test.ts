import { ParticleSystem } from '../ParticleSystem';

// Mock canvas context
const mockCtx = {
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
  scale: jest.fn(),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  measureText: jest.fn(() => ({ width: 100 })),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  canvas: {
    width: 800,
    height: 600,
  },
} as unknown as CanvasRenderingContext2D;

describe('ParticleSystem', () => {
  let particleSystem: ParticleSystem;

  beforeEach(() => {
    particleSystem = new ParticleSystem(mockCtx);
    jest.clearAllMocks();
  });

  describe('Particle Creation', () => {
    it('should create explosion particles', () => {
      particleSystem.addExplosion(100, 100, 10, '#FF0000', 'epic');
      
      // Check that particles were added
      expect((particleSystem as any).particles.length).toBeGreaterThan(0);
    });

    it('should create trail particles', () => {
      particleSystem.addTrail(100, 100, 5, -5, '#00FF00');
      
      // Check that particles were added
      expect((particleSystem as any).particles.length).toBeGreaterThan(0);
    });

    it('should limit particle count', () => {
      // Add many particles
      for (let i = 0; i < 1000; i++) {
        particleSystem.addExplosion(100, 100, 5, '#FF0000', 'subtle');
      }
      
      // Should not exceed max particles
      expect((particleSystem as any).particles.length).toBeLessThanOrEqual(800);
    });
  });

  describe('Particle Updates', () => {
      it('should update particle positions', () => {
        particleSystem.addExplosion(100, 100, 5, '#FF0000', 'subtle');
        const initialParticles = [...(particleSystem as any).particles];
        
        // Check that particles have velocity from explosion
        expect(initialParticles.length).toBeGreaterThan(0);
        const firstParticle = initialParticles[0];
        expect(firstParticle.vx).toBeDefined();
        expect(firstParticle.vy).toBeDefined();
        
        particleSystem.update();
        
        // Particles should have moved - check the same particle by index
        const updatedParticles = (particleSystem as any).particles;
        if (updatedParticles.length > 0 && initialParticles.length > 0) {
          // Find the same particle by comparing initial position
          const movedParticle = updatedParticles.find((p: any) => 
            Math.abs(p.x - firstParticle.x) > 0.1 || Math.abs(p.y - firstParticle.y) > 0.1
          );
          expect(movedParticle).toBeDefined();
        }
      });

    it('should remove expired particles', () => {
      particleSystem.addExplosion(100, 100, 5, '#FF0000', 'subtle');
      const initialCount = (particleSystem as any).particles.length;
      
      // Fast forward time to expire particles
      const particles = (particleSystem as any).particles;
      particles.forEach((particle: any) => {
        particle.life = 0;
      });
      
      particleSystem.update();
      
      // Should have fewer particles after update
      expect((particleSystem as any).particles.length).toBeLessThan(initialCount);
    });
  });

  describe('Particle Rendering', () => {
    it('should render particles', () => {
      particleSystem.addExplosion(100, 100, 5, '#FF0000', 'subtle');
      
      particleSystem.render();
      
      // Should call canvas drawing methods
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should handle empty particle list', () => {
      particleSystem.render();
      
      // Should not crash with no particles
      expect(mockCtx.save).not.toHaveBeenCalled();
      expect(mockCtx.restore).not.toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should maintain good performance with many particles', () => {
      const startTime = performance.now();
      
      // Add many particles
      for (let i = 0; i < 100; i++) {
        particleSystem.addExplosion(100, 100, 5, '#FF0000', 'subtle');
      }
      
      // Update and render
      particleSystem.update();
      particleSystem.render();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (< 20ms for 50fps)
      expect(duration).toBeLessThan(20);
    });
  });
});
