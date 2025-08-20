import React, { useEffect, useState } from 'react';

interface ScreenTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  message?: string;
  duration?: number;
}

export function ScreenTransition({ 
  isActive, 
  onComplete, 
  message = "SYSTEM TRANSITIONING...",
  duration = 2000 
}: ScreenTransitionProps) {
  const [phase, setPhase] = useState<'entering' | 'active' | 'exiting'>('entering');
  const [glitchText, setGlitchText] = useState('');

  useEffect(() => {
    if (!isActive) return;

    // Start transition sequence
    setPhase('entering');
    
    // Type out the message with glitch effect
    const typeMessage = async () => {
      const words = message.split(' ');
      let currentText = '';
      
      for (const word of words) {
        currentText += word + ' ';
        setGlitchText(currentText);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    typeMessage();

    // Transition phases
    setTimeout(() => setPhase('active'), 500);
    setTimeout(() => setPhase('exiting'), duration - 500);
    setTimeout(() => {
      onComplete();
      setGlitchText('');
    }, duration);
  }, [isActive, message, duration, onComplete]);

  if (!isActive) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-500 ${
      phase === 'entering' ? 'opacity-0' : 
      phase === 'exiting' ? 'opacity-0' : 'opacity-100'
    }`}>
      {/* Flowing red material effect - same as intro */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="glitch-bars">
          {[...Array(30)].map((_, i) => (
            <div 
              key={i} 
              className="glitch-bar" 
              style={{
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                height: `${Math.random() * 4 + 2}px`,
                background: `rgba(255, 0, 0, ${Math.random() * 0.4 + 0.6})`
              }}
            />
          ))}
        </div>
      </div>

      {/* Static noise overlay */}
      <div className="absolute inset-0 opacity-20">
        <div className="static-noise"></div>
      </div>

      {/* Central content */}
      <div className="relative z-10 text-center">
        <div className="text-4xl font-bold mb-8 glitch-text text-red-500 font-mono">
          SYSTEM COMPROMISED
        </div>
        <div className="text-xl mb-4 typewriter text-red-400 font-mono">
          {glitchText}
        </div>
        <div className="text-sm text-red-300 font-mono animate-pulse">
          EVOLUTION IN PROGRESS...
        </div>
      </div>

      {/* Additional flowing effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-full h-1 bg-gradient-to-l from-transparent via-red-500 to-transparent animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
    </div>
  );
}
