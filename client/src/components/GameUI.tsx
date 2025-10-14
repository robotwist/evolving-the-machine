import React, { useEffect } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useTutorialStore } from '../lib/stores/useTutorialStore';
import { TopHUD } from './TopHUD';
import { PerformanceMonitor } from './PerformanceMonitor';
import { GameModals } from './GameModals';
import { ControlsHelp } from './ControlsHelp';
import { TutorialOverlay } from './TutorialOverlay';

export function GameUI() {
  const { gameState, currentStage } = useGameStore();
  const { maybeShow } = useTutorialStore();
  const stageKey = (Math.min(Math.max(currentStage, 1), 5)) as 1 | 2 | 3 | 4 | 5;

  useEffect(() => {
    if (gameState === 'playing') {
      maybeShow(stageKey);
    }
  }, [gameState, stageKey, maybeShow]);

  return (
    <>
      <TopHUD />
      <PerformanceMonitor />
      <GameModals />
      <ControlsHelp />
      <TutorialOverlay />
    </>
  );
}
