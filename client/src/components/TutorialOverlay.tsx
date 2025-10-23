import React from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useTutorialStore } from '../lib/stores/useTutorialStore';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';

const tutorials = {
  1: {
    title: 'Pong — Quick Tutorial',
    text: 'Drag on the left to move. Collect powerups. Missile/Fire shots pierce the AI paddle.',
  },
  2: {
    title: 'Breakout — Quick Tutorial',
    text: 'Drag near the bottom to move the paddle. Clear blocks; lives are generous; evolve mid‑level.',
  },
  3: {
    title: 'Asteroids — Quick Tutorial',
    text: 'Left touch steers and thrusts toward your touch. Tap right side to shoot. Avoid collisions.',
  },
  4: {
    title: 'Defender — Quick Tutorial',
    text: 'Move, jump, and shoot to protect civilians. Watch for enemy bullets; settings can reduce motion.',
  },
  5: {
    title: 'Lasat Starfighter — Quick Tutorial',
    text: 'WASD or touch to move; Space to fire; use abilities when charged. Target key structures.',
  },
};

export function TutorialOverlay() {
  const { currentStage } = useGameStore();
  const { show, markSeen, hide } = useTutorialStore();
  const stageKey = (Math.min(Math.max(currentStage, 1), 5)) as keyof typeof tutorials;

  const tutorial = tutorials[stageKey];

  if (!show[stageKey] || !tutorial) return null;

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center" onClick={() => markSeen(stageKey)} onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? markSeen(stageKey) : undefined} role="button" tabIndex={0}>
      <Card className="bg-black/90 border-white/20 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-6 text-white text-center">
          <div className="text-xl font-bold mb-2">{tutorial.title}</div>
          <div className="text-sm mb-4">{tutorial.text}</div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => markSeen(stageKey)}>Got it</Button>
          <div>
            <Button variant="outline" className="mt-2 border-white/20 text-white" onClick={() => hide(stageKey)}>Hide for now</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
