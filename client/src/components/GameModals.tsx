import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { useAudio } from '../lib/stores/useAudio';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { SettingsForm } from './SettingsForm';

// A generic modal wrapper
function Modal({ children, onKeyDown, modalRef, className }: { children: React.ReactNode, onKeyDown: (e: React.KeyboardEvent) => void, modalRef: React.RefObject<HTMLDivElement>, className?: string }) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center" onKeyDown={onKeyDown} role="dialog" tabIndex={-1} aria-modal="true">
      <Card className={`bg-black/90 border-white/20 ${className}`} ref={modalRef}>
        <CardContent className="p-6 text-center">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function PauseMenu({ handleMainMenu, handleRestart, handlePause }: { handleMainMenu: () => void, handleRestart: () => void, handlePause: () => void }) {
  return (
    <>
      <h2 className="text-2xl font-bold text-white mb-4">Game Paused</h2>
      <div className="flex flex-col gap-2">
        <Button onClick={handlePause} className="bg-blue-600 hover:bg-blue-700">Resume</Button>
        <Button onClick={handleRestart} variant="outline" className="border-white/20 text-white">Restart</Button>
        <Button onClick={handleMainMenu} variant="outline" className="border-white/20 text-white">Main Menu</Button>
        <SettingsForm />
      </div>
    </>
  );
}

function GameOverMenu({ handleMainMenu, handleRestart }: { handleMainMenu: () => void, handleRestart: () => void }) {
    const { scores, highScores } = useScoreStore();
    const { currentStage } = useGameStore();
  return (
    <>
      <h2 className="text-2xl font-bold text-white mb-4">Game Over</h2>
      <div className="text-white mb-4">
        <div>Final Score: {scores[currentStage] || 0}</div>
        <div>High Score: {highScores[currentStage] || 0}</div>
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={handleRestart} className="bg-red-600 hover:bg-red-700">Try Again</Button>
        <Button onClick={handleMainMenu} variant="outline" className="border-white/20 text-white">Main Menu</Button>
      </div>
    </>
  );
}

function StageCompleteMenu({ handleMainMenu, handleRestart, handleNextStage }: { handleMainMenu: () => void, handleRestart: () => void, handleNextStage: () => void }) {
    const { scores, highScores } = useScoreStore();
    const { currentStage } = useGameStore();
    const isDev = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('dev') === '1';

  return (
    <>
      <h2 id="stage-complete-title" className="text-2xl font-bold text-white mb-4" aria-live="assertive">Stage Complete!</h2>
      <div className="text-white mb-4">
        <div>Score: {scores[currentStage] || 0}</div>
        <div>High Score: {highScores[currentStage] || 0}</div>
        {currentStage < 8 && <div className="text-green-300 mt-2">Next stage unlocked!</div>}
      </div>
      <div className="flex flex-col gap-2">
        {currentStage < 8 ? (
          <Button onClick={handleNextStage} className="bg-green-600 hover:bg-green-700">Next Stage</Button>
        ) : (
          <div className="text-gold-400 mb-2">Congratulations! You&apos;ve mastered all cultures!</div>
        )}
        {isDev && <Button onClick={handleNextStage} variant="outline" className="border-white/20 text-white">Next Stage (dev)</Button>}
        <Button onClick={handleRestart} variant="outline" className="border-white/20 text-white">Play Again</Button>
        <Button onClick={handleMainMenu} variant="outline" className="border-white/20 text-white">Main Menu</Button>
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

  return (
    <Modal onKeyDown={handleKeyDown} modalRef={modalRef} className={
        gameState === 'ended' ? 'bg-red-900/90 border-red-500/20' : 
        gameState === 'stage-complete' ? 'bg-green-900/90 border-green-500/20' : ''
    }>
        {gameState === 'paused' && <PauseMenu handleMainMenu={handleMainMenu} handleRestart={handleRestart} handlePause={handlePause} />}
        {gameState === 'ended' && <GameOverMenu handleMainMenu={handleMainMenu} handleRestart={handleRestart} />}
        {gameState === 'stage-complete' && <StageCompleteMenu handleMainMenu={handleMainMenu} handleRestart={handleRestart} handleNextStage={handleNextStage} />}
    </Modal>
  );
}
