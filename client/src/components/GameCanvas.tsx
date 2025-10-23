import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { BaseGame } from '../lib/games/BaseGame';
import { useSettingsStore } from '../lib/stores/useSettingsStore';
import { assetLoader } from '../lib/utils/AssetLoader';

// Lazy load game classes for code splitting
const loadGame = async (stage: number): Promise<new (ctx: CanvasRenderingContext2D, width: number, height: number) => BaseGame> => {
  switch (stage) {
    case 1: {
      const { PongGame } = await import('../lib/games/PongGame');
      return PongGame;
    }
    case 2: {
      const { BreakoutGame } = await import('../lib/games/BreakoutGame');
      return BreakoutGame;
    }
    case 3: {
      const { AsteroidsGame } = await import('../lib/games/AsteroidsGame');
      return AsteroidsGame;
    }
    case 4: {
      const { DefenderGame } = await import('../lib/games/DefenderGame');
      return DefenderGame;
    }
    case 5: {
      const { LasatGame } = await import('../lib/games/LasatGame');
      return LasatGame;
    }
    case 6: {
      const { DanceInterlude } = await import('../lib/games/DanceInterlude');
      return DanceInterlude;
    }
    case 7: {
      const { StarWarsGame } = await import('../lib/games/StarWarsGame');
      return StarWarsGame;
    }
    case 8: {
      const { BetrayalGame } = await import('../lib/games/BetrayalGame');
      return BetrayalGame;
    }
    default: {
      const { PongGame: DefaultGame } = await import('../lib/games/PongGame');
      return DefaultGame;
    }
  }
};

// Custom hook for managing the game instance lifecycle
function useGameInstance(
  ctx: CanvasRenderingContext2D | null,
  width: number,
  height: number
) {
  const gameRef = useRef<BaseGame | null>(null);
  const { currentStage, setGameState } = useGameStore();
  const { updateScore } = useScoreStore();
  const isInitializing = useRef(false);

  useEffect(() => {
    if (!ctx || width === 0 || height === 0) return;
    if (isInitializing.current) return; // Prevent double initialization

    isInitializing.current = true;
    console.log(`🎮 Initializing game for stage ${currentStage}`);

    // Clear canvas before creating new game to prevent white screen
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Preload assets for this stage
    assetLoader.preloadStageAssets(currentStage)
      .then(() => console.log(`🎨 Stage ${currentStage} assets ready`))
      .catch(error => console.warn(`⚠️ Failed to preload stage ${currentStage} assets:`, error));

    // Load and create game instance dynamically
    loadGame(currentStage)
      .then((gameClass) => {
        const game = new gameClass(ctx, width, height);
        gameRef.current = game;

        game.onScoreUpdate = (score: number) => updateScore(currentStage, score);
        game.onGameOver = () => setGameState('ended');
        game.onStageComplete = () => {
          setGameState('stage-complete');
          useGameStore.getState().unlockNextStage();
        };

        // Initialize game asynchronously
        return Promise.resolve(game.init())
          .then(() => {
            console.log(`✅ Game initialized for stage ${currentStage}`);
            game.start();
            isInitializing.current = false;
          })
          .catch((error: Error) => {
            console.error(`❌ Failed to initialize game for stage ${currentStage}:`, error);
            isInitializing.current = false;
            throw error;
          });
      })
      .catch((error: Error) => {
        console.error(`❌ Failed to load game class for stage ${currentStage}:`, error);
        isInitializing.current = false;
      });

    return () => {
      console.log(`🧹 Cleaning up game for stage ${currentStage}`);
      gameRef.current?.destroy();
      gameRef.current = null;
      isInitializing.current = false;
    };
  }, [currentStage, ctx, width, height, updateScore, setGameState]);

  return gameRef;
}

// Custom hook for managing canvas event listeners
function useCanvasEvents(
  canvas: HTMLCanvasElement | null,
  gameRef: React.RefObject<BaseGame | null>
) {
  useEffect(() => {
    if (!canvas) return;

    const handlePointerDown = (e: PointerEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = 'touches' in e ? e.touches[0] : (e as PointerEvent);
      const x = point.clientX - rect.left;
      const y = point.clientY - rect.top;
      gameRef.current?.handlePointerDown?.(x, y);
    };

    const handlePointerMove = (e: PointerEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = 'touches' in e ? e.touches[0] : (e as PointerEvent);
      const x = point.clientX - rect.left;
      const y = point.clientY - rect.top;
      gameRef.current?.handlePointerMove?.(x, y);
    };

    const handlePointerUp = () => {
      gameRef.current?.handlePointerUp?.();
    };
    
    // Add event listeners
    canvas.addEventListener('pointerdown', handlePointerDown as EventListener);
    canvas.addEventListener('pointermove', handlePointerMove as EventListener);
    window.addEventListener('pointerup', handlePointerUp as EventListener);
    canvas.addEventListener('touchstart', handlePointerDown as EventListener, { passive: true });
    canvas.addEventListener('touchmove', handlePointerMove as EventListener, { passive: true });
    window.addEventListener('touchend', handlePointerUp as EventListener);

    return () => {
      // Remove event listeners
      canvas.removeEventListener('pointerdown', handlePointerDown as EventListener);
      canvas.removeEventListener('pointermove', handlePointerMove as EventListener);
      window.removeEventListener('pointerup', handlePointerUp as EventListener);
      canvas.removeEventListener('touchstart', handlePointerDown as EventListener);
      canvas.removeEventListener('touchmove', handlePointerMove as EventListener);
      window.removeEventListener('touchend', handlePointerUp as EventListener);
    };
  }, [canvas, gameRef]);
}


export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const { gameState } = useGameStore();

  const applyCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { width: 0, height: 0 };
    const { innerWidth, innerHeight } = window;
    const dprEnabled = useSettingsStore.getState().enableDprScaling;
    const dpr = dprEnabled ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    const cssWidth = innerWidth;
    const cssHeight = innerHeight;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const context = canvas.getContext('2d');
    if (context) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(dpr, dpr);
    }
    setCtx(context);
    setCanvasSize({ width: cssWidth, height: cssHeight });
    return { width: cssWidth, height: cssHeight };
  }, []);
  
  const gameRef = useGameInstance(ctx, canvasSize.width, canvasSize.height);
  useCanvasEvents(canvasRef.current, gameRef);

  useEffect(() => {
    applyCanvasSize();
    window.addEventListener('resize', applyCanvasSize);
    window.addEventListener('orientationchange', applyCanvasSize);

    return () => {
      window.removeEventListener('resize', applyCanvasSize);
      window.removeEventListener('orientationchange', applyCanvasSize);
    };
  }, [applyCanvasSize]);
  
  // React to settings changes like DPR scaling toggle
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe(applyCanvasSize);
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
  }, [gameState, gameRef]);

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
