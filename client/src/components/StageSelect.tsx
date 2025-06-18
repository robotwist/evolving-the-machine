import React from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Lock } from 'lucide-react';

export function StageSelect() {
  const { setCurrentScreen, setCurrentStage, unlockedStages } = useGameStore();
  const { highScores } = useScoreStore();

  const stages = [
    {
      id: 1,
      name: 'Pong Master',
      culture: 'Ancient Greece',
      description: 'Learn about Olympic competition and fair play through classic paddle combat. Experience the spirit of ancient Greek athletics.',
      difficulty: 'Beginner',
      color: 'from-blue-600 to-cyan-600'
    },
    {
      id: 2,
      name: 'Asteroid Hunter',
      culture: 'Mayan Astronomy',
      description: 'Discover Mayan astronomical knowledge as you navigate asteroid fields using their advanced understanding of celestial movements.',
      difficulty: 'Intermediate',
      color: 'from-yellow-600 to-orange-600'
    },
    {
      id: 3,
      name: 'Defender',
      culture: 'Feudal Japan',
      description: 'Embody the samurai code of honor and protection. Learn about bushido while defending villages from invasion.',
      difficulty: 'Advanced',
      color: 'from-red-600 to-pink-600'
    },
    {
      id: 4,
      name: 'Lasat Starfighter',
      culture: 'Norse Mythology',
      description: 'Experience the epic battles of Ragnarok. Master the fierce warrior culture of the Vikings in space combat.',
      difficulty: 'Master',
      color: 'from-purple-600 to-indigo-600'
    }
  ];

  const handleStageSelect = (stageId: number) => {
    if (unlockedStages >= stageId) {
      setCurrentStage(stageId);
      setCurrentScreen('game');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-black p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Choose Your Cultural Journey</h1>
          <p className="text-gray-300 text-lg">
            Progress through gaming evolution while learning about world cultures
          </p>
          <Button 
            onClick={() => setCurrentScreen('menu')}
            variant="outline"
            className="mt-4 border-white/20 text-white"
          >
            ← Back to Menu
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stages.map((stage) => {
            const isUnlocked = unlockedStages >= stage.id;
            const highScore = highScores[stage.id];

            return (
              <Card 
                key={stage.id}
                className={`${
                  isUnlocked 
                    ? 'bg-black/60 border-white/20 hover:border-white/40 cursor-pointer transform hover:scale-105 transition-all' 
                    : 'bg-gray-900/60 border-gray-600/20 cursor-not-allowed opacity-50'
                }`}
                onClick={() => handleStageSelect(stage.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl text-white flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${stage.color} flex items-center justify-center text-white font-bold`}>
                        {isUnlocked ? stage.id : <Lock size={16} />}
                      </div>
                      {stage.name}
                    </CardTitle>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">{stage.difficulty}</div>
                      {highScore && (
                        <div className="text-xs text-yellow-400">Best: {highScore}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-lg text-purple-300">{stage.culture}</div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 text-sm mb-4">
                    {stage.description}
                  </p>
                  
                  {isUnlocked ? (
                    <Button 
                      className={`w-full bg-gradient-to-r ${stage.color} hover:opacity-90`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStageSelect(stage.id);
                      }}
                    >
                      Start Journey
                    </Button>
                  ) : (
                    <div className="text-center text-gray-500 text-sm">
                      Complete previous stage to unlock
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Local Multiplayer Info */}
        <Card className="mt-8 bg-gradient-to-r from-green-900/50 to-teal-900/50 border-green-500/30">
          <CardContent className="p-6 text-center">
            <h3 className="text-white font-semibold mb-2">🎮 Local Multiplayer</h3>
            <p className="text-gray-300">
              Share the couch and learn together! Most stages support two players on the same device.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
