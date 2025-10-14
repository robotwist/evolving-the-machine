import React from 'react';
import { useGameStore } from '../lib/stores/useGameStore';

export function ControlsHelp() {
  const { currentStage } = useGameStore();

  return (
    <div className="absolute bottom-4 left-4 text-white text-xs bg-black/50 p-2 rounded">
      <div>Controls:</div>
      {currentStage === 1 && (
        <div>Player 1: W/S | Player 2: ↑/↓</div>
      )}
      {currentStage === 2 && (
        <div>Touch: Drag bottom to move | Keyboard: A/D | Ball auto‑shoot</div>
      )}
      {currentStage >= 3 && (
        <div>Touch: Left steer+thrust, Right tap shoot | Keyboard: WASD + Space</div>
      )}
    </div>
  );
}
