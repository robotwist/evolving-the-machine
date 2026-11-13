import React from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { toTutorialStage, useTutorialStore, type StageId } from '../lib/stores/useTutorialStore';
import { ACCENT_CLASSES, getStage } from '../lib/stages';
import { Button } from './ui/button';

const tutorials: Record<StageId, string> = {
  1: 'Drag on the left to move. Hit the ball with your paddle’s edge to angle it past the AI. First to 5 wins; fire and missile balls pierce the AI paddle.',
  2: 'Drag near the bottom to move the paddle. Angle your hits toward the remaining blocks; clear 70% of the wall to evolve and punch your way through the rest.',
  3: 'Left touch steers and thrusts toward your touch. Tap right side to shoot. Avoid collisions.',
  4: 'Move, jump, and shoot to protect civilians. When a bomber flashes and marks the ground, get off the marker before it dives, or shoot it down.',
  5: 'WASD or touch to move; Space to fire; use abilities when charged. Target key structures.',
  6: 'Tap the glowing targets on the beat to build your combo. Press Space to skip the dance.',
  7: 'W/S to thrust, A/D to rotate, Space to fire. Ships glow red before they shoot. Then break the command vessel’s weak points; they take many hits.',
  8: 'A/D to rotate, W to thrust, Space to fire. When the laser’s aim line appears, get clear before it fires. The AI can’t be hurt while it escapes.',
};

export function TutorialOverlay() {
  const { currentStage } = useGameStore();
  const { show, markSeen, hide } = useTutorialStore();
  const stageKey = toTutorialStage(currentStage);

  const text = tutorials[stageKey];
  const stage = getStage(stageKey);
  const accent = stage ? ACCENT_CLASSES[stage.accent] : ACCENT_CLASSES.cyan;

  if (!show[stageKey] || !text) return null;

  return (
    <div className="absolute inset-0 bg-black/75 flex items-center justify-center" onClick={() => markSeen(stageKey)} onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? markSeen(stageKey) : undefined} role="button" tabIndex={0}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={`arcade-panel ${accent.panel} max-w-md mx-4 p-6 text-white text-center`} onClick={(e) => e.stopPropagation()}>
        <div className="arcade-label text-white/60 mb-2">How to Play</div>
        <h2 className={`arcade-title text-base mb-4 ${accent.text}`}>{stage?.name}</h2>
        <p className="text-xl leading-snug mb-6">{text}</p>
        <div className="flex flex-col gap-3">
          <Button variant={accent.button} onClick={() => markSeen(stageKey)}>Got it</Button>
          <Button variant="outline" size="sm" onClick={() => hide(stageKey)}>Hide for now</Button>
        </div>
      </div>
    </div>
  );
}
