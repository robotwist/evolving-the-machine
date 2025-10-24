// Input validation and sanitization utilities
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validators = {
  // Email validation
  email: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  // Username validation (3-20 chars, alphanumeric + underscore)
  username: (value: string): boolean => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(value);
  },

  // Safe text validation (no HTML/XSS)
  safeText: (value: string): boolean => {
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    return !dangerousPatterns.some(pattern => pattern.test(value));
  },

  // Numeric validation with range
  number: (value: string | number, min?: number, max?: number): boolean => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return false;
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
  },

  // URL validation
  url: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  // Required field validation
  required: (value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  },
};

// Sanitization functions
export const sanitizers = {
  // Remove HTML tags and dangerous content
  sanitizeHtml: (value: string): string => {
    return value
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>"'&]/g, (match) => {
        const entityMap: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
          '&': '&amp;',
        };
        return entityMap[match] || match;
      })
      .trim();
  },

  // Normalize whitespace
  normalizeWhitespace: (value: string): string => {
    return value.replace(/\s+/g, ' ').trim();
  },

  // Truncate to safe length
  truncate: (value: string, maxLength: number): string => {
    return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
  },
};

// Validation schemas for common forms
export const schemas = {
  userProfile: {
    username: [validators.required, validators.username],
    email: [validators.required, validators.email],
    displayName: [validators.safeText, (value: string) => value.length <= 50],
  },

  gameSettings: {
    volume: [validators.number, (value: string) => validators.number(value, 0, 100)],
    difficulty: [(value: string) => ['easy', 'medium', 'hard'].includes(value)],
    quality: [(value: string) => ['low', 'medium', 'high'].includes(value)],
  },
};

// Generic validation function
export function validate<T>(data: Record<string, unknown>, schema: Record<string, Array<(value: unknown) => boolean>>, fieldNames?: Record<string, string>): T {
  const errors: Array<{ field: string; message: string }> = [];
  const result = {} as T;

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    const fieldName = fieldNames?.[field] || field;

    for (const rule of rules) {
      try {
        if (!rule(value)) {
          errors.push({
            field,
            message: `${fieldName} is invalid`,
          });
          break;
        }
      } catch {
        errors.push({
          field,
          message: `${fieldName} validation failed`,
        });
        break;
      }
    }

    if (!errors.some(e => e.field === field)) {
      result[field as keyof T] = value as T[keyof T];
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(
      `Validation failed: ${errors.map(e => e.message).join(', ')}`,
      errors[0].field
    );
  }

  return result;
}

// Game-specific validation
export const gameValidation = {
  // Validate stage number
  stage: (stage: unknown): number => {
    const num = typeof stage === 'string' ? parseInt(stage, 10) : Number(stage);
    if (isNaN(num) || num < 1 || num > 8) {
      throw new ValidationError('Invalid stage number. Must be between 1 and 8.');
    }
    return num;
  },

  // Validate score
  score: (score: unknown): number => {
    const num = typeof score === 'string' ? parseInt(score, 10) : Number(score);
    if (isNaN(num) || num < 0) {
      throw new ValidationError('Invalid score. Must be a positive number.');
    }
    return num;
  },

  // Validate game state
  gameState: (state: unknown): 'playing' | 'paused' | 'ended' | 'stage-complete' => {
    const validStates = ['playing', 'paused', 'ended', 'stage-complete'];
    if (typeof state !== 'string' || !validStates.includes(state)) {
      throw new ValidationError('Invalid game state.');
    }
    return state as 'playing' | 'paused' | 'ended' | 'stage-complete';
  },
};
