import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArcadeDemo } from './components/ArcadeDemo';
import { MainMenu } from './components/MainMenu';
import { StageSelect } from './components/StageSelect';
import { GameCanvas } from './components/GameCanvas';
import { GameUI } from './components/GameUI';
import { useGameStore } from './lib/stores/useGameStore';
import { useAudio } from './lib/stores/useAudio';
import './index.css';

const queryClient = new QueryClient();

export default function App() {
  const { currentScreen, currentStage } = useGameStore();
  const { setBackgroundMusic, setHitSound, setSuccessSound } = useAudio();
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [showDemo, setShowDemo] = useState(true);

  useEffect(() => {
    // Load audio assets
    const loadAudio = async () => {
      try {
        const bgMusic = new Audio('/sounds/background.mp3');
        const hitSound = new Audio('/sounds/hit.mp3');
        const successSound = new Audio('/sounds/success.mp3');
        
        bgMusic.loop = true;
        bgMusic.volume = 0.3;
        
        setBackgroundMusic(bgMusic);
        setHitSound(hitSound);
        setSuccessSound(successSound);
        
        setAssetsLoaded(true);
      } catch (error) {
        console.error('Error loading audio assets:', error);
        setAssetsLoaded(true); // Continue even if audio fails
      }
    };

    loadAudio();
  }, [setBackgroundMusic, setHitSound, setSuccessSound]);

  useEffect(() => {
    if (currentScreen !== 'menu') {
      setShowDemo(false);
    }
  }, [currentScreen]);

  if (!assetsLoaded) {
    return (
      <div className="game-container">
        <div className="text-white text-xl">Loading Cultural Arcade Evolution...</div>
      </div>
    );
  }

  if (showDemo && currentScreen === 'menu') {
    return (
      <QueryClientProvider client={queryClient}>
        <ArcadeDemo />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="game-container">
        {currentScreen === 'menu' && <MainMenu />}
        {currentScreen === 'stage-select' && <StageSelect />}
        {currentScreen === 'game' && (
          <>
            <GameCanvas />
            <div className="ui-overlay">
              <GameUI />
            </div>
          </>
        )}
      </div>
    </QueryClientProvider>
  );
}
