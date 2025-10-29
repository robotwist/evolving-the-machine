export interface AudioOptions {
  pitch?: number;
  rate?: number;
  haunting?: boolean;
}

export interface AudioState {
  isMuted: boolean;
  playVO: (text: string, options: AudioOptions) => void;
  playStinger: (stinger: string) => void;
  playSuccess: () => void;
  playHit: () => void;
}

export interface GameSettings {
  __CULTURAL_ARCADE_QUALITY__?: string;
  __CULTURAL_ARCADE_REDUCE_MOTION__?: boolean;
  __CULTURAL_ARCADE_SCREEN_SHAKE__?: boolean;
  __CULTURAL_ARCADE_HAPTICS__?: boolean;
  __CULTURAL_ARCADE_PARTICLES__?: boolean;
  __CULTURAL_ARCADE_FPS_CAP__?: number;
  __CULTURAL_ARCADE_HAPTICS_ENABLED__?: boolean;
  __CULTURAL_ARCADE_HIT_MARKERS__?: boolean;
  __CULTURAL_ARCADE_DAMAGE_NUMBERS__?: boolean;
}

export interface WindowExtensions {
  __CULTURAL_ARCADE_AUDIO__?: AudioState;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export interface HapticsAPI {
  vibrate: (pattern: string | number[]) => void;
}

export interface CollidableObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Global type declarations for browser APIs
declare global {
  interface Window {
    Blob: typeof Blob;
    FileReader: typeof FileReader;
    NodeJS?: any;
  }

  function btoa(data: string): string;
  function atob(data: string): string;
}
