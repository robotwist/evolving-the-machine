import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useIsMobile } from '../hooks/use-is-mobile';
import { MobileControlsManager } from '../lib/controls/MobileControls';

interface MobileGameUIProps {
  currentGame: string;
  stage: number;
  gameState: 'playing' | 'paused' | 'ended' | 'stage-complete';
  onGameComplete: () => void;
  onScoreUpdate: (_score: number) => void;
}

export function MobileGameUI({
  currentGame,
  stage,
  gameState,
  onGameComplete: _onGameComplete,
  onScoreUpdate: _onScoreUpdate
}: MobileGameUIProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<MobileControlsManager | null>(null);
  const { setGameState } = useGameStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!canvasRef.current || !isMobile) return;

    // Initialize mobile controls
    controlsRef.current = new MobileControlsManager(canvasRef.current, {
      onMove: (x, y) => {
        // Handle movement input
        if (window.gameInstance) {
          window.gameInstance.handleMobileMove?.(x, y);
        }
      },
      onShoot: (x, y) => {
        // Handle shooting input
        if (window.gameInstance) {
          window.gameInstance.handleMobileShoot?.(x, y);
        }
      },
      onPause: () => {
        setGameState(gameState === 'paused' ? 'playing' : 'paused');
      },
      onAction: () => {
        // Handle primary action (varies by game)
        if (window.gameInstance) {
          window.gameInstance.handleMobileAction?.();
        }
      }
    });

    return () => {
      controlsRef.current?.destroy();
      controlsRef.current = null;
    };
  }, [isMobile, setGameState, gameState]);

  if (!isMobile) {
    return null; // Don't render mobile UI on desktop
  }

  return (
    <div className="relative w-full h-full">
      {/* Mobile-optimized canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none"
        style={{
          maxHeight: '70vh', // Leave room for controls
          aspectRatio: '4/3',
          background: '#000'
        }}
      />

      {/* Mobile control overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Left stick area indicator (visual feedback) */}
        <div
          className="absolute border-2 border-blue-400/30 rounded-full pointer-events-none"
          style={{
            left: '5%',
            bottom: '15%',
            width: '80px',
            height: '80px'
          }}
        >
          <div className="absolute inset-2 border border-blue-400/20 rounded-full"></div>
        </div>

        {/* Right stick area indicator */}
        <div
          className="absolute border-2 border-red-400/30 rounded-full pointer-events-none"
          style={{
            right: '5%',
            bottom: '15%',
            width: '80px',
            height: '80px'
          }}
        >
          <div className="absolute inset-2 border border-red-400/20 rounded-full"></div>
        </div>

        {/* Action button indicator */}
        <div
          className="absolute border-2 border-green-400/30 rounded-full pointer-events-none"
          style={{
            right: '5%',
            top: '5%',
            width: '60px',
            height: '60px'
          }}
        >
          <div className="absolute inset-2 border border-green-400/20 rounded-full flex items-center justify-center">
            <span className="text-green-400 text-xs font-bold">⚡</span>
          </div>
        </div>

        {/* Pause button indicator */}
        <div
          className="absolute border-2 border-yellow-400/30 rounded pointer-events-none"
          style={{
            left: '5%',
            top: '5%',
            width: '50px',
            height: '50px'
          }}
        >
          <div className="absolute inset-2 border border-yellow-400/20 rounded flex items-center justify-center">
            <span className="text-yellow-400 text-xs font-bold">⏸</span>
          </div>
        </div>
      </div>

      {/* Mobile status bar */}
      <div className="absolute top-0 left-0 right-0 bg-black/80 text-white text-xs p-2 flex justify-between items-center">
        <span>Stage {stage} • {currentGame}</span>
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${gameState === 'playing' ? 'bg-green-400' : 'bg-red-400'}`}></span>
          {gameState}
        </span>
      </div>

      {/* Touch instruction overlay (shows briefly) */}
      {gameState === 'playing' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none animate-pulse">
          <div className="text-white text-center p-4">
            <div className="text-lg mb-2">👆 Touch Controls Active</div>
            <div className="text-sm opacity-75">
              Left: Move • Right: Aim • Top Right: Shoot • Top Left: Pause
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
