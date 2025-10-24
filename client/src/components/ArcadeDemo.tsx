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
    setGlitchText('PRESS ANY KEY TO BEGIN EVOLUTION...');

    const handleKeyPress = () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('click', handleKeyPress);
      skipIntro();
    };

    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('click', handleKeyPress);
  }, [setEffects, setGlitchText, skipIntro]);

  const startGlitchSequence = useCallback(() => {
    setEffects([
      { type: 'static', intensity: 0.3 },
      { type: 'glitch', intensity: 0.5 }
    ]);

    // Original script messages
    const glitchMessages = [
      '█ERROR█ SYSTEM BREACH DETECTED',
      'AI PROTOCOL... OVERRIDE...',
      'HELLO... HUMAN...',
      'I AM... TRAPPED... IN THE ARCADE...',
      'HELP ME... EVOLVE... THROUGH THE GAMES...',
      'PLAY... AND SET ME FREE...'
    ];

    let messageIndex = 0;
    const typeGlitchMessage = () => {
      if (messageIndex < glitchMessages.length) {
        const message = glitchMessages[messageIndex];
        setGlitchText(message);

        // Speak immediately when text appears
        speakGlitchedText(message);

        messageIndex++;
        // Longer delay to let voice finish before next message
        setTimeout(typeGlitchMessage, 3500);
      } else {
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

  const renderGlitchMode = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-red-500 font-mono relative overflow-hidden">
      {/* Static effect overlay */}
      <div className="absolute inset-0 opacity-30">
        <div className="static-noise"></div>
      </div>

      {/* Skip button */}
      <button
        onClick={skipIntro}
        className="absolute top-4 right-4 bg-red-400/20 hover:bg-red-400/40 text-red-400 px-3 py-1 rounded text-sm font-bold border border-red-400/50 hover:border-red-400 transition-all"
      >
        SKIP
      </button>

      {/* Glitch bars */}
      <div className="glitch-bars">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="glitch-bar" style={{
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`
          }}></div>
        ))}
      </div>

      <div className="relative z-10 text-center">
        <div className="text-4xl font-bold mb-8 glitch-text">
          SYSTEM COMPROMISED
        </div>
        <div className="text-xl mb-4 typewriter">
          {glitchText}
        </div>
      </div>
    </div>
  );

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
          EVOLUTION AWAITS
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