import React from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { Button } from './ui/button';
import { useAudio } from '../lib/stores/useAudio';

const stageNames: { [key: number]: string } = {
  1: 'Pong Master',
  2: 'Temple Breaker',
  3: 'Asteroid Hunter',
  4: 'Defender',
  5: 'Lasat Starfighter',
  6: 'Dance Interlude',
  7: 'Star Wars Battle',
  8: 'The Betrayal',
};

export function TopHUD() {
  const { currentStage, gameState, setGameState } = useGameStore();
  const { scores, highScores } = useScoreStore();
  const { isMuted, toggleMute } = useAudio();

  const handlePause = () => {
    setGameState(gameState === 'paused' ? 'playing' : 'paused');
  };

  const stageName = stageNames[currentStage] || 'Unknown';

  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
      <div className="text-white">
        <div className="text-xl font-bold">{stageName}</div>
        <div className="text-sm">Score: {scores[currentStage] || 0}</div>
        <div className="text-xs">Best: {highScores[currentStage] || 0}</div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          className="bg-black/50 text-white border-white/20"
        >
          {isMuted ? 'Mute' : 'Sound On'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePause}
          aria-label={gameState === 'paused' ? 'Resume game' : 'Pause game'}
          className="bg-black/50 text-white border-white/20"
        >
          {gameState === 'paused' ? 'Resume' : 'Pause'}
        </Button>
      </div>
    </div>
  );
}
