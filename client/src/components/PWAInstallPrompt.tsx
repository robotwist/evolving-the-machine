import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { usePWA } from '../hooks/use-pwa';
import { useGameStore } from '../lib/stores/useGameStore';

export function PWAInstallPrompt() {
  const { canInstall, installApp } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { currentScreen } = useGameStore();

  useEffect(() => {
    // Show prompt after a delay and only on menu screen
    if (canInstall && !isDismissed && currentScreen === 'menu') {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [canInstall, isDismissed, currentScreen]);

  const handleInstall = async () => {
    const installed = await installApp();
    if (installed) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
  };

  if (!isVisible || !canInstall) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-2">
      <div className="arcade-panel panel-green p-4 max-w-sm mx-auto">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="arcade-label text-neon-green mb-2">
              Install Cultural Arcade
            </h3>
            <p className="text-white/80 text-lg mb-3">
              Play offline and get the full mobile experience!
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="success"
                onClick={handleInstall}
              >
                Install App
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-white/60"
              >
                Later
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
