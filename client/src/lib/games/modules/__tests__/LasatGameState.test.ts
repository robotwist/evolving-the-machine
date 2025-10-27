import { LasatGameState } from '../LasatGameState';

describe('LasatGameState', () => {
  let gameState: LasatGameState;

  beforeEach(() => {
    gameState = new LasatGameState();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(gameState.getGameState()).toBe('start');
      expect(gameState.getLives()).toBe(5);
      expect(gameState.getEnemiesDefeated()).toBe(0);
      expect(gameState.isBossDefeated()).toBe(false);
      expect(gameState.isKonamiCodeActivated()).toBe(false);
    });
  });

  describe('Game State Management', () => {
    it('should set and get game state', () => {
      gameState.setGameState('playing');
      expect(gameState.getGameState()).toBe('playing');

      gameState.setGameState('gameOver');
      expect(gameState.getGameState()).toBe('gameOver');
    });

    it('should handle life loss', () => {
      gameState.loseLife();
      expect(gameState.getLives()).toBe(4);

      gameState.loseLife();
      expect(gameState.getLives()).toBe(3);
    });

    it('should transition to gameOver when lives reach 0', () => {
      // Lose all lives
      for (let i = 0; i < 5; i++) {
        gameState.loseLife();
      }
      
      expect(gameState.getLives()).toBe(0);
      expect(gameState.getGameState()).toBe('gameOver');
    });
  });

  describe('Konami Code', () => {
    it('should track Konami code input', () => {
      const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
      
      // Enter partial sequence
      for (let i = 0; i < 5; i++) {
        const result = gameState.handleKonamiCodeInput(sequence[i]);
        expect(result).toBe(false);
      }

      // Complete the sequence
      for (let i = 5; i < sequence.length; i++) {
        const result = gameState.handleKonamiCodeInput(sequence[i]);
        if (i === sequence.length - 1) {
          expect(result).toBe(true);
          expect(gameState.isKonamiCodeActivated()).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }
    });

    it('should not accept Konami code after activation', () => {
      const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
      
      // Complete the sequence
      sequence.forEach(key => gameState.handleKonamiCodeInput(key));
      
      // Try to enter again
      const result = gameState.handleKonamiCodeInput('ArrowUp');
      expect(result).toBe(false);
    });

    it('should return correct Konami code status', () => {
      const state = gameState.getState();
      expect(state.konamiCodeActivated).toBe(false);
      expect(state.konamiCodeSequence).toHaveLength(10);
      expect(state.konamiCodeSequence[0]).toBe('ArrowUp');
    });
  });

  describe('Enemy Tracking', () => {
    it('should track defeated enemies', () => {
      gameState.addEnemyDefeated();
      expect(gameState.getEnemiesDefeated()).toBe(1);

      gameState.addEnemyDefeated();
      expect(gameState.getEnemiesDefeated()).toBe(2);
    });

    it('should track boss defeat', () => {
      gameState.setBossDefeated(true);
      expect(gameState.isBossDefeated()).toBe(true);

      gameState.setBossDefeated(false);
      expect(gameState.isBossDefeated()).toBe(false);
    });
  });

  describe('Screen Input Handling', () => {
    it('should handle start screen input', () => {
      const result = gameState.handleStartScreenInput('Space');
      expect(result).toBe(true);
      expect(gameState.getGameState()).toBe('select');

      gameState.setGameState('start');
      const result2 = gameState.handleStartScreenInput('Enter');
      expect(result2).toBe(true);
      expect(gameState.getGameState()).toBe('select');
    });

    it('should handle select screen input', () => {
      gameState.setGameState('select');
      
      const result = gameState.handleSelectScreenInput('Space');
      expect(result).toBe(true);
      expect(gameState.getGameState()).toBe('playing');

      gameState.setGameState('select');
      const result2 = gameState.handleSelectScreenInput('Enter');
      expect(result2).toBe(true);
      expect(gameState.getGameState()).toBe('playing');
    });

    it('should handle game over input', () => {
      gameState.setGameState('gameOver');
      
      const result = gameState.handleGameOverInput('Space');
      expect(result).toBe(true);
      expect(gameState.getGameState()).toBe('start');
      expect(gameState.getLives()).toBe(5); // Should reset
    });
  });

  describe('Reset Functionality', () => {
    it('should reset game state', () => {
      // Modify state
      gameState.setGameState('playing');
      gameState.loseLife();
      gameState.addEnemyDefeated();
      gameState.setBossDefeated(true);

      gameState.reset();

      expect(gameState.getGameState()).toBe('start');
      expect(gameState.getLives()).toBe(5);
      expect(gameState.getEnemiesDefeated()).toBe(0);
      expect(gameState.isBossDefeated()).toBe(false);
      expect(gameState.isKonamiCodeActivated()).toBe(false);
    });
  });
});
