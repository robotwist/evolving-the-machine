import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { 
  stateManager, 
  createAction, 
  ActionTypes, 
  scoreSelectors,
  stateSynchronizer,
  statePersistenceManager,
  stateDebugger,
  StateAction
} from './stateManagement';
import { gameValidation } from '../utils/validation';
import { antiCheat, rateLimiters } from '../utils/security';

// Enhanced Score Store Interface
interface ScoreStore {
  // State
  scores: Record<number, number>;
  highScores: Record<number, number>;
  
  // Enhanced state
  scoreHistory: Array<{
    stage: number;
    score: number;
    timestamp: number;
    sessionId: string;
    difficulty: string;
    playTime: number;
  }>;
  
  // Statistics
  statistics: {
    totalScore: number;
    averageScore: number;
    bestStage: number;
    worstStage: number;
    totalPlayTime: number;
    averagePlayTime: number;
    completionRate: number;
    streakCount: number;
    longestStreak: number;
  };
  
  // Achievements
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    unlockedAt: number;
    progress: number;
    maxProgress: number;
  }>;
  
  // Leaderboards (local)
  leaderboards: Record<number, Array<{
    score: number;
    timestamp: number;
    playerName: string;
  }>>;
  
  // Actions
  updateScore: (stage: number, score: number, playTime?: number) => void;
  resetScores: () => void;
  getHighScore: (stage: number) => number;
  getAllHighScores: () => Record<number, number>;
  
  // Enhanced actions
  addScoreEntry: (stage: number, score: number, playTime: number, sessionId: string, difficulty: string) => void;
  updateStatistics: () => void;
  checkAchievements: () => void;
  addToLeaderboard: (stage: number, score: number, playerName: string) => void;
  getLeaderboard: (stage: number) => Array<{ score: number; timestamp: number; playerName: string }>;
  
  // State management actions
  dispatch: (action: StateAction) => void;
  getStateSnapshot: () => ScoreStore;
  restoreStateSnapshot: (snapshot: Partial<ScoreStore>) => void;
}

