import { create } from 'zustand';

interface SettingsState {
  // Graphics settings
  graphicsQuality: 'low' | 'medium' | 'high';
  fpsCap: 30 | 60 | 120 | 0;
  enableDprScaling: boolean;
  
  // Audio settings
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  reduceMotion: boolean;
  
  // Haptics settings
  hapticsEnabled: boolean;
  hapticsIntensity: 'low' | 'medium' | 'high';
  
  // Visual feedback settings
  hitMarkers: boolean;
  damageNumbers: boolean;
  comboCounters: boolean;
  screenShake: boolean;
  particles: boolean;
  
  // Voice settings
  voiceStyle: 'normal' | 'haunting' | 'glitch';
  
  // Current preset
  preset: 'custom' | 'performance' | 'quality' | 'mobile' | 'accessibility';
  
  // Internal state
  _mobileDefaultsApplied?: boolean;
  
  // Preset functions
  presets: {
    performance: () => void;
    quality: () => void;
    mobile: () => void;
    accessibility: () => void;
  };
  
  // Preset options for UI
  presetOptions: Array<{ value: string; label: string }>;
  
  // Actions
  setGraphicsQuality: (quality: 'low' | 'medium' | 'high') => void;
  setFpsCap: (fps: 30 | 60 | 120 | 0) => void;
  setEnableDprScaling: (enabled: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setVoiceVolume: (volume: number) => void;
  setReduceMotion: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setHapticsIntensity: (intensity: 'low' | 'medium' | 'high') => void;
  setHitMarkers: (enabled: boolean) => void;
  setDamageNumbers: (enabled: boolean) => void;
  setComboCounters: (enabled: boolean) => void;
  setScreenShake: (enabled: boolean) => void;
  setParticles: (enabled: boolean) => void;
  setVoiceStyle: (style: 'normal' | 'haunting' | 'glitch') => void;
  setPreset: (preset: 'custom' | 'performance' | 'quality' | 'mobile' | 'accessibility') => void;
  
  // Mobile defaults
  applyMobileDefaultsOnce: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Default values
  graphicsQuality: 'medium',
  fpsCap: 60,
  enableDprScaling: true,
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  voiceVolume: 0.9,
  reduceMotion: false,
  hapticsEnabled: true,
  hapticsIntensity: 'medium',
  hitMarkers: true,
  damageNumbers: true,
  comboCounters: true,
  screenShake: true,
  particles: true,
  voiceStyle: 'haunting',
  preset: 'custom',
  presetOptions: [
    { value: 'custom', label: 'Custom' },
    { value: 'performance', label: 'Performance' },
    { value: 'quality', label: 'Quality' },
    { value: 'mobile', label: 'Mobile' },
    { value: 'accessibility', label: 'Accessibility' }
  ],

  // Presets
  presets: {
    performance: () => set({
      graphicsQuality: 'low',
      fpsCap: 30,
      particles: false,
      screenShake: false,
      hitMarkers: false,
      damageNumbers: false
    }),
    quality: () => set({
      graphicsQuality: 'high',
      fpsCap: 60,
      particles: true,
      screenShake: true,
      hitMarkers: true,
      damageNumbers: true
    }),
    mobile: () => set({
      graphicsQuality: 'medium',
      fpsCap: 60,
      enableDprScaling: true,
      hapticsEnabled: true,
      hapticsIntensity: 'medium'
    }),
    accessibility: () => set({
      reduceMotion: true,
      screenShake: false,
      particles: false,
      hapticsEnabled: false,
      voiceVolume: 1.0
    })
  },

  // Actions
  setGraphicsQuality: (quality) => set({ graphicsQuality: quality }),
  setFpsCap: (fps) => set({ fpsCap: fps }),
  setEnableDprScaling: (enabled) => set({ enableDprScaling: enabled }),
  setMasterVolume: (volume) => set({ masterVolume: volume }),
  setMusicVolume: (volume) => set({ musicVolume: volume }),
  setSfxVolume: (volume) => set({ sfxVolume: volume }),
  setVoiceVolume: (volume) => set({ voiceVolume: volume }),
  setReduceMotion: (enabled) => set({ reduceMotion: enabled }),
  setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
  setHapticsIntensity: (intensity) => set({ hapticsIntensity: intensity }),
  setHitMarkers: (enabled) => set({ hitMarkers: enabled }),
  setDamageNumbers: (enabled) => set({ damageNumbers: enabled }),
  setComboCounters: (enabled) => set({ comboCounters: enabled }),
  setScreenShake: (enabled) => set({ screenShake: enabled }),
  setParticles: (enabled) => set({ particles: enabled }),
  setVoiceStyle: (style) => set({ voiceStyle: style }),
  setPreset: (preset) => set({ preset: preset }),
  
  // Mobile defaults
  applyMobileDefaultsOnce: () => {
    const state = get();
    if (!state._mobileDefaultsApplied) {
      set({
        enableDprScaling: true,
        hapticsEnabled: true,
        hapticsIntensity: 'medium',
        _mobileDefaultsApplied: true
      });
    }
  }
}));
