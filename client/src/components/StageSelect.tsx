import React from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { ACCENT_CLASSES, STAGES } from '../lib/stages';
import { Button } from './ui/button';
import { Lock } from 'lucide-react';

export function StageSelect() {
  const { setCurrentScreen, setCurrentStage, unlockedStages } = useGameStore();
  const { highScores } = useScoreStore();

  const handleStageSelect = (stageId: number) => {
    if (unlockedStages >= stageId) {
      setCurrentStage(stageId);
      setCurrentScreen('game');
    }
  };

  return (
    <div className="arcade-screen min-h-screen p-2 sm:p-4 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="arcade-title text-xl sm:text-2xl lg:text-3xl text-neon-magenta mb-3 sm:mb-4">Select Stage</h1>
          <p className="text-white/80 text-lg sm:text-xl px-2">
            Progress through evolution as you break through each barrier
          </p>
          <Button
            onClick={() => setCurrentScreen('menu')}
            variant="outline"
            size="sm"
            className="mt-3 sm:mt-4"
          >
            Back to Menu
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {STAGES.map((stage) => {
            const isUnlocked = unlockedStages >= stage.id;
            const highScore = highScores[stage.id];
            const accent = ACCENT_CLASSES[stage.accent];

            return (
              <div
                key={stage.id}
                className={`arcade-panel ${isUnlocked ? `${accent.panel} cursor-pointer transition-transform hover:-translate-y-1` : 'panel-dim cursor-not-allowed opacity-60'} p-4 flex flex-col`}
                onClick={() => handleStageSelect(stage.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleStageSelect(stage.id)}
                role="button"
                tabIndex={isUnlocked ? 0 : -1}
                aria-disabled={!isUnlocked}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`font-arcade text-lg ${isUnlocked ? accent.text : 'text-white/40'}`}>
                      {isUnlocked ? String(stage.id).padStart(2, '0') : <Lock size={16} />}
                    </span>
                    <h2 className="arcade-label text-white leading-relaxed truncate">{stage.name}</h2>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="arcade-label text-white/50">{stage.difficulty}</div>
                    {highScore ? <div className="arcade-label text-neon-yellow mt-1">Best {highScore}</div> : null}
                  </div>
                </div>
                <div className={`text-xl ${isUnlocked ? accent.text : 'text-white/40'}`}>{stage.culture}</div>
                <p className="text-white/70 text-lg leading-snug mb-4 line-clamp-3 flex-1">
                  {stage.description}
                </p>

                {isUnlocked ? (
                  <Button
                    variant={accent.button}
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStageSelect(stage.id);
                    }}
                  >
                    Play
                  </Button>
                ) : (
                  <div className="arcade-label text-center text-white/40">Locked</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
