import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GraphicsQuality = 'low' | 'medium' | 'high';

interface SettingsState {
  graphicsQuality: GraphicsQuality;
  fpsCap: 30 | 45 | 60;
  enableDprScaling: boolean;
  isMobileDefaulted: boolean;
  setGraphicsQuality: (q: GraphicsQuality) => void;
  setFpsCap: (fps: 30 | 45 | 60) => void;
  setEnableDprScaling: (enable: boolean) => void;
  applyMobileDefaultsOnce: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      graphicsQuality: 'medium',
      fpsCap: 60,
      enableDprScaling: true,
      isMobileDefaulted: false,
      setGraphicsQuality: (graphicsQuality) => set({ graphicsQuality }),
      setFpsCap: (fpsCap) => set({ fpsCap }),
      setEnableDprScaling: (enableDprScaling) => set({ enableDprScaling }),
      applyMobileDefaultsOnce: () => {
        if (get().isMobileDefaulted) return;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          set({ graphicsQuality: 'medium', fpsCap: 45, enableDprScaling: true, isMobileDefaulted: true });
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


