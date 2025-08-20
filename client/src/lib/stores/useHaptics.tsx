import { create } from 'zustand';

interface HapticsState {
  isEnabled: boolean;
  isSupported: boolean;
  enable: () => void;
  disable: () => void;
  vibrate: (pattern: number | number[]) => void;
  hit: () => void;
  explosion: () => void;
  powerup: () => void;
  success: () => void;
  failure: () => void;
  screenShake: () => void;
}

export const useHaptics = create<HapticsState>((set, get) => ({
  isEnabled: true,
  isSupported: 'vibrate' in navigator,
  
  enable: () => set({ isEnabled: true }),
  disable: () => set({ isEnabled: false }),
  
  vibrate: (pattern) => {
    const { isEnabled, isSupported } = get();
    if (!isEnabled || !isSupported) return;
    
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration failed:', e);
    }
  },
  
  // Short, sharp vibration for hits
  hit: () => {
    get().vibrate(50);
  },
  
  // Longer, stronger vibration for explosions
  explosion: () => {
    get().vibrate([0, 100, 50, 100]);
  },
  
  // Distinctive pattern for powerups
  powerup: () => {
    get().vibrate([0, 30, 50, 30, 50, 30]);
  },
  
  // Success vibration
  success: () => {
    get().vibrate([0, 50, 100, 50, 100]);
  },
  
  // Failure vibration
  failure: () => {
    get().vibrate([0, 200, 100, 200]);
  },
  
  // Screen shake vibration
  screenShake: () => {
    get().vibrate([0, 20, 20, 20, 20, 20]);
  }
}));
