import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type PerformancePreset = 'battery' | 'balanced' | 'performance';

interface SettingsState {
  graphicsQuality: GraphicsQuality;
  fpsCap: 30 | 45 | 60;
  enableDprScaling: boolean;
  hapticsEnabled: boolean;
  preset: PerformancePreset;
  reduceMotion: boolean;
  isMobileDefaulted: boolean;
  setGraphicsQuality: (q: GraphicsQuality) => void;
  setFpsCap: (fps: 30 | 45 | 60) => void;
  setEnableDprScaling: (enable: boolean) => void;
  setHapticsEnabled: (enable: boolean) => void;
  setPreset: (preset: PerformancePreset) => void;
  setReduceMotion: (enable: boolean) => void;
  applyMobileDefaultsOnce: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      graphicsQuality: 'medium',
      fpsCap: 60,
      enableDprScaling: true,
      hapticsEnabled: true,
      preset: 'balanced',
      reduceMotion: false,
      isMobileDefaulted: false,
      setGraphicsQuality: (graphicsQuality) => set({ graphicsQuality }),
      setFpsCap: (fpsCap) => set({ fpsCap }),
      setEnableDprScaling: (enableDprScaling) => set({ enableDprScaling }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setPreset: (preset) => {
        // Map presets to settings
        if (preset === 'battery') {
          set({ preset, fpsCap: 30, graphicsQuality: 'low', enableDprScaling: true });
        } else if (preset === 'balanced') {
          set({ preset, fpsCap: 45, graphicsQuality: 'medium', enableDprScaling: true });
        } else {
          set({ preset, fpsCap: 60, graphicsQuality: 'high', enableDprScaling: true });
        }
      },
      applyMobileDefaultsOnce: () => {
        if (get().isMobileDefaulted) return;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          set({ preset: 'balanced', graphicsQuality: 'medium', fpsCap: 45, enableDprScaling: true, isMobileDefaulted: true });
        } else {
          set({ isMobileDefaulted: true });
        }
      },
    }),
    {
      name: 'cultural-arcade-settings',
    }
  )
);


