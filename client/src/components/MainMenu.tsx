import React from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { ACCENT_CLASSES, STAGES } from '../lib/stages';
import { Button } from './ui/button';

const MENU_STAGES = STAGES.slice(0, 5);

const ERAS = [
  { title: 'Classic Arena', text: 'Master competitive mechanics', className: 'text-neon-cyan' },
  { title: 'Stellar Navigation', text: 'Navigate by celestial knowledge', className: 'text-neon-green' },
  { title: 'Guardian Protocol', text: 'Protect with honor and skill', className: 'text-neon-red' },
  { title: 'Final Evolution', text: 'Epic battles in the void', className: 'text-neon-magenta' },
];

export function MainMenu() {
  const { setCurrentScreen, unlockAllLevels } = useGameStore();
  const { highScores } = useScoreStore();

  return (
    <div className="arcade-screen flex flex-col items-center justify-center min-h-screen p-4 overflow-y-auto">
      <div className="text-center mb-8 select-none">
        <div className="arcade-label text-white/50 mb-3">System Online</div>
        <GlitchTitle text="CULTURAL ARCADE EVOLUTION" />
        <p className="text-xl text-white/80 mt-4">
          Journey through gaming history while discovering world cultures
        </p>
        <div className="arcade-label text-neon-yellow mt-4 arcade-blink">Press Start</div>
      </div>

      <div className="arcade-panel w-full max-w-4xl p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {MENU_STAGES.map(stage => {
            const accent = ACCENT_CLASSES[stage.accent];
            return (
              <div key={stage.id} className="text-center">
                <div className={`arcade-panel ${accent.panel} w-14 h-14 mx-auto mb-3 flex items-center justify-center`}>
                  <span className={`font-arcade text-xl ${accent.text}`}>{stage.id}</span>
                </div>
                <div className="arcade-label text-white leading-relaxed">{stage.name}</div>
                <div className={`text-lg ${accent.text}`}>{stage.culture}</div>
                <div className="text-base text-white/60">{stage.tagline}</div>
                {highScores[stage.id] ? (
                  <div className="arcade-label text-neon-yellow mt-1">Best {highScores[stage.id]}</div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" onClick={() => setCurrentScreen('stage-select')}>
            Start Journey
          </Button>
          <Button size="lg" variant="outline">
            How to Play
          </Button>
          <Button size="lg" variant="success" onClick={() => unlockAllLevels()}>
            Unlock All Levels
          </Button>
        </div>

        <div className="arcade-panel panel-dim p-4">
          <h3 className="arcade-label text-white mb-3">Evolve Through Play</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-lg">
            {ERAS.map(era => (
              <div key={era.title}>
                <div className={era.className}>{era.title}</div>
                <div className="text-white/70">{era.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GlitchTitle({ text }: { text: string }) {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setStep(i);
      if (i > text.length + 8) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [text]);
  const shown = Math.min(step, text.length);
  const visible = text.slice(0, shown);
  const noise = '!@#$%^&*()_+=-{}[]<>/\\'.charAt(step % 24);
  const tail = step < text.length ? noise : '';
  return (
    <h1 className="arcade-title text-2xl md:text-4xl text-neon-cyan">
      <span>{visible}</span>
      <span className="text-white/30">{tail}</span>
    </h1>
  );
}
