import React, { memo, useRef, useEffect } from 'react';
import { GameCanvas } from './GameCanvas';
import { useGameStore } from '../lib/stores/useGameStore';

export const OptimizedGameCanvas = memo(() => {
  const animationRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);
  const { gameState } = useGameStore();

  // Performance monitoring
  useEffect(() => {
    if (gameState === 'playing') {
      const monitorPerformance = () => {
        const now = performance.now();
        const deltaTime = now - lastFrameTimeRef.current;

        if (deltaTime > 1000 / 30) { // Below 30fps warning
          console.warn(`Performance: Low FPS detected (${Math.round(1000 / deltaTime)}fps)`);
        }

        lastFrameTimeRef.current = now;
        animationRef.current = requestAnimationFrame(monitorPerformance);
      };

      animationRef.current = requestAnimationFrame(monitorPerformance);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [gameState]);

  return (
    <GameCanvas />
  );
});

OptimizedGameCanvas.displayName = 'OptimizedGameCanvas';