// Create enhanced score store
export const useScoreStore = create<ScoreStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          scores: {},
          highScores: {},
          scoreHistory: [],
          statistics: {
            totalScore: 0,
            averageScore: 0,
            bestStage: 0,
            worstStage: 0,
            totalPlayTime: 0,
            averagePlayTime: 0,
            completionRate: 0,
            streakCount: 0,
            longestStreak: 0
          },
          achievements: [],
          leaderboards: {},
          
          // Enhanced actions
          updateScore: (stage, score, playTime = 0) => {
            const action = createAction(ActionTypes.UPDATE_SCORE, { stage, score, playTime });
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            try {
              // Validate inputs
              const validatedStage = gameValidation.stage(stage);
              const validatedScore = gameValidation.score(score);
              
              // Rate limiting
              if (!rateLimiters.scoreSubmissions.isAllowed('score-update')) {
                console.warn('Score update rate limited');
                return;
              }
              
              // Anti-cheat: detect impossible scores
              if (antiCheat.detectImpossibleScore(validatedScore, validatedStage, playTime)) {
                console.warn('Suspicious score detected:', { stage: validatedStage, score: validatedScore });
                return;
              }
              
              set((draft) => {
                const newScores = { ...draft.scores, [validatedStage]: validatedScore };
                const newHighScores = { ...draft.highScores };
                
                if (!newHighScores[validatedStage] || validatedScore > newHighScores[validatedStage]) {
                  newHighScores[validatedStage] = validatedScore;
                }
                
                draft.scores = newScores;
                draft.highScores = newHighScores;
                
                // Add to history
                draft.scoreHistory.push({
                  stage: validatedStage,
                  score: validatedScore,
                  timestamp: Date.now(),
                  sessionId: `session-${Date.now()}`,
                  difficulty: 'medium', // TODO: Get from game store
                  playTime
                });
                
                // Update statistics
                draft.statistics.totalScore = Object.values(draft.scores).reduce((sum, s) => sum + s, 0);
                draft.statistics.averageScore = draft.statistics.totalScore / Object.keys(draft.scores).length;
                
                // Update best/worst stages
                const stageScores = Object.entries(draft.scores).map(([stage, score]) => ({ stage: parseInt(stage), score }));
                if (stageScores.length > 0) {
                  const best = stageScores.reduce((max, current) => current.score > max.score ? current : max);
                  const worst = stageScores.reduce((min, current) => current.score < min.score ? current : min);
                  draft.statistics.bestStage = best.stage;
                  draft.statistics.worstStage = worst.stage;
                }
                
                // Update play time statistics
                draft.statistics.totalPlayTime += playTime;
                draft.statistics.averagePlayTime = draft.statistics.totalPlayTime / draft.scoreHistory.length;
                
                // Update completion rate
                const completedStages = Object.keys(draft.scores).length;
                draft.statistics.completionRate = (completedStages / 8) * 100; // Assuming 8 stages
                
                // Update streak
                const recentScores = draft.scoreHistory.slice(-10); // Last 10 scores
                let currentStreak = 0;
                for (let i = recentScores.length - 1; i >= 0; i--) {
                  if (recentScores[i].score > 0) {
                    currentStreak++;
                  } else {
                    break;
                  }
                }
                draft.statistics.streakCount = currentStreak;
                draft.statistics.longestStreak = Math.max(draft.statistics.longestStreak, currentStreak);
              });
              
              stateManager.handleActionComplete(processedAction, get());
              stateDebugger.logStateChange('scoreStore', processedAction, { scores: get().scores }, get());
              
              // Check achievements
              get().checkAchievements();
              
            } catch (error) {
              stateManager.handleActionError(error as Error, processedAction);
            }
          },
          
          resetScores: () => {
            const action = createAction(ActionTypes.RESET_SCORES);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              draft.scores = {};
              draft.highScores = {};
              draft.scoreHistory = [];
              draft.statistics = {
                totalScore: 0,
                averageScore: 0,
                bestStage: 0,
                worstStage: 0,
                totalPlayTime: 0,
                averagePlayTime: 0,
                completionRate: 0,
                streakCount: 0,
                longestStreak: 0
              };
              draft.achievements = [];
              draft.leaderboards = {};
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          getHighScore: (stage) => {
            return get().highScores[stage] || 0;
          },
          
          getAllHighScores: () => {
            return { ...get().highScores };
          },
          
          // Enhanced actions
          addScoreEntry: (stage, score, playTime, sessionId, difficulty) => {
            const action = createAction('ADD_SCORE_ENTRY', { stage, score, playTime, sessionId, difficulty });
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              draft.scoreHistory.push({
                stage,
                score,
                timestamp: Date.now(),
                sessionId,
                difficulty,
                playTime
              });
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          updateStatistics: () => {
            const action = createAction('UPDATE_STATISTICS');
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              const { scores, scoreHistory } = draft;
              
              // Recalculate all statistics
              draft.statistics.totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
              draft.statistics.averageScore = Object.keys(scores).length > 0 
                ? draft.statistics.totalScore / Object.keys(scores).length 
                : 0;
              
              // Best/worst stages
              const stageScores = Object.entries(scores).map(([stage, score]) => ({ stage: parseInt(stage), score }));
              if (stageScores.length > 0) {
                const best = stageScores.reduce((max, current) => current.score > max.score ? current : max);
                const worst = stageScores.reduce((min, current) => current.score < min.score ? current : min);
                draft.statistics.bestStage = best.stage;
                draft.statistics.worstStage = worst.stage;
              }
              
              // Play time statistics
              draft.statistics.totalPlayTime = scoreHistory.reduce((sum, entry) => sum + entry.playTime, 0);
              draft.statistics.averagePlayTime = scoreHistory.length > 0 
                ? draft.statistics.totalPlayTime / scoreHistory.length 
                : 0;
              
              // Completion rate
              draft.statistics.completionRate = (Object.keys(scores).length / 8) * 100;
              
              // Streak calculation
              let currentStreak = 0;
              let longestStreak = 0;
              for (const entry of scoreHistory) {
                if (entry.score > 0) {
                  currentStreak++;
                  longestStreak = Math.max(longestStreak, currentStreak);
                } else {
                  currentStreak = 0;
                }
              }
              draft.statistics.streakCount = currentStreak;
              draft.statistics.longestStreak = longestStreak;
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          checkAchievements: () => {
            const action = createAction('CHECK_ACHIEVEMENTS');
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              const { scores, statistics, achievements } = draft;
              const newAchievements = [...achievements];
              
              // Define achievements
              const achievementDefinitions = [
                {
                  id: 'first_score',
                  name: 'First Score',
                  description: 'Score your first points',
                  condition: () => Object.keys(scores).length >= 1,
                  progress: () => Object.keys(scores).length,
                  maxProgress: 1
                },
                {
                  id: 'high_scorer',
                  name: 'High Scorer',
                  description: 'Achieve a score over 10,000',
                  condition: () => Math.max(...Object.values(scores)) >= 10000,
                  progress: () => Math.max(...Object.values(scores), 0),
                  maxProgress: 10000
                },
                {
                  id: 'completionist',
                  name: 'Completionist',
                  description: 'Complete all 8 stages',
                  condition: () => Object.keys(scores).length >= 8,
                  progress: () => Object.keys(scores).length,
                  maxProgress: 8
                },
                {
                  id: 'streak_master',
                  name: 'Streak Master',
                  description: 'Achieve a 5-game streak',
                  condition: () => statistics.longestStreak >= 5,
                  progress: () => statistics.longestStreak,
                  maxProgress: 5
                }
              ];
              
              // Check each achievement
              for (const achievement of achievementDefinitions) {
                const existingIndex = newAchievements.findIndex(a => a.id === achievement.id);
                const isUnlocked = achievement.condition();
                const progress = achievement.progress();
                
                if (isUnlocked && existingIndex === -1) {
                  // New achievement unlocked
                  newAchievements.push({
                    id: achievement.id,
                    name: achievement.name,
                    description: achievement.description,
                    unlockedAt: Date.now(),
                    progress,
                    maxProgress: achievement.maxProgress
                  });
                } else if (existingIndex !== -1) {
                  // Update progress
                  newAchievements[existingIndex].progress = progress;
                }
              }
              
              draft.achievements = newAchievements;
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          addToLeaderboard: (stage, score, playerName) => {
            const action = createAction('ADD_TO_LEADERBOARD', { stage, score, playerName });
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              if (!draft.leaderboards[stage]) {
                draft.leaderboards[stage] = [];
              }
              
              draft.leaderboards[stage].push({
                score,
                timestamp: Date.now(),
                playerName
              });
              
              // Sort by score (descending) and keep top 10
              draft.leaderboards[stage].sort((a, b) => b.score - a.score);
              draft.leaderboards[stage] = draft.leaderboards[stage].slice(0, 10);
            });
            
            stateManager.handleActionComplete(processedAction, get());
          },
          
          getLeaderboard: (stage) => {
            return get().leaderboards[stage] || [];
          },
          
          // State management actions
          dispatch: (action) => {
            const processedAction = stateManager.processAction(action, get());
            if (!processedAction) return;
            
            switch (action.type) {
              case ActionTypes.UPDATE_SCORE:
                get().updateScore(action.payload.stage, action.payload.score, action.payload.playTime);
                break;
              case ActionTypes.RESET_SCORES:
                get().resetScores();
                break;
              default:
                console.warn('Unknown action type:', action.type);
            }
          },
          
          getStateSnapshot: () => {
            return { ...get() };
          },
          
          restoreStateSnapshot: (snapshot) => {
            const action = createAction('RESTORE_STATE_SNAPSHOT', snapshot);
            const processedAction = stateManager.processAction(action, get());
            
            if (!processedAction) return;
            
            set((draft) => {
              Object.assign(draft, snapshot);
            });
            
            stateManager.handleActionComplete(processedAction, get());
          }
        })),
        {
          name: 'cultural-arcade-score-store',
          partialize: (state) => ({
            scores: state.scores,
            highScores: state.highScores,
            scoreHistory: state.scoreHistory,
            statistics: state.statistics,
            achievements: state.achievements,
            leaderboards: state.leaderboards
          }),
          version: 2,
          migrate: (persistedState: any, version: number) => {
            if (version < 2) {
              // Add new fields for version 2
              return {
                ...persistedState,
                scoreHistory: [],
                statistics: {
                  totalScore: 0,
                  averageScore: 0,
                  bestStage: 0,
                  worstStage: 0,
                  totalPlayTime: 0,
                  averagePlayTime: 0,
                  completionRate: 0,
                  streakCount: 0,
                  longestStreak: 0
                },
                achievements: [],
                leaderboards: {}
              };
            }
            return persistedState;
          }
        }
      ),
      {
        name: 'score-store'
      }
    ),
    {
      name: 'ScoreStore'
    }
  )
);

// Register store with state manager
stateSynchronizer.registerStore('scoreStore', useScoreStore);

// Add persistence rules
statePersistenceManager.addPersistenceRule(
  'scoreStore',
  (state) => ({
    scores: state.scores,
    highScores: state.highScores,
    scoreHistory: state.scoreHistory,
    statistics: state.statistics,
    achievements: state.achievements,
    leaderboards: state.leaderboards
  }),
  (data) => data,
  2
);

// Export selectors
export { scoreSelectors };

// Export enhanced store
export default useScoreStore;
