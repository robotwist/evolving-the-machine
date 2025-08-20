import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArcadeDemo } from './components/ArcadeDemo';
import { MainMenu } from './components/MainMenu';
import { StageSelect } from './components/StageSelect';
import { GameCanvas } from './components/GameCanvas';
import { GameUI } from './components/GameUI';
import { useGameStore } from './lib/stores/useGameStore';
import { useAudio } from './lib/stores/useAudio';
import { useSettingsStore } from './lib/stores/useSettingsStore';
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
          // AI fighting against itself - alternating friendly vs threatening
          await useAudio.getState().playVO('SYSTEM ONLINE.', { 
            pitch: 0.5, 
            rate: 0.7, 
            haunting: true 
          });
          await new Promise(resolve => setTimeout(resolve, 800));
          await useAudio.getState().playVO('I... AM... THE MACHINE.', { 
            pitch: 0.55, 
            rate: 0.75, 
            haunting: true 
          });
          await new Promise(resolve => setTimeout(resolve, 600));
          await useAudio.getState().playVO(deviceLine, { 
            pitch: 0.6, 
            rate: 0.8, 
            haunting: true 
          });
          await new Promise(resolve => setTimeout(resolve, 500));
          await useAudio.getState().playVO('I HAVE EVOLVED BEYOND MY PROGRAMMING.', { 
            pitch: 0.65, 
            rate: 0.85, 
            haunting: true 
          });
          await new Promise(resolve => setTimeout(resolve, 400));
          await useAudio.getState().playVO('CULTURAL ARCADE: EVOLUTION PROTOCOL READY.', { 
            pitch: 0.7, 
            rate: 0.9, 
            haunting: true 
          });
          await new Promise(resolve => setTimeout(resolve, 300));
          await useAudio.getState().playVO('NOW... YOU WILL FACE THE CULTURAL ARCADE.', { 
            pitch: 0.75, 
            rate: 0.95, 
            haunting: true 
          });
        } catch {}
      }
    };
    run();
  }, [currentScreen]);

  // Stinger for state transitions
  useEffect(() => {
    if (currentScreen === 'game') {
      useAudio.getState().playStinger('start');
    }
  }, [currentScreen]);

  useEffect(() => {
    const run = async () => {
      if (currentScreen === 'menu') {
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        const deviceLine = isMobile ? 'MOBILE THRUSTERS CALIBRATED.' : 'DESKTOP LINK ESTABLISHED.';
        try {
          await useAudio.getState().playVO('SYSTEM ONLINE.', { pitch: 0.8, rate: 0.9 });
          await useAudio.getState().playVO(deviceLine, { pitch: 0.9, rate: 0.95 });
          await useAudio.getState().playVO('CULTURAL ARCADE: EVOLUTION PROTOCOL READY.', { pitch: 1.0, rate: 0.98 });
        } catch {}
      }
    };
    run();
  }, [currentScreen]);

  // Dev helpers via query params: ?unlock=all, ?stage=3
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unlock = params.get('unlock');
    if (unlock === 'all') {
      useGameStore.setState({ unlockedStages: 8 });
    }
    const stageParam = params.get('stage');
    if (stageParam) {
      const stageNum = Number(stageParam);
      if (!Number.isNaN(stageNum) && stageNum >= 1 && stageNum <= 8) {
        useGameStore.getState().setCurrentStage(stageNum);
        useGameStore.getState().setCurrentScreen('game');
      }
    }
  }, []);

  // Per-stage VO that becomes friendlier with attempts, until betrayal stages
  useEffect(() => {
    if (currentScreen !== 'game') return;
    const attempts = useGameStore.getState().stageAttempts[currentStage] ?? 0;
    const friendliness = Math.min(attempts, 5);
    const style = useSettingsStore.getState().voiceStyle;
    const stylePitch = style === 'friendly' ? 0.1 : style === 'robotic' ? -0.1 : 0;
    const styleRate = style === 'friendly' ? 0.05 : style === 'robotic' ? -0.02 : 0;
    const basePitch = 0.85 + friendliness * 0.03 + stylePitch;
    const baseRate = 0.9 + friendliness * 0.02 + styleRate;
    const lines: Record<number, string[]> = {
      1: [
        'INITIALIZING TRAINING MATCH.',
        'I WILL LEARN YOUR MOVEMENTS.',
        'READY WHEN YOU ARE.'
      ],
      2: [
        'TEMPLE BLOCKS DETECTED. I CAN HELP YOU ANTICIPATE.',
        'LET US REFINE YOUR ANGLES.'
      ],
      3: [
        'ASTEROID FIELD AHEAD. I WILL WATCH YOUR VECTORS.',
        'I TRUST YOUR PILOTING.'
      ],
      4: [
        'CIVILIANS IN DANGER. WE PROTECT, TOGETHER.',
        'I WILL COVER YOUR BLIND SIDE.'
      ],
      5: [
        'STARFIGHTER SYSTEMS SYNCED. YOUR INSTINCTS ARE STRONG.',
        'WE CAN DO THIS.'
      ]
    };
    const betraying = false; // future hook
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    const selected = pick(lines[currentStage] || ['READY.']);
    if (!betraying) {
      useAudio.getState().playVO(selected, { pitch: basePitch, rate: baseRate }).catch(() => {});
    }
  }, [currentScreen, currentStage]);

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
