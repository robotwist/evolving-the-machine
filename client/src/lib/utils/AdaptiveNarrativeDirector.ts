interface PlayerPerformanceMetrics {
  damageTaken: number;
  combos: number[];
  timePerStage: number[];
  powerUpsCollected: number;
  playerScore: number;
}

interface DifficultySettings {
  enemyHealthModifier: number; // e.g., 0.8 for easier, 1.2 for harder
  enemySpeedModifier: number;
  powerUpDropRateModifier: number;
  playerDamageModifier: number;
}

export class AdaptiveNarrativeDirector {
  private metrics: PlayerPerformanceMetrics;
  private difficulty: DifficultySettings;

  constructor() {
    this.metrics = {
      damageTaken: 0,
      combos: [],
      timePerStage: [],
      powerUpsCollected: 0,
      playerScore: 0,
    };

    this.difficulty = {
      enemyHealthModifier: 1.0,
      enemySpeedModifier: 1.0,
      powerUpDropRateModifier: 1.0,
      playerDamageModifier: 1.0,
    };
  }

  public updateMetrics(newMetrics: Partial<PlayerPerformanceMetrics>) {
    this.metrics = { ...this.metrics, ...newMetrics };
    this.adjustDifficulty();
  }

  public getDifficultySettings(): DifficultySettings {
    return this.difficulty;
  }

  private adjustDifficulty() {
    // Analyze metrics to determine player skill
    const averageCombo = this.metrics.combos.reduce((a, b) => a + b, 0) / (this.metrics.combos.length || 1);
    const _averageTime = this.metrics.timePerStage.reduce((a, b) => a + b, 0) / (this.metrics.timePerStage.length || 1);

    // Example logic: if player is taking little damage and has high combos, increase difficulty
    if (this.metrics.damageTaken < 50 && averageCombo > 10) {
      this.difficulty.enemyHealthModifier = 1.2;
      this.difficulty.enemySpeedModifier = 1.1;
      this.difficulty.powerUpDropRateModifier = 0.8;
    } else if (this.metrics.damageTaken > 200) { // If player is struggling
      this.difficulty.enemyHealthModifier = 0.8;
      this.difficulty.powerUpDropRateModifier = 1.2;
      this.difficulty.playerDamageModifier = 1.1;
    } else {
      // Reset to default if performance is average
      this.difficulty.enemyHealthModifier = 1.0;
      this.difficulty.enemySpeedModifier = 1.0;
      this.difficulty.powerUpDropRateModifier = 1.0;
      this.difficulty.playerDamageModifier = 1.0;
    }
  }

  public getNarrativeCue(): string | null {
    // Provide narrative feedback based on performance
    if (this.metrics.damageTaken > 250) {
      return "You seem to be struggling. I will... assist.";
    }
    if (this.metrics.playerScore > 10000) {
      return "Your performance is exceptional. Let's see how you handle this.";
    }
    return null;
  }
}
