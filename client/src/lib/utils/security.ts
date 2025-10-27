import { ValidationError } from './validation';

// Security utilities for game development
export class SecurityError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

// Rate limiting for user actions
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(
    private maxAttempts: number,
    private windowMs: number
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Input sanitization for game data
export const gameSanitizers = {
  // Sanitize player input (movement, actions)
  playerInput: (input: unknown): { x: number; y: number; action: string } => {
    if (typeof input !== 'object' || input === null) {
      throw new SecurityError('Invalid input format', 'INVALID_INPUT');
    }

    const { x, y, action } = input as Record<string, unknown>;
    
    // Validate coordinates
    const xNum = typeof x === 'string' ? parseFloat(x) : Number(x);
    const yNum = typeof y === 'string' ? parseFloat(y) : Number(y);
    
    if (isNaN(xNum) || isNaN(yNum)) {
      throw new SecurityError('Invalid coordinates', 'INVALID_COORDINATES');
    }
    
    // Clamp coordinates to reasonable bounds
    const clampedX = Math.max(-10000, Math.min(10000, xNum));
    const clampedY = Math.max(-10000, Math.min(10000, yNum));
    
    // Validate action
    const validActions = ['move', 'shoot', 'pause', 'resume', 'action'];
    const sanitizedAction = typeof action === 'string' && validActions.includes(action) 
      ? action 
      : 'move';
    
    return { x: clampedX, y: clampedY, action: sanitizedAction };
  },

  // Sanitize game settings
  gameSettings: (settings: unknown): Record<string, unknown> => {
    if (typeof settings !== 'object' || settings === null) {
      throw new SecurityError('Invalid settings format', 'INVALID_SETTINGS');
    }

    const sanitized: Record<string, unknown> = {};
    const validKeys = ['volume', 'difficulty', 'quality', 'enableDprScaling', 'enableParticles'];
    
    for (const [key, value] of Object.entries(settings)) {
      if (validKeys.includes(key)) {
        // Sanitize based on key type
        switch (key) {
          case 'volume':
            const volume = Number(value);
            sanitized[key] = isNaN(volume) ? 50 : Math.max(0, Math.min(100, volume));
            break;
          case 'difficulty':
            const validDifficulties = ['easy', 'medium', 'hard'];
            sanitized[key] = validDifficulties.includes(String(value)) ? value : 'medium';
            break;
          case 'quality':
            const validQualities = ['low', 'medium', 'high'];
            sanitized[key] = validQualities.includes(String(value)) ? value : 'medium';
            break;
          case 'enableDprScaling':
          case 'enableParticles':
            sanitized[key] = Boolean(value);
            break;
          default:
            sanitized[key] = value;
        }
      }
    }
    
    return sanitized;
  },

  // Sanitize score data
  scoreData: (score: unknown): { stage: number; score: number; timestamp: number } => {
    if (typeof score !== 'object' || score === null) {
      throw new SecurityError('Invalid score format', 'INVALID_SCORE');
    }

    const { stage, score: scoreValue, timestamp } = score as Record<string, unknown>;
    
    // Validate stage
    const stageNum = typeof stage === 'string' ? parseInt(stage, 10) : Number(stage);
    if (isNaN(stageNum) || stageNum < 1 || stageNum > 8) {
      throw new SecurityError('Invalid stage number', 'INVALID_STAGE');
    }
    
    // Validate score value
    const scoreNum = typeof scoreValue === 'string' ? parseInt(scoreValue, 10) : Number(scoreValue);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 999999999) {
      throw new SecurityError('Invalid score value', 'INVALID_SCORE_VALUE');
    }
    
    // Validate timestamp
    const timestampNum = typeof timestamp === 'string' ? parseInt(timestamp, 10) : Number(timestamp);
    const now = Date.now();
    if (isNaN(timestampNum) || timestampNum < now - 86400000 || timestampNum > now + 3600000) {
      throw new SecurityError('Invalid timestamp', 'INVALID_TIMESTAMP');
    }
    
    return {
      stage: stageNum,
      score: scoreNum,
      timestamp: timestampNum
    };
  }
};

