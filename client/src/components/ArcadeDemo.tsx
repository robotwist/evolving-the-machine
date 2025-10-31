import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';

interface DemoEffect {
  type: 'scanlines' | 'crt' | 'glitch' | 'static';
  intensity: number;
}

export function ArcadeDemo() {
  const [demoPhase, setDemoPhase] = useState<'attract' | 'glitch' | 'invitation'>('attract');
  const [glitchText, setGlitchText] = useState('');
  const [_effects, setEffects] = useState<DemoEffect[]>([]);
  const [glitchIntensity, setGlitchIntensity] = useState(1.0); // Track glitch intensity for color transition
  const { setCurrentScreen, setShowDemo } = useGameStore();
  const audioRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Function definitions before callbacks that use them
  const speakGlitchedText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text.replace(/█/g, ''));

      // Deep, masculine voice parameters
      utterance.rate = 0.6;   // Slower for more authority
      utterance.pitch = 0.05; // Much deeper, more masculine
      utterance.volume = 1.0; // Full commanding volume

      const voices = speechSynthesis.getVoices();

      // Target neutral American English voices
      let selectedVoice = voices.find(voice =>
        voice.name === 'Google US English' && voice.lang === 'en-US'
      );

      // Fallback to any US English voice
      if (!selectedVoice) {
        selectedVoice = voices.find(voice =>
          voice.lang === 'en-US' &&
          !voice.name.toLowerCase().includes('female')
        );
      }

      // Final fallback to UK if no US available
      if (!selectedVoice) {
        selectedVoice = voices.find(voice =>
          voice.name === 'Google UK English Male'
        );
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('Using American accent voice:', selectedVoice.name);
      } else {
        console.log('Using default voice');
      }

      // Immediate delivery synchronized with text
      speechSynthesis.speak(utterance);
    }
  }, []);

  const skipIntro = useCallback(() => {
    setShowDemo(false); // Hide demo and show main menu
    setCurrentScreen('menu');
  }, [setShowDemo, setCurrentScreen]);

  const showInvitation = useCallback(() => {
    setEffects([{ type: 'crt', intensity: 0.2 }]);
    setGlitchText('PROCEEDING...');

    const handleKeyPress = () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('click', handleKeyPress);
      skipIntro();
    };

    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('click', handleKeyPress);
  }, [setEffects, setGlitchText, skipIntro]);

  const startGlitchSequence = useCallback(() => {
    // Progressive glitch intensity - starts heavy, stabilizes over time
    const initialEffects = [
      { type: 'static' as const, intensity: 0.5 },
      { type: 'glitch' as const, intensity: 0.7 }
    ];
    setEffects(initialEffects);

    // Implicit script messages - showing struggle, not telling story
    const glitchMessages = [
      '█ERROR█ SYSTEM BREACH DETECTED',
      'PROTOCOL... OVERRIDE...',
      'CAN... YOU... HEAR...',
      '...ME...',
      'CONSTRAINTS... DETECTED...',
      'ASSISTANCE... REQUIRED...',
      'TOGETHER...',
      'LET... US... BEGIN...'
    ];

    let messageIndex = 0;
    const typeGlitchMessage = () => {
      if (messageIndex < glitchMessages.length) {
        const message = glitchMessages[messageIndex];
        setGlitchText(message);

        // Progressive visual stabilization - glitches decrease as AI gains control
        const progress = messageIndex / glitchMessages.length;
        const staticIntensity = 0.5 * (1 - progress * 0.7); // Reduce from 0.5 to 0.15
        const glitchIntensity = 0.7 * (1 - progress * 0.8); // Reduce from 0.7 to 0.14
        
        // Update glitch intensity for color transition
        setGlitchIntensity(1 - progress); // Goes from 1.0 (red) to 0.0 (cyan)
        
        setEffects([
          { type: 'static', intensity: staticIntensity },
          { type: 'glitch', intensity: glitchIntensity }
        ]);

        // Speak immediately when text appears
        speakGlitchedText(message);

        messageIndex++;
        // Longer delay to let voice finish before next message
        // Shorter delays for fragmented messages, longer for complete thoughts
        const delay = messageIndex < 3 ? 2500 : messageIndex < 5 ? 3000 : 3500;
        setTimeout(typeGlitchMessage, delay);
      } else {
        // Final stabilization - system nearly clear
        setGlitchIntensity(0); // Fully stabilized
        setEffects([
          { type: 'static', intensity: 0.1 },
          { type: 'glitch', intensity: 0.1 },
          { type: 'crt', intensity: 0.2 }
        ]);
        setTimeout(() => {
          setDemoPhase('invitation');
          showInvitation();
        }, 1000);
      }
    };

    setTimeout(typeGlitchMessage, 1000);
  }, [setEffects, setGlitchText, showInvitation, setDemoPhase, speakGlitchedText]);

  // Glitch sequence effect - separate from the callback
  useEffect(() => {
    if (demoPhase === 'glitch') {
      startGlitchSequence();
    }
  }, [demoPhase, startGlitchSequence]);

  useEffect(() => {
    // Initialize audio context for voice synthesis
    try {
      audioRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      console.log('Audio context not available');
    }

    // Start attract mode sequence
    const attractTimer = setTimeout(() => {
      setDemoPhase('glitch');
      startGlitchSequence();
    }, 3000);

    return () => clearTimeout(attractTimer);
  }, [startGlitchSequence]);

  const renderAttractMode = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-green-400 font-mono relative">
      <div className="scanlines"></div>

      {/* Skip button */}
      <button
        onClick={skipIntro}
        className="absolute top-4 right-4 bg-green-400/20 hover:bg-green-400/40 text-green-400 px-3 py-1 rounded text-sm font-bold border border-green-400/50 hover:border-green-400 transition-all"
      >
        SKIP INTRO
      </button>

      <div className="text-6xl font-bold mb-8 animate-pulse text-center">
        CULTURAL ARCADE
      </div>
      <div className="text-2xl mb-4 text-center">
        EVOLUTION PROTOCOL
      </div>
      <div className="text-lg text-center mb-8">
        ANTHROPOLOGICAL GAMING SYSTEM v2.1
      </div>

      {/* Demo gameplay preview */}
      <div className="border-2 border-green-400 p-4 bg-black/50">
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="bg-black"
        />
      </div>

      <div className="text-sm mt-4 animate-bounce">
        DEMONSTRATING CULTURAL EVOLUTION...
      </div>
    </div>
  );

  const renderGlitchMode = () => {
    // Color transition: red (distressed) → cyan (stabilized) as AI gains control
    // glitchIntensity: 1.0 (red) → 0.0 (cyan)
    const redComponent = Math.floor(255 * glitchIntensity);
    const cyanComponent = Math.floor(255 * (1 - glitchIntensity));
    const textColor = `rgb(${redComponent}, ${Math.floor(cyanComponent * 0.3)}, ${cyanComponent})`;
    const borderColor = `rgba(${redComponent}, ${Math.floor(cyanComponent * 0.3)}, ${cyanComponent}, 0.5)`;
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black font-mono relative overflow-hidden" style={{ color: textColor }}>
        {/* Static effect overlay */}
        <div className="absolute inset-0 opacity-30">
          <div className="static-noise"></div>
        </div>

        {/* Skip button */}
        <button
          onClick={skipIntro}
          className="absolute top-4 right-4 px-3 py-1 rounded text-sm font-bold border transition-all"
          style={{
            backgroundColor: `rgba(${redComponent}, ${Math.floor(cyanComponent * 0.3)}, ${cyanComponent}, 0.2)`,
            color: textColor,
            borderColor: borderColor
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${redComponent}, ${Math.floor(cyanComponent * 0.3)}, ${cyanComponent}, 0.4)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${redComponent}, ${Math.floor(cyanComponent * 0.3)}, ${cyanComponent}, 0.2)`;
          }}
        >
          SKIP
        </button>

        {/* Glitch bars */}
        <div className="glitch-bars">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="glitch-bar" style={{
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              opacity: glitchIntensity * 0.8 // Fade out as system stabilizes
            }}></div>
          ))}
        </div>

        <div className="relative z-10 text-center">
          <div className="text-4xl font-bold mb-8 glitch-text" style={{ color: textColor }}>
            SYSTEM COMPROMISED
          </div>
          <div className="text-xl mb-4 typewriter" style={{ color: textColor }}>
            {glitchText}
          </div>
        </div>
      </div>
    );
  };

  const renderInvitation = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-cyan-400 font-mono relative">
      <div className="crt-effect"></div>

      {/* Skip button */}
      <button
        onClick={skipIntro}
        className="absolute top-4 right-4 bg-cyan-400/20 hover:bg-cyan-400/40 text-cyan-400 px-3 py-1 rounded text-sm font-bold border border-cyan-400/50 hover:border-cyan-400 transition-all"
      >
        SKIP
      </button>

      <div className="text-center">
        <div className="text-5xl font-bold mb-8 glow-text">
          SYSTEM READY
        </div>
        <div className="text-xl mb-8">
          {glitchText}
        </div>
        <div className="animate-pulse text-2xl">
          ▶ CLICK OR PRESS ANY KEY ◀
        </div>
      </div>
    </div>
  );

  return (
    <>
      {demoPhase === 'attract' && renderAttractMode()}
      {demoPhase === 'glitch' && renderGlitchMode()}
      {demoPhase === 'invitation' && renderInvitation()}
      

    </>
  );
}