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

  // Intro VO sequencer when landing on menu initially
  useEffect(() => {
    const run = async () => {
      if (currentScreen === 'menu') {
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        const deviceLine = isMobile ? 'MOBILE THRUSTERS CALIBRATED.' : 'DESKTOP LINK ESTABLISHED.';
        try {
          await useAudio.getState().playVO('SYSTEM ONLINE.');
          await useAudio.getState().playVO(deviceLine);
          await useAudio.getState().playVO('CULTURAL ARCADE: EVOLUTION PROTOCOL READY.');
        } catch {}
      }
    };
    run();
  }, [currentScreen]);

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
        <UpdatePrompt />
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

function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      reg.onupdatefound = () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.onstatechange = () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(sw);
            setShow(true);
          }
        };
      };
    });
  }, []);

  if (!show || !waiting) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 border border-white/20 text-white px-3 py-2 rounded shadow">
      <span className="mr-3">An update is available.</span>
      <button
        className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
        onClick={() => {
          waiting.postMessage({ type: 'SKIP_WAITING' });
          waiting.addEventListener('statechange', () => {
            if (waiting.state === 'activated') {
              window.location.reload();
            }
          });
        }}
      >
        Update now
      </button>
    </div>
  );
}
