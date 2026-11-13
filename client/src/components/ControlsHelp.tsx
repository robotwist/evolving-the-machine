import React from 'react';
import { useGameStore } from '../lib/stores/useGameStore';

const controlsByStage: Record<number, string> = {
  1: 'W/S/A/D move paddle | Z/X fire lasers (powerup) | Touch: drag on the left',
  2: 'A/D or ←/→ move | After evolving: WASD + Z/X punch | Touch: drag near the bottom',
  3: 'W thrust, A/D rotate, Space shoot | Touch: left steers, right taps shoot',
  4: 'A/D move, W jump + fire up, Space shoot, X shoot up | Touch: tap left/right to move',
  5: 'WASD move, Space fire, X ion, C missiles, Z death blossom',
  6: 'Tap the targets on the beat | Space skips',
  7: 'W/S thrust, A/D rotate, Space fire | Touch: left drags, right taps fire',
  8: 'WASD move, Space fire | Touch: tap to shoot, drag to steer',
};

export function ControlsHelp() {
  const { currentStage } = useGameStore();
  const controls = controlsByStage[currentStage];
  if (!controls) return null;

  return (
    <div className="absolute bottom-4 left-4 text-white text-xs bg-black/50 p-2 rounded">
      <div>Controls:</div>
      <div>{controls}</div>
    </div>
  );
}
