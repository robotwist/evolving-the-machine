// Game state management for LasatGame

export interface GameStateData {
  gameState: 'start' | 'playing' | 'gameOver' | 'select';
  lives: number;
  konamiCode: string[];
  konamiCodeSequence: string[];
  konamiCodeActivated: boolean;
  enemiesDefeated: number;
  bossDefeated: boolean;
}

export class LasatGameState {
  private gameState: 'start' | 'playing' | 'gameOver' | 'select' = 'start';
  private lives = 5;
  private konamiCode: string[] = [];
  private konamiCodeSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  private konamiCodeActivated = false;
  private enemiesDefeated = 0;
  private bossDefeated = false;

  constructor() {
    this.reset();
  }

  reset() {
    this.gameState = 'start';
    this.lives = 5;
    this.konamiCode = [];
    this.konamiCodeActivated = false;
    this.enemiesDefeated = 0;
    this.bossDefeated = false;
  }

  getState(): GameStateData {
    return {
      gameState: this.gameState,
      lives: this.lives,
      konamiCode: [...this.konamiCode],
      konamiCodeSequence: [...this.konamiCodeSequence],
      konamiCodeActivated: this.konamiCodeActivated,
      enemiesDefeated: this.enemiesDefeated,
      bossDefeated: this.bossDefeated
    };
  }

  setGameState(state: 'start' | 'playing' | 'gameOver' | 'select') {
    this.gameState = state;
  }

  getGameState(): 'start' | 'playing' | 'gameOver' | 'select' {
    return this.gameState;
  }

  loseLife() {
    this.lives = Math.max(0, this.lives - 1);
    if (this.lives <= 0) {
      this.gameState = 'gameOver';
    }
  }

  getLives(): number {
    return this.lives;
  }

  addEnemyDefeated() {
    this.enemiesDefeated++;
  }

  getEnemiesDefeated(): number {
    return this.enemiesDefeated;
  }

  setBossDefeated(defeated: boolean) {
    this.bossDefeated = defeated;
  }

  isBossDefeated(): boolean {
    return this.bossDefeated;
  }

  handleKonamiCodeInput(keyCode: string): boolean {
    if (this.konamiCodeActivated) return false;

    this.konamiCode.push(keyCode);
    
    // Keep only the last 10 inputs
    if (this.konamiCode.length > this.konamiCodeSequence.length) {
      this.konamiCode.shift();
    }

    // Check if sequence matches
    if (this.konamiCode.length === this.konamiCodeSequence.length) {
      const matches = this.konamiCode.every((key, index) => key === this.konamiCodeSequence[index]);
      if (matches) {
        this.konamiCodeActivated = true;
        this.playKonamiSuccessSound();
        return true;
      }
    }

    return false;
  }

  isKonamiCodeActivated(): boolean {
    return this.konamiCodeActivated;
  }

  private playKonamiSuccessSound() {
    try {
      const audioState = (window as any).__CULTURAL_ARCADE_AUDIO__;
      if (audioState && !audioState.isMuted) {
        audioState.playStinger('arcade_success');
      }
    } catch (e) {
      console.warn('Konami success sound failed:', e);
    }
  }

  handleStartScreenInput(keyCode: string): boolean {
    if (keyCode === 'Space' || keyCode === 'Enter') {
      this.gameState = 'select';
      return true;
    }
    return false;
  }

  handleGameOverInput(keyCode: string): boolean {
    if (keyCode === 'Space' || keyCode === 'Enter') {
      this.reset();
      this.gameState = 'start';
      return true;
    }
    return false;
  }

  handleSelectScreenInput(keyCode: string): boolean {
    if (keyCode === 'Space' || keyCode === 'Enter') {
      this.gameState = 'playing';
      return true;
    }
    return false;
  }
}
