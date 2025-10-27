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
        particleSystem.addExplosion(100, 100, 5, '#FF0000', 'small');
      }
      
      // Should not exceed max particles
      expect((particleSystem as any).particles.length).toBeLessThanOrEqual(500);
    });
  });

  describe('Particle Updates', () => {
    it('should update particle positions', () => {
      particleSystem.addExplosion(100, 100, 5, '#FF0000', 'small');
      const initialParticles = [...(particleSystem as any).particles];
      
      particleSystem.update();
      
      // Particles should have moved
      const updatedParticles = (particleSystem as any).particles;
      expect(updatedParticles[0].x).not.toBe(initialParticles[0].x);
      expect(updatedParticles[0].y).not.toBe(initialParticles[0].y);
    });

    it('should remove expired particles', () => {
      particleSystem.addExplosion(100, 100, 5, '#FF0000', 'small');
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
      particleSystem.addExplosion(100, 100, 5, '#FF0000', 'small');
      
      particleSystem.render();
      
      // Should call canvas drawing methods
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should handle empty particle list', () => {
      particleSystem.render();
      
      // Should not crash with no particles
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should maintain good performance with many particles', () => {
      const startTime = performance.now();
      
      // Add many particles
      for (let i = 0; i < 100; i++) {
        particleSystem.addExplosion(100, 100, 5, '#FF0000', 'small');
      }
      
      // Update and render
      particleSystem.update();
      particleSystem.render();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (< 16ms for 60fps)
      expect(duration).toBeLessThan(16);
    });
  });
});
