import '@testing-library/jest-dom';

// Mock canvas context for game tests
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    strokeRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    getImageData: jest.fn(),
    putImageData: jest.fn(),
    createLinearGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
    createRadialGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
    fillStyle: '#000',
    strokeStyle: '#000',
    font: '16px Inter',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1,
    canvas: {
      width: 800,
      height: 600,
    },
  }),
});

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 16);
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

// Mock performance.now for consistent timing in tests
let mockTime = 0;
Object.defineProperty(global.performance, 'now', {
  value: () => mockTime += 16,
});

// Mock Audio API
class MockAudio {
  src = '';
  volume = 1;
  loop = false;
  preload = 'auto';
  oncanplaythrough: (() => void) | null = null;
  onerror: (() => void) | null = null;

  play() {
    return Promise.resolve();
  }

  pause() {}

  cloneNode() {
    return new MockAudio();
  }
}

global.Audio = MockAudio as unknown as typeof global.Audio;

// Mock Image constructor
class MockImage {
  src = '';
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

global.Image = MockImage as unknown as typeof global.Image;

// Mock fetch for asset loading tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
) as jest.Mock;

// Mock Web Audio API
class MockAudioContext {
  createGain() {
    return {
      gain: { value: 1 },
      connect: jest.fn(),
    };
  }

  createOscillator() {
    return {
      frequency: { value: 440 },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
  }

  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { value: 1000 },
      Q: { value: 1 },
      connect: jest.fn(),
    };
  }

  createWaveShaper() {
    return {
      curve: null,
      connect: jest.fn(),
    };
  }

  destination = {};
}

global.AudioContext = MockAudioContext as unknown as typeof global.AudioContext;
(global as unknown as { webkitAudioContext: typeof global.AudioContext }).webkitAudioContext = MockAudioContext as unknown as typeof global.AudioContext;

// Mock Speech Synthesis API
(global as unknown as { speechSynthesis: typeof global.speechSynthesis }).speechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getVoices: () => [],
  onvoiceschanged: null,
  paused: false,
  pending: false,
  speaking: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
};

// Mock navigator.vibrate for haptic feedback tests
Object.defineProperty(navigator, 'vibrate', {
  value: jest.fn(),
  writable: true,
});

// Mock console methods to avoid noise in tests
const originalConsole = global.console;
beforeEach(() => {
  global.console = {
    ...originalConsole,
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterEach(() => {
  global.console = originalConsole;
});

