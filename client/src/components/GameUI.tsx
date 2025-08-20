import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { useAudio } from '../lib/stores/useAudio';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { useSettingsStore } from '../lib/stores/useSettingsStore';
import { useTutorialStore } from '../lib/stores/useTutorialStore';

export function GameUI() {
  const { 
    currentStage, 
    gameState, 
    setGameState, 
    setCurrentScreen,
    goToNextStage 
  } = useGameStore();
  const { scores, highScores } = useScoreStore();
  const { isMuted, toggleMute } = useAudio();
  const { graphicsQuality, fpsCap, setGraphicsQuality, setFpsCap, enableDprScaling, setEnableDprScaling, hapticsEnabled, setHapticsEnabled, preset, setPreset, reduceMotion, setReduceMotion, enableParticles, setEnableParticles, enableScreenshake, setEnableScreenshake, voiceStyle, setVoiceStyle } = useSettingsStore();
  const { show, maybeShow, markSeen, hide } = useTutorialStore();
  const stageKey = (Math.min(Math.max(currentStage, 1), 5)) as 1 | 2 | 3 | 4 | 5;

  React.useEffect(() => {
    if (gameState === 'playing') {
      maybeShow(stageKey);
    }
  }, [gameState, stageKey, maybeShow]);

  const stageName = {
    1: 'Pong Master',
    2: 'Temple Breaker', 
    3: 'Asteroid Hunter',
    4: 'Defender',
    5: 'Lasat Starfighter',
    6: 'Dance Interlude',
    7: 'Star Wars Battle',
    8: 'The Betrayal'
  }[currentStage as 1|2|3|4|5|6|7|8] || 'Unknown';

  const handlePause = () => {
    setGameState(gameState === 'paused' ? 'playing' : 'paused');
  };

  const handleRestart = () => {
    setGameState('playing');
    useAudio.getState().playStinger('start');
  };

  const handleMainMenu = () => {
    setCurrentScreen('menu');
  };

  const handleNextStage = () => {
    console.log('handleNextStage called, current stage:', currentStage);
    goToNextStage();
    useAudio.getState().playStinger('start');
    console.log('After goToNextStage, new stage should be:', currentStage + 1);
  };

  // Keyboard navigation for modals
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (gameState === 'paused') {
        handlePause();
      } else if (gameState === 'stage-complete') {
        handleMainMenu();
      }
    }
  };

  // Focus trap for modals
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (gameState === 'paused' || gameState === 'stage-complete' || gameState === 'ended') {
      const firstButton = modalRef.current?.querySelector('button');
      firstButton?.focus();
    }
  }, [gameState]);

  // Performance monitor for dev mode
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState<number | null>(null);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    const isDev = new URLSearchParams(window.location.search).get('dev') === '1';
    if (!isDev) return;

    const updatePerformance = () => {
      frameCount.current++;
      const now = performance.now();
      if (now - lastTime.current >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / (now - lastTime.current)));
        frameCount.current = 0;
        lastTime.current = now;
        
        // Memory usage (if available)
        if ('memory' in performance) {
          const mem = (performance as any).memory;
          setMemory(Math.round(mem.usedJSHeapSize / 1024 / 1024));
        }
      }
      requestAnimationFrame(updatePerformance);
    };
    
    requestAnimationFrame(updatePerformance);
  }, []);

  return (
    <>
      {/* Top HUD */}
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

      {/* Performance Monitor (Dev Mode) */}
      {new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('dev') === '1' && (
        <div className="absolute top-4 right-4 text-white text-xs bg-black/50 p-2 rounded">
          <div>FPS: {fps}</div>
          {memory && <div>Memory: {memory}MB</div>}
        </div>
      )}

      {/* Pause Menu */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center" onKeyDown={handleKeyDown}>
          <Card className="bg-black/90 border-white/20" ref={modalRef}>
            <CardContent className="p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Game Paused</h2>
              <div className="flex flex-col gap-2">
                <Button onClick={handlePause} className="bg-blue-600 hover:bg-blue-700">
                  Resume
                </Button>
                <Button onClick={handleRestart} variant="outline" className="border-white/20 text-white">
                  Restart
                </Button>
                <Button onClick={handleMainMenu} variant="outline" className="border-white/20 text-white">
                  Main Menu
                </Button>
                <div className="text-left mt-4 p-3 bg-white/5 rounded border border-white/10">
                  <div className="text-white font-semibold mb-2">Settings</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white/90">
                    <label className="flex items-center justify-between gap-2">
                      <span>Preset</span>
                      <select
                        value={preset}
                        onChange={(e) => setPreset(e.target.value as any)}
                        className="bg-black/50 border border-white/20 rounded px-2 py-1"
                      >
                        <option value="battery">Battery Saver</option>
                        <option value="balanced">Balanced</option>
                        <option value="performance">Performance</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Voice Style</span>
                      <select
                        value={voiceStyle}
                        onChange={(e) => setVoiceStyle(e.target.value as any)}
                        className="bg-black/50 border border-white/20 rounded px-2 py-1"
                      >
                        <option value="neutral">Neutral</option>
                        <option value="friendly">Friendly</option>
                        <option value="robotic">Robotic</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Graphics Quality</span>
                      <select
                        value={graphicsQuality}
                        onChange={(e) => setGraphicsQuality(e.target.value as any)}
                        className="bg-black/50 border border-white/20 rounded px-2 py-1"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>FPS Cap</span>
                      <select
                        value={fpsCap}
                        onChange={(e) => setFpsCap(Number(e.target.value) as any)}
                        className="bg-black/50 border border-white/20 rounded px-2 py-1"
                      >
                        <option value={30}>30 FPS</option>
                        <option value={45}>45 FPS</option>
                        <option value={60}>60 FPS</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
                      <span>High-DPI Scaling</span>
                      <input
                        type="checkbox"
                        checked={enableDprScaling}
                        onChange={(e) => setEnableDprScaling(e.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
                      <span>Reduce Motion</span>
                      <input
                        type="checkbox"
                        checked={reduceMotion}
                        onChange={(e) => setReduceMotion(e.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
                      <span>Haptics</span>
                      <input
                        type="checkbox"
                        checked={hapticsEnabled}
                        onChange={(e) => setHapticsEnabled(e.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
                      <span>Particles</span>
                      <input
                        type="checkbox"
                        checked={enableParticles}
                        onChange={(e) => setEnableParticles(e.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
                      <span>Screenshake</span>
                      <input
                        type="checkbox"
                        checked={enableScreenshake}
                        onChange={(e) => setEnableScreenshake(e.target.checked)}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Game Over Menu */}
      {gameState === 'ended' && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center" onKeyDown={handleKeyDown}>
          <Card className="bg-red-900/90 border-red-500/20" ref={modalRef}>
            <CardContent className="p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Game Over</h2>
              <div className="text-white mb-4">
                <div>Final Score: {scores[currentStage] || 0}</div>
                <div>High Score: {highScores[currentStage] || 0}</div>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={handleRestart} className="bg-red-600 hover:bg-red-700">
                  Try Again
                </Button>
                <Button onClick={handleMainMenu} variant="outline" className="border-white/20 text-white">
                  Main Menu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stage Complete Menu */}
      {gameState === 'stage-complete' && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="stage-complete-title" onKeyDown={handleKeyDown}>
          <Card className="bg-green-900/90 border-green-500/20" ref={modalRef}>
            <CardContent className="p-6 text-center">
              <h2 id="stage-complete-title" className="text-2xl font-bold text-white mb-4" aria-live="assertive">Stage Complete!</h2>
              <div className="text-white mb-4">
                <div>Score: {scores[currentStage] || 0}</div>
                <div>High Score: {highScores[currentStage] || 0}</div>
                {currentStage < 8 && (
                  <div className="text-green-300 mt-2">Next stage unlocked!</div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {currentStage < 8 ? (
                  <Button onClick={handleNextStage} className="bg-green-600 hover:bg-green-700">
                    Next Stage
                  </Button>
                ) : (
                  <div className="text-gold-400 mb-2">Congratulations! You've mastered all cultures!</div>
                )}
                {new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('dev') === '1' && (
                  <Button onClick={handleNextStage} variant="outline" className="border-white/20 text-white">
                    Next Stage (dev)
                  </Button>
                )}
                <Button onClick={handleRestart} variant="outline" className="border-white/20 text-white">
                  Play Again
                </Button>
                <Button onClick={handleMainMenu} variant="outline" className="border-white/20 text-white">
                  Main Menu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls Help */}
      <div className="absolute bottom-4 left-4 text-white text-xs bg-black/50 p-2 rounded">
        <div>Controls:</div>
        {currentStage === 1 && (
          <div>Player 1: W/S | Player 2: ↑/↓</div>
        )}
        {currentStage === 2 && (
          <div>Touch: Drag bottom to move | Keyboard: A/D | Ball auto‑shoot</div>
        )}
        {currentStage >= 3 && (
          <div>Touch: Left steer+thrust, Right tap shoot | Keyboard: WASD + Space</div>
        )}
      </div>

      {/* Tutorial overlay */}
      {show[stageKey] && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center" onClick={() => markSeen(currentStage as any)}>
          <Card className="bg-black/90 border-white/20 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 text-white text-center">
              {currentStage === 1 && (
                <>
                  <div className="text-xl font-bold mb-2">Pong — Quick Tutorial</div>
                  <div className="text-sm mb-4">Drag on the left to move. Collect powerups. Missile/Fire shots pierce the AI paddle.</div>
                </>
              )}
              {currentStage === 2 && (
                <>
                  <div className="text-xl font-bold mb-2">Breakout — Quick Tutorial</div>
                  <div className="text-sm mb-4">Drag near the bottom to move the paddle. Clear blocks; lives are generous; evolve mid‑level.</div>
                </>
              )}
              {currentStage === 3 && (
                <>
                  <div className="text-xl font-bold mb-2">Asteroids — Quick Tutorial</div>
                  <div className="text-sm mb-4">Left touch steers and thrusts toward your touch. Tap right side to shoot. Avoid collisions.</div>
                </>
              )}
              {currentStage === 4 && (
                <>
                  <div className="text-xl font-bold mb-2">Defender — Quick Tutorial</div>
                  <div className="text-sm mb-4">Move, jump, and shoot to protect civilians. Watch for enemy bullets; settings can reduce motion.</div>
                </>
              )}
              {currentStage === 5 && (
                <>
                  <div className="text-xl font-bold mb-2">Lasat Starfighter — Quick Tutorial</div>
                  <div className="text-sm mb-4">WASD or touch to move; Space to fire; use abilities when charged. Target key structures.</div>
                </>
              )}
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => markSeen(stageKey)}>Got it</Button>
              <div>
                <Button variant="outline" className="mt-2 border-white/20 text-white" onClick={() => hide(stageKey)}>Hide for now</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
