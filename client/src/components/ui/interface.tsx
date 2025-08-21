import React, { useEffect } from 'react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Input } from './input';
import { Label } from './label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Textarea } from './textarea';
import { useSettingsStore } from '../../lib/stores/useSettingsStore';
import { useGameStore } from '../../lib/stores/useGameStore';
import { useAudio } from '../../lib/stores/useAudio';

export function Interface() {
  const { setGameState } = useGameStore();
  const { isMuted, toggleMute } = useAudio();

  // Handle clicks on the interface in the ready phase to start the game
  useEffect(() => {
    const handleClick = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur(); // Remove focus from any button
      }
      const event = new KeyboardEvent("keydown", { code: "Space" });
      window.dispatchEvent(event);
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleRestart = () => {
    setGameState('playing');
  };

  return (
    <>
      {/* Top-right corner UI controls */}
      <div className="fixed top-4 right-4 flex gap-2 z-10">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? 'Mute' : 'Sound On'}
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={handleRestart}
          title="Restart Game"
        >
          Restart
        </Button>
      </div>
      
      {/* Instructions panel */}
      <div className="fixed bottom-4 left-4 z-10">
        <Card className="w-auto max-w-xs bg-background/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Controls:</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>WASD or Arrow Keys: Move the ball</li>
              <li>Space: Jump</li>
              <li>R: Restart game</li>
              <li>M: Toggle sound</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
