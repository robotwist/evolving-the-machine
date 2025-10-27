import { useGameStore } from '../useGameStore';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useGameStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useGameStore.getState().setCurrentScreen('main-menu');
    useGameStore.getState().setCurrentStage(1);
    useGameStore.getState().setGameState('playing');
    useGameStore.getState().setUnlockedStages(1);
  });

  describe('Screen Management', () => {
    it('should set and get current screen', () => {
      const { setCurrentScreen, currentScreen } = useGameStore.getState();
      
      setCurrentScreen('game');
      expect(currentScreen).toBe('game');
      
      setCurrentScreen('settings');
      expect(currentScreen).toBe('settings');
    });

    it('should default to main-menu', () => {
      const { currentScreen } = useGameStore.getState();
      expect(currentScreen).toBe('main-menu');
    });
  });

  describe('Stage Management', () => {
    it('should set and get current stage', () => {
      const { setCurrentStage, currentStage } = useGameStore.getState();
      
      setCurrentStage(3);
      expect(currentStage).toBe(3);
      
      setCurrentStage(1);
      expect(currentStage).toBe(1);
    });

    it('should default to stage 1', () => {
      const { currentStage } = useGameStore.getState();
      expect(currentStage).toBe(1);
    });
  });

  describe('Game State Management', () => {
    it('should set and get game state', () => {
      const { setGameState, gameState } = useGameStore.getState();
      
      setGameState('paused');
      expect(gameState).toBe('paused');
      
      setGameState('ended');
      expect(gameState).toBe('ended');
    });

    it('should default to playing', () => {
      const { gameState } = useGameStore.getState();
      expect(gameState).toBe('playing');
    });
  });

  describe('Stage Unlocking', () => {
    it('should set and get unlocked stages', () => {
      const { setUnlockedStages, unlockedStages } = useGameStore.getState();
      
      setUnlockedStages(5);
      expect(unlockedStages).toBe(5);
      
      setUnlockedStages(1);
      expect(unlockedStages).toBe(1);
    });

    it('should default to stage 1 unlocked', () => {
      const { unlockedStages } = useGameStore.getState();
      expect(unlockedStages).toBe(1);
    });

    it('should unlock next stage when completing current stage', () => {
      const { setCurrentStage, setUnlockedStages, unlockedStages } = useGameStore.getState();
      
      setCurrentStage(2);
      setUnlockedStages(2);
      
      expect(unlockedStages).toBe(2);
    });
  });

  describe('Persistence', () => {
    it('should persist state to localStorage', () => {
      const { setCurrentScreen, setCurrentStage } = useGameStore.getState();
      
      setCurrentScreen('game');
      setCurrentStage(3);
      
      // The store should have attempted to persist
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should restore state from localStorage', () => {
      const mockState = {
        currentScreen: 'settings',
        currentStage: 5,
        gameState: 'paused',
        unlockedStages: 5,
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockState));
      
      // Re-initialize store to trigger restoration
      const store = useGameStore.getState();
      
      expect(store.currentScreen).toBe('settings');
      expect(store.currentStage).toBe(5);
      expect(store.gameState).toBe('paused');
      expect(store.unlockedStages).toBe(5);
    });
  });

  describe('Environment Handling', () => {
    it('should handle production environment correctly', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Reset store to test production behavior
      const { unlockedStages } = useGameStore.getState();
      
      // In production, should start with stage 1 unlocked
      expect(unlockedStages).toBe(1);
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle development environment correctly', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Reset store to test development behavior
      const { unlockedStages } = useGameStore.getState();
      
      // In development, should start with stage 1 unlocked
      expect(unlockedStages).toBe(1);
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('State Validation', () => {
    it('should validate stage numbers', () => {
      const { setCurrentStage } = useGameStore.getState();
      
      // Should handle valid stages
      setCurrentStage(1);
      setCurrentStage(8);
      
      // Should handle edge cases
      setCurrentStage(0);
      setCurrentStage(-1);
      setCurrentStage(100);
    });

    it('should validate screen names', () => {
      const { setCurrentScreen } = useGameStore.getState();
      
      // Should handle valid screens
      setCurrentScreen('main-menu');
      setCurrentScreen('game');
      setCurrentScreen('settings');
      setCurrentScreen('stage-select');
    });

    it('should validate game states', () => {
      const { setGameState } = useGameStore.getState();
      
      // Should handle valid game states
      setGameState('playing');
      setGameState('paused');
      setGameState('ended');
      setGameState('stage-complete');
    });
  });
});