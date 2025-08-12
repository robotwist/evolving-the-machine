import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GraphicsQuality = 'low' | 'medium' | 'high';

interface SettingsState {
  graphicsQuality: GraphicsQuality;
  fpsCap: 30 | 45 | 60;
  enableDprScaling: boolean;
  setGraphicsQuality: (q: GraphicsQuality) => void;
  setFpsCap: (fps: 30 | 45 | 60) => void;
  setEnableDprScaling: (enable: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      graphicsQuality: 'medium',
      fpsCap: 60,
      enableDprScaling: true,
      setGraphicsQuality: (graphicsQuality) => set({ graphicsQuality }),
      setFpsCap: (fpsCap) => set({ fpsCap }),
      setEnableDprScaling: (enableDprScaling) => set({ enableDprScaling }),
    }),
    {
      name: 'cultural-arcade-settings',
    }
  )
);


