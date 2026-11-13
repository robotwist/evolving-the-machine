import type { AudioOptions, AudioState, WindowExtensions } from '@shared/types';

function getAudio(): AudioState | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as WindowExtensions).__CULTURAL_ARCADE_AUDIO__;
}

function withAudio(action: (audio: AudioState) => void, label: string) {
  try {
    const audio = getAudio();
    if (audio && !audio.isMuted) action(audio);
  } catch (e) {
    console.warn(`${label} sound failed:`, e);
  }
}

export function playStinger(stinger: string) {
  withAudio(audio => audio.playStinger(stinger), stinger);
}

export function playVO(text: string, options: AudioOptions = {}) {
  withAudio(audio => audio.playVO(text, options), 'Voice');
}

export function playHit() {
  withAudio(audio => audio.playHit(), 'Hit');
}

export function playSuccess() {
  withAudio(audio => audio.playSuccess(), 'Success');
}

export function isAudioMuted(): boolean {
  return getAudio()?.isMuted ?? true;
}
