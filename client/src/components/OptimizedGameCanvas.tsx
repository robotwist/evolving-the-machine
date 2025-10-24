import React, { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { GameCanvas } from './GameCanvas';

interface OptimizedGameCanvasProps {
  currentGame: string;
  stage: number;
  gameState: 'playing' | 'paused' | 'ended' | 'stage-complete';
  onGameComplete: () => void;
  onScoreUpdate: (score: number) => void;
}

export const OptimizedGameCanvas = memo<OptimizedGameCanvasProps>(({
  currentGame,
  stage,
  gameState,
  onGameComplete,
  onScoreUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);

  // Memoize expensive calculations
  const gameConfig = useMemo(() => ({
    gameType: currentGame,
    stage,
    width: 800,
    height: 600,
  }), [currentGame, stage]);

  const performanceSettings = useMemo(() => ({
    maxFPS: 60,
    adaptiveQuality: true,
    particleLimit: 500,
  }), []);

  // Stable callback references
  const handleComplete = useCallback(() => {
    onGameComplete();
  }, [onGameComplete]);

  const handleScoreUpdate = useCallback((score: number) => {
    onScoreUpdate(score);
  }, [onScoreUpdate]);

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
    <GameCanvas
      currentGame={currentGame}
      stage={stage}
      gameState={gameState}
      onGameComplete={handleComplete}
      onScoreUpdate={handleScoreUpdate}
      config={gameConfig}
      performance={performanceSettings}
    />
  );
});

OptimizedGameCanvas.displayName = 'OptimizedGameCanvas';
