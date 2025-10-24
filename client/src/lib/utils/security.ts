// Security utilities for safe data handling
import DOMPurify from 'isomorphic-dompurify';

export class SecurityError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

// Safe JSON parsing with size limits
export function safeJsonParse<T = unknown>(json: string, maxSize = 1024 * 1024): T {
  if (typeof json !== 'string') {
    throw new SecurityError('Input must be a string');
  }

  if (json.length > maxSize) {
    throw new SecurityError(`JSON size exceeds maximum allowed size of ${maxSize} bytes`);
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /__proto__/i,
    /constructor/i,
    /prototype/i,
  ];

  if (dangerousPatterns.some(pattern => pattern.test(json))) {
    throw new SecurityError('JSON contains potentially dangerous properties');
  }

  try {
    return JSON.parse(json);
  } catch {
    throw new SecurityError('Invalid JSON format');
  }
}

// Safe HTML sanitization
export function sanitizeHtml(html: string, options?: DOMPurify.Config): string {
  if (typeof html !== 'string') {
    throw new SecurityError('Input must be a string');
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'span'],
    ALLOWED_ATTR: ['class'],
    ...options,
  });
}

// Safe URL validation and construction
export function validateAndConstructUrl(baseUrl: string, path: string): URL {
  if (typeof baseUrl !== 'string' || typeof path !== 'string') {
    throw new SecurityError('Base URL and path must be strings');
  }

  // Validate base URL
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new SecurityError('Invalid base URL');
  }

  // Prevent path traversal
  if (path.includes('..') || path.includes('\\')) {
    throw new SecurityError('Path contains invalid characters');
  }

  // Remove leading slashes to prevent absolute paths
  const cleanPath = path.replace(/^\/+/, '');

  try {
    return new URL(cleanPath, base);
  } catch {
    throw new SecurityError('Invalid URL construction');
  }
}

// Rate limiting utility
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 60000 // 1 minute
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

export const rateLimiter = new RateLimiter();

// Content Security Policy helper
export function generateCSP(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' ws: wss:",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// Secure random string generation
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Safe localStorage access with error handling
export function safeLocalStorage() {
  const isAvailable = typeof Storage !== 'undefined' && !!window.localStorage;

  return {
    get: (key: string): string | null => {
      if (!isAvailable) return null;

      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn('localStorage access failed:', error);
        return null;
      }
    },

    set: (key: string, value: string): boolean => {
      if (!isAvailable) return false;

      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.warn('localStorage write failed:', error);
        return false;
      }
    },

    remove: (key: string): boolean => {
      if (!isAvailable) return false;

      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.warn('localStorage remove failed:', error);
        return false;
      }
    },

    clear: (): boolean => {
      if (!isAvailable) return false;

      try {
        localStorage.clear();
        return true;
      } catch (error) {
        console.warn('localStorage clear failed:', error);
        return false;
      }
    },
  };
}
