import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';

interface DemoEffect {
  type: 'scanlines' | 'crt' | 'glitch' | 'static';
  intensity: number;
}

export function ArcadeDemo() {
  const [demoPhase, setDemoPhase] = useState<'attract' | 'glitch' | 'invitation'>('attract');
  const [glitchText, setGlitchText] = useState('');
  const [effects, setEffects] = useState<DemoEffect[]>([]);
  const { setCurrentScreen, setCurrentStage } = useGameStore();
  const audioRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Initialize audio context for voice synthesis
    try {
      audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.log('Audio context not available');
    }

    // Start attract mode sequence
    const attractTimer = setTimeout(() => {
      setDemoPhase('glitch');
      startGlitchSequence();
    }, 3000);

    return () => clearTimeout(attractTimer);
  }, []);

  const startGlitchSequence = () => {
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
  };

  const speakGlitchedText = (text: string) => {
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
  };

  const showInvitation = () => {
    setEffects([{ type: 'crt', intensity: 0.2 }]);
    setGlitchText('PRESS ANY KEY TO BEGIN EVOLUTION...');
    
    const handleKeyPress = () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('click', handleKeyPress);
      startEvolution();
    };

    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('click', handleKeyPress);
  };

  const startEvolution = () => {
    setCurrentStage(1);
    setCurrentScreen('game');
  };

  const renderAttractMode = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-green-400 font-mono">
      <div className="scanlines"></div>
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-cyan-400 font-mono">
      <div className="crt-effect"></div>
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