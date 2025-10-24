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
      <div className="bg-black/90 backdrop-blur-sm border border-green-400/50 rounded-lg p-4 max-w-sm mx-auto">
        <div className="flex items-start gap-3">
          <div className="text-2xl">📱</div>
          <div className="flex-1">
            <h3 className="text-green-400 font-bold text-sm mb-1">
              Install Cultural Arcade
            </h3>
            <p className="text-green-300 text-xs mb-3">
              Play offline and get the full mobile experience!
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleInstall}
                className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white border-green-400"
              >
                Install App
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-xs px-3 py-1 text-green-300 hover:text-green-400"
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
