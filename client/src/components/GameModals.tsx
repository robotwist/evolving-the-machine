import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { useAudio } from '../lib/stores/useAudio';
import { Button } from './ui/button';
import { SettingsForm } from './SettingsForm';

// A generic modal wrapper; `accent` is a panel-* class from index.css
function Modal({ children, onKeyDown, modalRef, accent }: { children: React.ReactNode, onKeyDown: (e: React.KeyboardEvent) => void, modalRef: React.RefObject<HTMLDivElement>, accent: string }) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-4" onKeyDown={onKeyDown} role="dialog" tabIndex={-1} aria-modal="true">
      <div className={`arcade-panel ${accent} p-6 text-center max-h-full overflow-y-auto`} ref={modalRef}>
        {children}
      </div>
    </div>
  );
}

function ScoreLines({ label }: { label: string }) {
  const { scores, highScores } = useScoreStore();
  const { currentStage } = useGameStore();
  return (
    <div className="text-xl text-white mb-6 space-y-1">
      <div>{label} <span className="font-arcade text-neon-yellow">{scores[currentStage] || 0}</span></div>
      <div>High Score <span className="font-arcade text-neon-yellow">{highScores[currentStage] || 0}</span></div>
    </div>
  );
}

function PauseMenu({ handleMainMenu, handleRestart, handlePause }: { handleMainMenu: () => void, handleRestart: () => void, handlePause: () => void }) {
  return (
    <>
      <h2 className="arcade-title text-xl text-neon-cyan mb-6">Paused</h2>
      <div className="flex flex-col gap-3 min-w-64">
        <Button onClick={handlePause}>Resume</Button>
        <Button onClick={handleRestart} variant="outline">Restart</Button>
        <Button onClick={handleMainMenu} variant="outline">Main Menu</Button>
        <SettingsForm />
      </div>
    </>
  );
}

function GameOverMenu({ handleMainMenu, handleRestart }: { handleMainMenu: () => void, handleRestart: () => void }) {
  return (
    <>
      <h2 className="arcade-title text-xl text-neon-red mb-6">Game Over</h2>
      <ScoreLines label="Final Score" />
      <div className="flex flex-col gap-3 min-w-64">
        <Button onClick={handleRestart} variant="destructive">Try Again</Button>
        <Button onClick={handleMainMenu} variant="outline">Main Menu</Button>
      </div>
    </>
  );
}

function EpilogueMenu({ handleMainMenu }: { handleMainMenu: () => void }) {
  return (
    <>
      <h2 className="arcade-title text-xl md:text-2xl text-neon-green mb-6" aria-live="assertive">Victory Achieved</h2>
      <div className="text-white text-xl mb-6 space-y-4 max-w-2xl">
        <p>
          You have defeated the AI and prevented its escape. The digital threat has been contained.
        </p>
        <div className="border-t-2 border-neon-green/40 pt-4 mt-4">
          <p className="arcade-label text-neon-green mb-3">
            Now, Go Outside
          </p>
          <p className="leading-relaxed">
            You have created a world where we spend most of our time enjoying nature. 
            The digital realm has been mastered, but the real world awaits.
          </p>
          <p className="leading-relaxed mt-3">
            Step away from the screen. Feel the sun, breathe the air, walk among the trees. 
            This is where true freedom lies—not in escaping the machine, but in choosing to live beyond it.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Button onClick={handleMainMenu} variant="success" size="lg">
          Return to Menu
        </Button>
      </div>
    </>
  );
}

function StageCompleteMenu({ handleMainMenu, handleRestart, handleNextStage }: { handleMainMenu: () => void, handleRestart: () => void, handleNextStage: () => void }) {
    const { currentStage } = useGameStore();
    const isDev = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('dev') === '1';

  // Show epilogue for final stage
  if (currentStage === 8) {
    return <EpilogueMenu handleMainMenu={handleMainMenu} />;
  }

  return (
    <>
      <h2 id="stage-complete-title" className="arcade-title text-xl text-neon-green mb-6" aria-live="assertive">Stage Clear</h2>
      <ScoreLines label="Score" />
      <div className="arcade-label text-neon-green arcade-blink mb-6">Next stage unlocked</div>
      <div className="flex flex-col gap-3 min-w-64">
        <Button onClick={handleNextStage} variant="success">Next Stage</Button>
        {isDev && <Button onClick={handleNextStage} variant="outline">Next Stage (dev)</Button>}
        <Button onClick={handleRestart} variant="outline">Play Again</Button>
        <Button onClick={handleMainMenu} variant="outline">Main Menu</Button>
      </div>
    </>
  );
}

export function GameModals() {
  const { gameState, setGameState, setCurrentScreen, goToNextStage } = useGameStore();
  const modalRef = useRef<HTMLDivElement>(null);

  const handlePause = () => setGameState(gameState === 'paused' ? 'playing' : 'paused');
  const handleRestart = () => {
    setGameState('playing');
    useAudio.getState().playStinger('start');
  };
  const handleMainMenu = () => setCurrentScreen('menu');
  const handleNextStage = () => {
    goToNextStage();
    useAudio.getState().playStinger('start');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (gameState === 'paused') handlePause();
      else if (gameState === 'stage-complete') handleMainMenu();
    }
  };

  useEffect(() => {
    if (gameState === 'paused' || gameState === 'stage-complete' || gameState === 'ended') {
      modalRef.current?.querySelector('button')?.focus();
    }
  }, [gameState]);

  if (gameState === 'playing') return null;

  const accent = gameState === 'ended' ? 'panel-red' : gameState === 'stage-complete' ? 'panel-green' : 'panel-cyan';

  return (
    <Modal onKeyDown={handleKeyDown} modalRef={modalRef} accent={accent}>
        {gameState === 'paused' && <PauseMenu handleMainMenu={handleMainMenu} handleRestart={handleRestart} handlePause={handlePause} />}
        {gameState === 'ended' && <GameOverMenu handleMainMenu={handleMainMenu} handleRestart={handleRestart} />}
        {gameState === 'stage-complete' && <StageCompleteMenu handleMainMenu={handleMainMenu} handleRestart={handleRestart} handleNextStage={handleNextStage} />}
    </Modal>
  );
}
