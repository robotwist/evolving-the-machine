import type { GameSettings } from '@shared/types';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GameSettingsSnapshot {
  fpsCap: number;
  quality: GraphicsQuality;
  reduceMotion: boolean;
  screenShake: boolean;
  particles: boolean;
  hapticsEnabled: boolean;
  hitMarkers: boolean;
  damageNumbers: boolean;
}

/**
 * Reads the player's settings, which main.tsx mirrors from the settings store
 * onto window globals. Read at call time so changes apply mid-game.
 */
export function getGameSettings(): GameSettingsSnapshot {
  const w = (typeof window !== 'undefined' ? window : {}) as GameSettings;
  const quality = w.__CULTURAL_ARCADE_QUALITY__;
  return {
    fpsCap: w.__CULTURAL_ARCADE_FPS_CAP__ ?? 60,
    quality: quality === 'low' || quality === 'high' ? quality : 'medium',
    reduceMotion: w.__CULTURAL_ARCADE_REDUCE_MOTION__ ?? false,
    screenShake: w.__CULTURAL_ARCADE_SCREEN_SHAKE__ ?? true,
    particles: w.__CULTURAL_ARCADE_PARTICLES__ ?? true,
    hapticsEnabled: w.__CULTURAL_ARCADE_HAPTICS_ENABLED__ ?? true,
    hitMarkers: w.__CULTURAL_ARCADE_HIT_MARKERS__ ?? true,
    damageNumbers: w.__CULTURAL_ARCADE_DAMAGE_NUMBERS__ ?? true,
  };
}

export function isScreenShakeAllowed(settings = getGameSettings()): boolean {
  return settings.screenShake && !settings.reduceMotion;
}
