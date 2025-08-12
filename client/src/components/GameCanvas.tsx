import React, { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { PongGame } from '../lib/games/PongGame';
import { BreakoutGame } from '../lib/games/BreakoutGame';
import { AsteroidsGame } from '../lib/games/AsteroidsGame';
import { DefenderGame } from '../lib/games/DefenderGame';
import { LasatGame } from '../lib/games/LasatGame';
import { DanceInterlude } from '../lib/games/DanceInterlude';
import { StarWarsGame } from '../lib/games/StarWarsGame';
import { BetrayalGame } from '../lib/games/BetrayalGame';
import { BaseGame } from '../lib/games/BaseGame';
import { useSettingsStore } from '../lib/stores/useSettingsStore';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<BaseGame | null>(null);
  const { currentStage, gameState, setGameState } = useGameStore();
  const { updateScore } = useScoreStore();

  const applyCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { width: 0, height: 0 };
    const { innerWidth, innerHeight } = window;
    const dprEnabled = useSettingsStore.getState().enableDprScaling;
    const dpr = dprEnabled ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    // Fill viewport respecting safe areas
    const cssWidth = innerWidth;
    const cssHeight = innerHeight;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    return { width: cssWidth, height: cssHeight };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = applyCanvasSize();

    // Create game instance based on current stage
    let game: BaseGame;
    switch (currentStage) {
      case 1:
        game = new PongGame(ctx, size.width, size.height);
        break;
      case 2:
        game = new BreakoutGame(ctx, size.width, size.height);
        break;
      case 3:
        game = new AsteroidsGame(ctx, size.width, size.height);
        break;
      case 4:
        game = new DefenderGame(ctx, size.width, size.height);
        break;
      case 5:
        game = new LasatGame(ctx, size.width, size.height);
        break;
      case 6:
        game = new DanceInterlude(ctx, size.width, size.height);
        break;
      case 7:
        game = new StarWarsGame(ctx, size.width, size.height);
        break;
      case 8:
        game = new BetrayalGame(ctx, size.width, size.height);
        break;
      default:
        game = new PongGame(ctx, size.width, size.height);
    }

    gameRef.current = game;

    // Game event handlers
    game.onScoreUpdate = (score: number) => {
      updateScore(currentStage, score);
    };

    game.onGameOver = () => {
      setGameState('ended');
    };

    game.onStageComplete = () => {
      setGameState('stage-complete');
      // Unlock next stage when current stage is completed
      const { unlockNextStage } = useGameStore.getState();
      unlockNextStage();
    };

    // Start game
    game.start();

    const handleResize = () => {
      const { width, height } = applyCanvasSize();
      game.resize(width, height);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Touch/pointer controls
    const handlePointerDown = (e: PointerEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = 'touches' in e ? e.touches[0] : (e as PointerEvent);
      const x = (point.clientX - rect.left);
      const y = (point.clientY - rect.top);
      game.handlePointerDown?.(x, y);
    };
    const handlePointerMove = (e: PointerEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = 'touches' in e ? e.touches[0] : (e as PointerEvent);
      const x = (point.clientX - rect.left);
      const y = (point.clientY - rect.top);
      game.handlePointerMove?.(x, y);
    };
    const handlePointerUp = () => {
      game.handlePointerUp?.();
    };
    canvas.addEventListener('pointerdown', handlePointerDown as any, { passive: true });
    canvas.addEventListener('pointermove', handlePointerMove as any, { passive: true });
    window.addEventListener('pointerup', handlePointerUp as any, { passive: true });
    canvas.addEventListener('touchstart', handlePointerDown as any, { passive: true });
    canvas.addEventListener('touchmove', handlePointerMove as any, { passive: true });
    window.addEventListener('touchend', handlePointerUp as any, { passive: true });

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      canvas.removeEventListener('pointerdown', handlePointerDown as any);
      canvas.removeEventListener('pointermove', handlePointerMove as any);
      window.removeEventListener('pointerup', handlePointerUp as any);
      canvas.removeEventListener('touchstart', handlePointerDown as any);
      canvas.removeEventListener('touchmove', handlePointerMove as any);
      window.removeEventListener('touchend', handlePointerUp as any);
    };
  }, [currentStage, updateScore, setGameState, applyCanvasSize]);

  useEffect(() => {
    if (gameRef.current) {
      switch (gameState) {
        case 'playing':
          gameRef.current.resume();
          break;
        case 'paused':
          gameRef.current.pause();
          break;
        case 'ended':
        case 'stage-complete':
          gameRef.current.stop();
          break;
      }
    }
  }, [gameState]);

  return (
    <canvas
      ref={canvasRef}
      className="border border-gray-600"
      style={{
        width: '100vw',
        height: '100vh',
        touchAction: 'none',
        objectFit: 'contain'
      }}
    />
  );
}
