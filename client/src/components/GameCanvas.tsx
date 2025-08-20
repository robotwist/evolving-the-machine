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
import { useAudio } from '../lib/stores/useAudio';

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
    let gameClass: typeof BaseGame;
    switch (currentStage) {
      case 1:
        gameClass = PongGame;
        break;
      case 2:
        gameClass = BreakoutGame;
        break;
      case 3:
        gameClass = AsteroidsGame;
        break;
      case 4:
        gameClass = DefenderGame;
        break;
      case 5:
        gameClass = LasatGame;
        break;
      case 6:
        gameClass = DanceInterlude;
        break;
      case 7:
        gameClass = StarWarsGame;
        break;
      case 8:
        gameClass = BetrayalGame;
        break;
      default:
        gameClass = PongGame;
    }

    // Initialize game
    const initGame = async () => {
      try {
        const game = new gameClass(ctx, size.width, size.height);
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

        // Initialize and start game
        await game.init();
        game.start();
      } catch (error) {
        console.error('Failed to initialize game:', error);
      }
    };

    initGame();

    const handleResize = () => {
      const { width, height } = applyCanvasSize();
      if (gameRef.current) {
        gameRef.current.resize(width, height);
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Touch/pointer controls
    const handlePointerDown = (e: PointerEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = 'touches' in e ? e.touches[0] : (e as PointerEvent);
      const x = (point.clientX - rect.left);
      const y = (point.clientY - rect.top);
      gameRef.current?.handlePointerDown?.(x, y);
    };
    const handlePointerMove = (e: PointerEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = 'touches' in e ? e.touches[0] : (e as PointerEvent);
      const x = (point.clientX - rect.left);
      const y = (point.clientY - rect.top);
      gameRef.current?.handlePointerMove?.(x, y);
    };
    const handlePointerUp = () => {
      gameRef.current?.handlePointerUp?.();
    };
    canvas.addEventListener('pointerdown', handlePointerDown as any, { passive: true });
    canvas.addEventListener('pointermove', handlePointerMove as any, { passive: true });
    window.addEventListener('pointerup', handlePointerUp as any, { passive: true });
    canvas.addEventListener('touchstart', handlePointerDown as any, { passive: true });
    canvas.addEventListener('touchmove', handlePointerMove as any, { passive: true });
    window.addEventListener('touchend', handlePointerUp as any, { passive: true });

    return () => {
      if (gameRef.current) {
        gameRef.current.stop();
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

  // React to settings changes like DPR scaling toggle
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe(() => {
      const canvas = canvasRef.current;
      const game = gameRef.current;
      if (!canvas || !game) return;
      const { width, height } = applyCanvasSize();
      game.resize(width, height);
    });
    return unsubscribe;
  }, [applyCanvasSize]);

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
