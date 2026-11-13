import type { HapticsAPI } from '@shared/types';
import { getGameSettings } from './settings';

const PRESETS = {
  hit: 50,
  explosion: [0, 100, 50, 100],
  powerup: [0, 30, 50, 30, 50, 30],
  success: [0, 50, 100, 50, 100],
  failure: [0, 200, 100, 200],
} satisfies Record<string, number | number[]>;

export type HapticPreset = keyof typeof PRESETS;

export function vibrate(pattern: HapticPreset | number | number[]) {
  if (typeof window === 'undefined' || !getGameSettings().hapticsEnabled) return;
  const haptics = (window as unknown as { __CULTURAL_ARCADE_HAPTICS__?: HapticsAPI }).__CULTURAL_ARCADE_HAPTICS__;
  try {
    haptics?.vibrate(typeof pattern === 'string' ? PRESETS[pattern] : pattern);
  } catch {
    // Vibration is best-effort
  }
}
