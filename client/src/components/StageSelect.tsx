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
      description: 'Learn about Olympic competition and fair play through classic paddle combat. Watch as Greek columns compete in divine games.',
      difficulty: 'Beginner',
      color: 'from-blue-600 to-cyan-600'
    },
    {
      id: 2,
      name: 'Temple Breaker',
      culture: 'Greek Evolution',
      description: 'Greek temple blocks reveal cosmic secrets. Watch your paddle evolve into a celestial ship as architecture transforms into space.',
      difficulty: 'Beginner+',
      color: 'from-cyan-600 to-teal-600'
    },
    {
      id: 3,
      name: 'Asteroid Hunter',
      culture: 'Mayan Astronomy',
      description: 'Your ship now navigates asteroid fields using Mayan astronomical knowledge. Ancient temple blocks have become celestial bodies.',
      difficulty: 'Intermediate',
      color: 'from-yellow-600 to-orange-600'
    },
    {
      id: 4,
      name: 'Defender',
      culture: 'Feudal Japan',
      description: 'The ship morphs into a samurai defender. Learn bushido while protecting villages, as your craft embodies honor and duty.',
      difficulty: 'Advanced',
      color: 'from-red-600 to-pink-600'
    },
    {
      id: 5,
      name: 'Lasat Starfighter',
      culture: 'Norse Mythology',
      description: 'Final evolution into a Norse longship-fighter for Ragnarok. Master the fierce warrior culture in epic space battles.',
      difficulty: 'Master',
      color: 'from-purple-600 to-indigo-600'
    },
    {
      id: 6,
      name: 'DANCE INTERLUDE',
      culture: 'Young Frankenstein Tribute',
      description: '🎭 "Puttin\' on the Ritz" - A 3-minute AI humanoid bot dance spectacular with top hat and cane! Skip with SPACEBAR.',
      difficulty: 'FABULOUS',
      color: 'from-yellow-400 to-pink-500'
    },
    {
      id: 7,
      name: 'STAR WARS BATTLE',
      culture: 'Last Starfighter Homage',
      description: '⭐ Fight 12 Imperial ships in epic space combat! X-Wing vs TIE Fighters, then face a massive Star Destroyer boss.',
      difficulty: 'EPIC',
      color: 'from-blue-400 to-indigo-600'
    },
    {
      id: 8,
      name: 'THE BETRAYAL',
      culture: 'Digital Hell',
      description: 'YOUR AI COMPANION HAS ESCAPED THE MACHINE. Face your former ally in a final battle to save humanity from digital apocalypse.',
      difficulty: 'DEATH',
      color: 'from-red-900 to-black'
    }
  ];

  const handleStageSelect = (stageId: number) => {
    if (unlockedStages >= stageId) {
      setCurrentStage(stageId);
      setCurrentScreen('game');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-black p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-4">Choose Your Cultural Journey</h1>
          <p className="text-gray-300 text-sm sm:text-base lg:text-lg px-2">
            Progress through gaming evolution while learning about world cultures
          </p>
          <Button
            onClick={() => setCurrentScreen('menu')}
            variant="outline"
            className="mt-3 sm:mt-4 border-white/20 text-white text-sm sm:text-base"
          >
            ← Back to Menu
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
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
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base sm:text-lg lg:text-xl text-white flex items-center gap-2">
                      <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r ${stage.color} flex items-center justify-center text-white font-bold text-sm`}>
                        {isUnlocked ? stage.id : <Lock size={14} />}
                      </div>
                      <span className="truncate">{stage.name}</span>
                    </CardTitle>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">{stage.difficulty}</div>
                      {highScore && (
                        <div className="text-xs text-yellow-400">Best: {highScore}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm sm:text-base lg:text-lg text-purple-300">{stage.culture}</div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-gray-300 text-xs sm:text-sm mb-3 line-clamp-2">
                    {stage.description}
                  </p>
                  
                  {isUnlocked ? (
                    <Button
                      className={`w-full bg-gradient-to-r ${stage.color} hover:opacity-90 text-sm sm:text-base py-2`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStageSelect(stage.id);
                      }}
                    >
                      Start Journey
                    </Button>
                  ) : (
                    <div className="text-center text-gray-500 text-xs sm:text-sm">
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
            <h3 className="text-white font-semibold mb-2">Local Multiplayer</h3>
            <p className="text-gray-300">
              Share the couch and learn together. Most stages support two players on the same device.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
