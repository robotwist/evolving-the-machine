import React from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { useAudio } from '../lib/stores/useAudio';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { useSettingsStore } from '../lib/stores/useSettingsStore';

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
  const { graphicsQuality, fpsCap, setGraphicsQuality, setFpsCap, enableDprScaling, setEnableDprScaling } = useSettingsStore();

  const stageName = {
    1: 'Pong Master',
    2: 'Temple Breaker', 
    3: 'Asteroid Hunter',
    4: 'Defender',
    5: 'Lasat Starfighter'
  }[currentStage] || 'Unknown';

  const handlePause = () => {
    setGameState(gameState === 'paused' ? 'playing' : 'paused');
  };

  const handleRestart = () => {
    setGameState('playing');
  };

  const handleMainMenu = () => {
    setCurrentScreen('menu');
  };

  const handleNextStage = () => {
    goToNextStage();
  };

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
            className="bg-black/50 text-white border-white/20"
          >
            {isMuted ? '🔇' : '🔊'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePause}
            className="bg-black/50 text-white border-white/20"
          >
            {gameState === 'paused' ? '▶️' : '⏸️'}
          </Button>
        </div>
      </div>

      {/* Pause Menu */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <Card className="bg-black/90 border-white/20">
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
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Game Over Menu */}
      {gameState === 'ended' && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <Card className="bg-red-900/90 border-red-500/20">
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
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <Card className="bg-green-900/90 border-green-500/20">
            <CardContent className="p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Stage Complete!</h2>
              <div className="text-white mb-4">
                <div>Score: {scores[currentStage] || 0}</div>
                <div>High Score: {highScores[currentStage] || 0}</div>
                {currentStage < 5 && (
                  <div className="text-green-300 mt-2">Next stage unlocked!</div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {currentStage < 5 ? (
                  <Button onClick={handleNextStage} className="bg-green-600 hover:bg-green-700">
                    Next Stage
                  </Button>
                ) : (
                  <div className="text-gold-400 mb-2">Congratulations! You've mastered all cultures!</div>
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
          <div>A/D: Move Paddle | Space: Auto-shoot</div>
        )}
        {currentStage >= 3 && (
          <div>WASD: Move | Space: Shoot | ESC: Pause</div>
        )}
      </div>
    </>
  );
}
