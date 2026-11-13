import React from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { Button } from './ui/button';
import { useAudio } from '../lib/stores/useAudio';
import { ACCENT_CLASSES, getStage } from '../lib/stages';

export function TopHUD() {
  const { currentStage, gameState, setGameState } = useGameStore();
  const { scores, highScores } = useScoreStore();
  const { isMuted, toggleMute } = useAudio();

  const handlePause = () => {
    setGameState(gameState === 'paused' ? 'playing' : 'paused');
  };

  const stage = getStage(currentStage);
  const accentText = stage ? ACCENT_CLASSES[stage.accent].text : 'text-white';

  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
      <div className="space-y-1">
        <div className={`arcade-title text-sm ${accentText}`}>{stage?.name ?? 'Unknown'}</div>
        <div className="arcade-label text-white">Score {scores[currentStage] || 0}</div>
        <div className="arcade-label text-neon-yellow">Best {highScores[currentStage] || 0}</div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
        >
          {isMuted ? 'Sound Off' : 'Sound On'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePause}
          aria-label={gameState === 'paused' ? 'Resume game' : 'Pause game'}
        >
          {gameState === 'paused' ? 'Resume' : 'Pause'}
        </Button>
      </div>
    </div>
  );
}
