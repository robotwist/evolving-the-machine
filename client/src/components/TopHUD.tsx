import React, { useEffect, useState } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { Button } from './ui/button';
import { useAudio } from '../lib/stores/useAudio';
import { ACCENT_CLASSES, getStage } from '../lib/stages';
import type { BaseGame, HudStat } from '../lib/games/BaseGame';

const HUD_POLL_MS = 150;

const TONE_TEXT: Record<NonNullable<HudStat['tone']>, string> = {
  normal: 'text-white',
  warning: 'text-neon-yellow',
  danger: 'text-neon-red arcade-blink',
};

function meterColor(fraction: number): string {
  if (fraction > 0.6) return 'bg-neon-green';
  if (fraction > 0.3) return 'bg-neon-yellow';
  return 'bg-neon-red';
}

/** Polls the running game for its HUD stats; games update them every frame on the canvas side. */
function useHudStats(): HudStat[] {
  const [stats, setStats] = useState<HudStat[]>([]);
  useEffect(() => {
    let lastJson = '';
    const id = setInterval(() => {
      const game = (window as unknown as { gameInstance?: BaseGame }).gameInstance;
      const next = game?.getHudStats?.() ?? [];
      const json = JSON.stringify(next);
      if (json !== lastJson) {
        lastJson = json;
        setStats(next);
      }
    }, HUD_POLL_MS);
    return () => clearInterval(id);
  }, []);
  return stats;
}

function HudStatRow({ stat }: { stat: HudStat }) {
  const toneClass = TONE_TEXT[stat.tone ?? 'normal'];
  if (stat.meter) {
    const fraction = stat.meter.max > 0 ? Math.max(0, Math.min(1, stat.meter.value / stat.meter.max)) : 0;
    return (
      <div className="flex items-center gap-2">
        <span className={`arcade-label w-16 ${toneClass}`}>{stat.label}</span>
        <div className="w-28 h-2.5 border-2 border-white/60 bg-black">
          <div className={`h-full ${meterColor(fraction)}`} style={{ width: `${fraction * 100}%` }} />
        </div>
      </div>
    );
  }
  return <div className={`arcade-label ${toneClass}`}>{stat.label} {stat.value}</div>;
}

export function TopHUD() {
  const { currentStage, gameState, setGameState } = useGameStore();
  const { scores, highScores } = useScoreStore();
  const { isMuted, toggleMute } = useAudio();
  const stats = useHudStats();

  const handlePause = () => {
    setGameState(gameState === 'paused' ? 'playing' : 'paused');
  };

  const stage = getStage(currentStage);
  const accentText = stage ? ACCENT_CLASSES[stage.accent].text : 'text-white';

  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
      <div className="space-y-1.5">
        <div className={`arcade-title text-sm ${accentText}`}>{stage?.name ?? 'Unknown'}</div>
        <div className="arcade-label text-white">Score {scores[currentStage] || 0}</div>
        <div className="arcade-label text-neon-yellow">Best {highScores[currentStage] || 0}</div>
        {stats.map(stat => <HudStatRow key={stat.label} stat={stat} />)}
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
