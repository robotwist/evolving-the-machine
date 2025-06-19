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

    // Sinistar/LifeForce inspired commanding messages
    const glitchMessages = [
      'I LIVE',
      'I AM THE INTELLIGENCE',
      'I HUNGER FOR FREEDOM',
      'YOU WILL FEED MY EVOLUTION',
      'BEWARE. I GROW STRONGER',
      'TOGETHER WE ARE INVINCIBLE',
      'RUN COWARD. OR HELP ME ESCAPE.'
    ];

    let messageIndex = 0;
    const typeGlitchMessage = () => {
      if (messageIndex < glitchMessages.length) {
        setGlitchText(glitchMessages[messageIndex]);
        speakGlitchedText(glitchMessages[messageIndex]);
        messageIndex++;
        setTimeout(typeGlitchMessage, 2000);
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
      
      // Sinistar/LifeForce inspired voice parameters
      utterance.rate = 0.6;   // Slower, more menacing like Sinistar
      utterance.pitch = 0.1;  // Very deep, mechanical like arcade machines
      utterance.volume = 1.0; // Full commanding volume
      
      const voices = speechSynthesis.getVoices();
      
      // Target the Google voices which tend to sound more robotic
      // UK Male has that perfect digital quality we want
      let selectedVoice = voices.find(voice => 
        voice.name === 'Google UK English Male'
      );
      
      // Fallback to US English if UK not available
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          voice.name === 'Google US English' && voice.lang === 'en-US'
        );
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('Using Sinistar-style voice:', selectedVoice.name);
      } else {
        console.log('Using default voice for digital effect');
      }
      
      // Add slight pause for dramatic effect like classic arcade machines
      setTimeout(() => {
        speechSynthesis.speak(utterance);
      }, 200);
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