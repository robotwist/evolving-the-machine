import React from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { useScoreStore } from '../lib/stores/useScoreStore';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function MainMenu() {
  const { setCurrentScreen } = useGameStore();
  const { highScores } = useScoreStore();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-900 via-blue-900 to-black p-4">
      <Card className="bg-black/80 border-purple-500/30 mb-8 max-w-4xl">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold text-white mb-2">
            Cultural Arcade Evolution
          </CardTitle>
          <p className="text-gray-300 text-lg">
            Journey through gaming history while discovering world cultures
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Master each era to unlock the next chapter of gaming evolution
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Game Stages Preview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { 
                stage: 1, 
                name: 'Pong Master', 
                culture: 'Ancient Greece',
                desc: 'Olympic paddle competition'
              },
              { 
                stage: 2, 
                name: 'Temple Breaker', 
                culture: 'Greek Evolution',
                desc: 'Columns become cosmic blocks'
              },
              { 
                stage: 3, 
                name: 'Asteroid Hunter', 
                culture: 'Mayan Astronomy',
                desc: 'Ship navigates celestial bodies'
              },
              { 
                stage: 4, 
                name: 'Defender', 
                culture: 'Feudal Japan',
                desc: 'Samurai protection duty'
              },
              { 
                stage: 5, 
                name: 'Lasat Starfighter', 
                culture: 'Norse Mythology',
                desc: 'Epic Ragnarok battles'
              }
            ].map(({ stage, name, culture, desc }) => (
              <div key={stage} className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  {stage}
                </div>
                <div className="text-white text-sm font-semibold">{name}</div>
                <div className="text-purple-300 text-xs">{culture}</div>
                <div className="text-gray-400 text-xs mt-1">{desc}</div>
                {highScores[stage] && (
                  <div className="text-yellow-400 text-xs mt-1">
                    Best: {highScores[stage]}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => setCurrentScreen('stage-select')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 text-lg"
            >
              Start Journey
            </Button>
            <Button 
              variant="outline" 
              className="border-purple-500/50 text-purple-300 hover:bg-purple-900/50 px-8 py-3 text-lg"
            >
              How to Play
            </Button>
          </div>

          {/* Cultural Learning Features */}
          <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-4 rounded-lg">
            <h3 className="text-white font-semibold mb-2">Learn Through Play</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
              <div>
                <div className="text-purple-300">🏛️ Ancient Greek Olympics</div>
                <div>Master competitive sportsmanship</div>
              </div>
              <div>
                <div className="text-blue-300">🌟 Mayan Astronomy</div>
                <div>Navigate by celestial knowledge</div>
              </div>
              <div>
                <div className="text-red-300">⚔️ Samurai Honor Code</div>
                <div>Protect with dignity and skill</div>
              </div>
              <div>
                <div className="text-yellow-300">🔥 Norse Ragnarok</div>
                <div>Epic battles of gods and giants</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
