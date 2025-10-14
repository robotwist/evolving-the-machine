import React, { useState, useEffect } from 'react';
import './../index.css';

interface ScreenTransitionProps {
  message: string;
  onComplete: () => void;
}

export function ScreenTransition({ message, onComplete }: ScreenTransitionProps) {
  const [phase, setPhase] = useState('entering'); // entering -> active -> exiting
  const [typedMessage, setTypedMessage] = useState('');

  useEffect(() => {
    if (phase === 'entering') {
      setTimeout(() => setPhase('active'), 1000); // Time for curtain to cover screen
    } else if (phase === 'active') {
      // Typewriter effect
      let i = 0;
      const interval = setInterval(() => {
        setTypedMessage(message.substring(0, i));
        i++;
        if (i > message.length) {
          clearInterval(interval);
          setTimeout(() => setPhase('exiting'), 1500); // Hold message on screen
        }
      }, 50);
    } else if (phase === 'exiting') {
      setTimeout(() => onComplete(), 1000); // Time for curtain to uncover
    }
  }, [phase, message, onComplete]);

  const transitionStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 100,
    transition: 'transform 1s ease-in-out',
    transform: phase === 'entering' || phase === 'active' ? 'translateY(0%)' : 'translateY(-100%)',
  };

  return (
    <div style={transitionStyle}>
      <div className="curtain-transition" />
      {phase === 'active' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-4xl font-bold text-red-500 glow-text typewriter" style={{ fontFamily: '"Press Start 2P", cursive' }}>
            {typedMessage}
          </h1>
        </div>
      )}
    </div>
  );
}