// Security validators for game-specific data
export const gameValidators = {
  // Validate game state transitions
  gameStateTransition: (from: string, to: string): boolean => {
    const validTransitions: Record<string, string[]> = {
      'playing': ['paused', 'ended', 'stage-complete'],
      'paused': ['playing', 'ended'],
      'ended': ['playing'],
      'stage-complete': ['playing', 'ended'],
      'start': ['playing'],
      'select': ['playing']
    };
    
    return validTransitions[from]?.includes(to) || false;
  },

  // Validate stage unlock requests
  stageUnlock: (currentStage: number, requestedStage: number): boolean => {
    // Can only unlock next stage or previous stages
    return requestedStage <= currentStage + 1 && requestedStage >= 1 && requestedStage <= 8;
  },

  // Validate input frequency (prevent spam)
  inputFrequency: (lastInput: number, currentTime: number, minInterval: number = 16): boolean => {
    return currentTime - lastInput >= minInterval;
  },

  // Validate canvas dimensions
  canvasDimensions: (width: number, height: number): boolean => {
    return width > 0 && height > 0 && width <= 4096 && height <= 4096;
  }
};

// Content Security Policy helpers
export const cspHelpers = {
  // Generate nonce for inline scripts
  generateNonce: (): string => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  },

  // Validate external resource URLs
  validateResourceUrl: (url: string, allowedDomains: string[] = []): boolean => {
    try {
      const urlObj = new URL(url);
      
      // Allow data URLs for assets
      if (urlObj.protocol === 'data:') {
        return true;
      }
      
      // Allow same origin
      if (urlObj.origin === window.location.origin) {
        return true;
      }
      
      // Check allowed domains
      return allowedDomains.some(domain => urlObj.hostname.endsWith(domain));
    } catch {
      return false;
    }
  }
};

// Anti-cheat measures
export const antiCheat = {
  // Detect impossible scores
  detectImpossibleScore: (score: number, stage: number, timeElapsed: number): boolean => {
    // Rough estimates of maximum possible scores per stage
    const maxScores = {
      1: 10000,   // Pong
      2: 50000,   // Breakout
      3: 75000,   // Asteroids
      4: 100000,  // Defender
      5: 150000,  // Lasat
      6: 20000,   // Dance Interlude
      7: 125000,  // Star Wars
      8: 100000   // Betrayal
    };
    
    const maxPossible = maxScores[stage as keyof typeof maxScores] || 100000;
    
    // Check if score is impossibly high
    if (score > maxPossible) {
      return true;
    }
    
    // Check if score was achieved too quickly (less than 30 seconds)
    if (timeElapsed < 30000 && score > maxPossible * 0.5) {
      return true;
    }
    
    return false;
  },

  // Detect rapid state changes (potential automation)
  detectRapidChanges: (timestamps: number[], threshold: number = 100): boolean => {
    if (timestamps.length < 3) return false;
    
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - timestamps[i - 1] < threshold) {
        return true;
      }
    }
    
    return false;
  },

  // Validate game progression
  validateProgression: (completedStages: number[], currentStage: number): boolean => {
    // Must have completed previous stages
    for (let i = 1; i < currentStage; i++) {
      if (!completedStages.includes(i)) {
        return false;
      }
    }
    
    return true;
  }
};

// Secure storage helpers
export const secureStorage = {
  // Encrypt sensitive data before storing
  encrypt: (data: string, key: string): string => {
    // Simple XOR encryption for demo purposes
    // In production, use proper encryption libraries
    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(
        data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return btoa(encrypted);
  },

  // Decrypt data after retrieving
  decrypt: (encryptedData: string, key: string): string => {
    try {
      const data = atob(encryptedData);
      let decrypted = '';
      for (let i = 0; i < data.length; i++) {
        decrypted += String.fromCharCode(
          data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return decrypted;
    } catch {
      throw new SecurityError('Failed to decrypt data', 'DECRYPTION_FAILED');
    }
  },

  // Secure storage with validation
  setSecureItem: (key: string, value: unknown, encryptionKey: string): void => {
    try {
      const serialized = JSON.stringify(value);
      const encrypted = secureStorage.encrypt(serialized, encryptionKey);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Failed to store secure item:', error);
      throw new SecurityError('Storage failed', 'STORAGE_FAILED');
    }
  },

  // Secure retrieval with validation
  getSecureItem: <T>(key: string, encryptionKey: string): T | null => {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      
      const decrypted = secureStorage.decrypt(encrypted, encryptionKey);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to retrieve secure item:', error);
      return null;
    }
  }
};

// Export rate limiters for different actions
export const rateLimiters = {
  // General user actions (10 per minute)
  userActions: new RateLimiter(10, 60000),
  
  // Score submissions (5 per minute)
  scoreSubmissions: new RateLimiter(5, 60000),
  
  // Settings changes (20 per minute)
  settingsChanges: new RateLimiter(20, 60000),
  
  // Game state changes (30 per minute)
  gameStateChanges: new RateLimiter(30, 60000)
};