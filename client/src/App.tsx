import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArcadeDemo } from './components/ArcadeDemo';
import { MainMenu } from './components/MainMenu';
import { StageSelect } from './components/StageSelect';
import { GameCanvas } from './components/GameCanvas';
import { GameUI } from './components/GameUI';
import { ScreenTransition } from './components/ScreenTransition';
import { UpdatePrompt } from './components/UpdatePrompt';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { MobileGameUI } from './components/MobileGameUI';
import { useGameStore } from './lib/stores/useGameStore';
import { useAudio } from './lib/stores/useAudio';
import { useSettingsStore } from './lib/stores/useSettingsStore';
import { useIsMobile } from './hooks/use-is-mobile';
import { assetLoader } from './lib/utils/AssetLoader';
import './index.css';

const queryClient = new QueryClient();

// Helper function to get game name from stage
function getGameName(stage: number): string {
  const gameNames = [
    'Pong',
    'Breakout',
    'Asteroids',
    'Defender',
    'Lasat',
    'Dance Interlude',
    'Star Wars',
    'Betrayal'
  ];
  return gameNames[stage - 1] || 'Unknown';
}

export default function App() {
  const { currentScreen, currentStage } = useGameStore();
  const { setBackgroundMusic, setHitSound, setSuccessSound, setUIClickSound } = useAudio();
  const { showDemo, setShowDemo } = useGameStore();
  const isMobile = useIsMobile();
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('');
  const [previousScreen, setPreviousScreen] = useState<string | null>(null);
  const [previousStage, setPreviousStage] = useState<number | null>(null);

  useEffect(() => {
    // Load audio assets and preload critical game assets
    const loadAssets = async () => {
      try {
        // Preload critical assets first (fonts, core textures, etc.)
        try {
          await assetLoader.preloadCriticalAssets();
        } catch (error) {
          console.warn('Failed to preload critical assets:', error);
        }

        // Load audio assets using the asset loader (with graceful fallbacks)
        try {
          const bgMusic = await assetLoader.getAsset('background', 'sounds') as HTMLAudioElement;
          bgMusic.loop = true;
          bgMusic.volume = 0.3;
          setBackgroundMusic(bgMusic);
        } catch (error) {
          console.warn('Failed to load background music:', error);
        }

        try {
          const hitSound = await assetLoader.getAsset('hit', 'sounds') as HTMLAudioElement;
          setHitSound(hitSound);
        } catch (error) {
          console.warn('Failed to load hit sound:', error);
        }

        try {
          const successSound = await assetLoader.getAsset('success', 'sounds') as HTMLAudioElement;
          setSuccessSound(successSound);
        } catch (error) {
          console.warn('Failed to load success sound:', error);
        }

        try {
          const uiClickSound = await assetLoader.getAsset('uiClick', 'sounds') as HTMLAudioElement;
          setUIClickSound(uiClickSound);
        } catch (error) {
          console.warn('Failed to load UI click sound:', error);
        }

        setAssetsLoaded(true);
        console.log('✅ All critical assets loaded');
      } catch (error) {
        console.error('Error loading assets:', error);
        setAssetsLoaded(true); // Continue even if assets fail
      }
    };

    loadAssets();
  }, [setBackgroundMusic, setHitSound, setSuccessSound, setUIClickSound]);

  // Stinger effect for game screen
  useEffect(() => {
    if (currentScreen === 'game') {
      useAudio.getState().playStinger('start');
    }
  }, [currentScreen]);

  // Hide demo when leaving menu
  useEffect(() => {
    if (currentScreen !== 'menu') {
      setShowDemo(false);
    }
  }, [currentScreen, setShowDemo]);

  // Intro VO sequencer when landing on menu initially
  useEffect(() => {
    const runIntroVO = async () => {
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
        } catch {
          // Intro VO errors are non-critical, continue silently
        }
      }
    };
    runIntroVO();
  }, [currentScreen]);

  // Screen transition logic
  useEffect(() => {
    // Skip transition on initial load
    if (previousScreen === null) {
      setPreviousScreen(currentScreen);
      setPreviousStage(currentStage);
      return;
    }

    // Check if screen changed
    if (previousScreen !== currentScreen) {
      const messages = {
        'menu': 'RETURNING TO MAIN INTERFACE...',
        'stage-select': 'ACCESSING STAGE SELECTION...',
        'game': 'INITIALIZING GAME ENVIRONMENT...'
      };
      
      setTransitionMessage(messages[currentScreen as keyof typeof messages] || 'SYSTEM TRANSITIONING...');
      setShowTransition(true);
      setPreviousScreen(currentScreen);
    }

    // Check if stage changed
    if (previousStage !== null && previousStage !== currentStage) {
      setTransitionMessage(`EVOLVING TO STAGE ${currentStage}...`);
      setShowTransition(true);
      setPreviousStage(currentStage);
    }
  }, [currentScreen, currentStage, previousScreen, previousStage]);

  const handleTransitionComplete = () => {
    setShowTransition(false);
  };

  useEffect(() => {
    const run = async () => {
      if (currentScreen === 'menu') {
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        const deviceLine = isMobile ? 'MOBILE THRUSTERS CALIBRATED.' : 'DESKTOP LINK ESTABLISHED.';
        try {
          await useAudio.getState().playVO('SYSTEM ONLINE.', { pitch: 0.8, rate: 0.9 });
          await useAudio.getState().playVO(deviceLine, { pitch: 0.9, rate: 0.95 });
          await useAudio.getState().playVO('CULTURAL ARCADE: EVOLUTION PROTOCOL READY.', { pitch: 1.0, rate: 0.98 });
        } catch {
          // Menu VO errors are non-critical, continue silently
        }
      }
    };
    run();
  }, [currentScreen]);

  // Dev helpers via query params: ?unlock=all, ?stage=3
  // This runs ONCE on mount and overrides persisted storage if needed
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unlock = params.get('unlock');
    if (unlock === 'all') {
      console.log('🔓 Dev Mode: Unlocking all stages');
      // Force override the persisted storage value
      const store = useGameStore.getState();
      store.resetProgress(); // Clear first to avoid stale data
      useGameStore.setState({ unlockedStages: 8, currentScreen: 'menu' });
      console.log('✅ All 8 stages unlocked:', useGameStore.getState().unlockedStages);
    }
    const stageParam = params.get('stage');
    if (stageParam) {
      const stageNum = Number(stageParam);
      if (!Number.isNaN(stageNum) && stageNum >= 1 && stageNum <= 8) {
        console.log(`🎮 Dev Mode: Jumping to stage ${stageNum}`);
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
    const stylePitch = style === 'normal' ? 0 : style === 'haunting' ? -0.1 : style === 'glitch' ? 0 : 0;
    const styleRate = style === 'normal' ? 0 : style === 'haunting' ? -0.02 : style === 'glitch' ? -0.05 : 0;
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
      <div className={`game-container ${isMobile ? 'mobile-game' : 'desktop-game'}`}>
        <UpdatePrompt />
        <PWAInstallPrompt />
        {currentScreen === 'menu' && <MainMenu />}
        {currentScreen === 'stage-select' && <StageSelect />}
        {currentScreen === 'game' && (
          <>
            {isMobile ? (
              <MobileGameUI
                currentGame={getGameName(currentStage)}
                stage={currentStage}
                gameState="playing"
                onGameComplete={() => {/* TODO: Implement mobile game completion */}}
                onScoreUpdate={(_score) => {/* TODO: Implement mobile score updates */}}
              />
            ) : (
              <>
                <GameCanvas />
                <div className="ui-overlay">
                  <GameUI />
                </div>
              </>
            )}
          </>
        )}
        {showTransition && (
          <ScreenTransition
            message={transitionMessage}
            onComplete={handleTransitionComplete}
          />
        )}
      </div>
    </QueryClientProvider>
  );
}
