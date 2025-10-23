import { renderHook, act } from '@testing-library/react';
import { useGameStore } from '../useGameStore';

describe('useGameStore', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset the store to initial state
    useGameStore.setState({
      currentScreen: 'menu',
      currentStage: 1,
      gameState: 'playing',
      unlockedStages: 1,
      stageAttempts: {},
    });
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useGameStore());

    expect(result.current.currentScreen).toBe('menu');
    expect(result.current.currentStage).toBe(1);
    expect(result.current.gameState).toBe('playing');
    expect(result.current.unlockedStages).toBe(1);
    expect(result.current.stageAttempts).toEqual({});
  });

  it('should set current screen', () => {
    const { result } = renderHook(() => useGameStore());

    act(() => {
      result.current.setCurrentScreen('stage-select');
    });

    expect(result.current.currentScreen).toBe('stage-select');
  });

  it('should set current stage and reset game state', () => {
    const { result } = renderHook(() => useGameStore());

    act(() => {
      result.current.setCurrentStage(3);
    });

    expect(result.current.currentStage).toBe(3);
    expect(result.current.gameState).toBe('playing');
  });

  it('should set game state', () => {
    const { result } = renderHook(() => useGameStore());

    act(() => {
      result.current.setGameState('paused');
    });

    expect(result.current.gameState).toBe('paused');
  });

  it('should unlock next stage correctly', () => {
    const { result } = renderHook(() => useGameStore());

    // Set current stage to 1 explicitly
    act(() => {
      result.current.setCurrentStage(1);
    });

    act(() => {
      result.current.unlockNextStage();
    });

    expect(result.current.unlockedStages).toBe(2);
  });

  it('should not decrease unlocked stages when unlocking', () => {
    const { result } = renderHook(() => useGameStore());

    // Set current stage to 1 explicitly
    act(() => {
      result.current.setCurrentStage(1);
    });

    // First unlock to stage 2
    act(() => {
      result.current.unlockNextStage();
    });

    expect(result.current.unlockedStages).toBe(2);

    // Set current stage to 3 and unlock again
    act(() => {
      result.current.setCurrentStage(3);
      result.current.unlockNextStage();
    });

    expect(result.current.unlockedStages).toBe(4); // Should be max(2, 3+1)
  });

  it('should advance to next stage correctly', () => {
    const { result } = renderHook(() => useGameStore());

    act(() => {
      result.current.goToNextStage();
    });

    expect(result.current.currentStage).toBe(2);
    expect(result.current.currentScreen).toBe('game');
    expect(result.current.gameState).toBe('playing');
  });

  it('should go to stage select when at max stage', () => {
    const { result } = renderHook(() => useGameStore());

    // Set to max stage (8)
    act(() => {
      result.current.setCurrentStage(8);
      result.current.goToNextStage();
    });

    expect(result.current.currentScreen).toBe('stage-select');
    expect(result.current.currentStage).toBe(8); // Should not advance beyond max
  });

  it('should reset progress correctly', () => {
    const { result } = renderHook(() => useGameStore());

    // Set some progress
    act(() => {
      result.current.setCurrentStage(5);
      result.current.unlockNextStage();
      result.current.incrementAttempt(1);
    });

    expect(result.current.currentStage).toBe(5);
    expect(result.current.unlockedStages).toBe(6);
    expect(result.current.stageAttempts[1]).toBe(1);

    // Reset progress
    act(() => {
      result.current.resetProgress();
    });

    expect(result.current.currentStage).toBe(1);
    expect(result.current.unlockedStages).toBe(1);
    expect(result.current.currentScreen).toBe('menu');
    expect(result.current.gameState).toBe('playing');
    expect(result.current.stageAttempts).toEqual({});
  });

  it('should increment stage attempts correctly', () => {
    const { result } = renderHook(() => useGameStore());

    act(() => {
      result.current.incrementAttempt(1);
      result.current.incrementAttempt(1);
      result.current.incrementAttempt(2);
    });

    expect(result.current.stageAttempts[1]).toBe(2);
    expect(result.current.stageAttempts[2]).toBe(1);
  });

  it('should persist state to localStorage', () => {
    const { result } = renderHook(() => useGameStore());

    act(() => {
      result.current.unlockNextStage();
      result.current.incrementAttempt(1);
    });

    // Check localStorage was written
    const stored = localStorage.getItem('cultural-arcade-game-store');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.state.unlockedStages).toBe(2);
    expect(parsed.state.stageAttempts[1]).toBe(1);
  });
});
