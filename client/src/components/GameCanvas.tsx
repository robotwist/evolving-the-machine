import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { PongGame } from '../lib/games/PongGame';
import { BreakoutGame } from '../lib/games/BreakoutGame';
import { AsteroidsGame } from '../lib/games/AsteroidsGame';
import { DefenderGame } from '../lib/games/DefenderGame';
import { LasatGame } from '../lib/games/LasatGame';
import { DanceInterlude } from '../lib/games/DanceInterlude';
import { BetrayalGame } from '../lib/games/BetrayalGame';
import { BaseGame } from '../lib/games/BaseGame';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<BaseGame | null>(null);
  const { currentStage, gameState, setGameState } = useGameStore();
  const { updateScore } = useScoreStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1024;
    canvas.height = 768;

    // Create game instance based on current stage
    let game: BaseGame;
    switch (currentStage) {
      case 1:
        game = new PongGame(ctx, canvas.width, canvas.height);
        break;
      case 2:
        game = new BreakoutGame(ctx, canvas.width, canvas.height);
        break;
      case 3:
        game = new AsteroidsGame(ctx, canvas.width, canvas.height);
        break;
      case 4:
        game = new DefenderGame(ctx, canvas.width, canvas.height);
        break;
      case 5:
        game = new LasatGame(ctx, canvas.width, canvas.height);
        break;
      case 6:
        game = new DanceInterlude(ctx, canvas.width, canvas.height);
        break;
      case 7:
        game = new BetrayalGame(ctx, canvas.width, canvas.height);
        break;
      default:
        game = new PongGame(ctx, canvas.width, canvas.height);
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

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
      }
    };
  }, [currentStage, updateScore, setGameState]);

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
        maxWidth: '100vw',
        maxHeight: '100vh',
        objectFit: 'contain'
      }}
    />
  );
}
