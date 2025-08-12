import { create } from "zustand";

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  hitSound: HTMLAudioElement | null;
  successSound: HTMLAudioElement | null;
  isMuted: boolean;
  // VO helpers
  voGain?: GainNode | null;
  audioCtx?: AudioContext | null;
  duckingGain?: GainNode | null;
  
  // Setter functions
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setHitSound: (sound: HTMLAudioElement) => void;
  setSuccessSound: (sound: HTMLAudioElement) => void;
  
  // Control functions
  toggleMute: () => void;
  playHit: () => void;
  playSuccess: () => void;
  playVO: (text: string, opts?: { rate?: number; pitch?: number; volume?: number }) => Promise<void>;
  playStinger: (kind: 'start' | 'fail' | 'clear') => void;
  playSizzle: () => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  hitSound: null,
  successSound: null,
  isMuted: true, // Start muted by default
  
  setBackgroundMusic: (music) => set({ backgroundMusic: music }),
  setHitSound: (sound) => set({ hitSound: sound }),
  setSuccessSound: (sound) => set({ successSound: sound }),
  
  toggleMute: () => {
    const { isMuted } = get();
    const newMutedState = !isMuted;
    
    // Just update the muted state
    set({ isMuted: newMutedState });
    
    // Log the change
    console.log(`Sound ${newMutedState ? 'muted' : 'unmuted'}`);
  },
  
  playHit: () => {
    const { hitSound, isMuted } = get();
    if (hitSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Hit sound skipped (muted)");
        return;
      }
      
      // Clone the sound to allow overlapping playback
      const soundClone = hitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.3;
      soundClone.play().catch(error => {
        console.log("Hit sound play prevented:", error);
      });
    }
  },
  
  playSuccess: () => {
    const { successSound, isMuted } = get();
    if (successSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Success sound skipped (muted)");
        return;
      }
      
      successSound.currentTime = 0;
      successSound.play().catch(error => {
        console.log("Success sound play prevented:", error);
      });
    }
  }
  ,
  // Simple VO using SpeechSynthesis with gentle ducking
  playVO: async (text: string, opts?: { rate?: number; pitch?: number; volume?: number }) => {
    const { isMuted, backgroundMusic } = get();
    if (isMuted) return;
    try {
      const originalVolume = backgroundMusic ? backgroundMusic.volume : 0;
      if (backgroundMusic) backgroundMusic.volume = Math.max(0, originalVolume * 0.35);
      await new Promise<void>((resolve) => {
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = opts?.rate ?? 0.92;
        utt.pitch = opts?.pitch ?? 0.8;
        utt.volume = opts?.volume ?? 1.0;
        utt.onend = () => {
          if (backgroundMusic) backgroundMusic.volume = originalVolume;
          resolve();
        };
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length) {
          utt.voice = voices[0];
        }
        // tiny glitch beep
        try {
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = 520;
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.02);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.09);
            setTimeout(() => ctx.close(), 200);
          }
        } catch {}
        window.speechSynthesis.speak(utt);
      });
    } catch (e) {
      console.log('VO failed', e);
    }
  }
  ,
  playStinger: (kind: 'start' | 'fail' | 'clear') => {
    const { isMuted } = get();
    if (isMuted) return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'fail' ? 'sawtooth' : 'triangle';
      const now = ctx.currentTime;
      if (kind === 'start') {
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(520, now + 0.18);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.04);
        gain.gain.linearRampToValueAtTime(0, now + 0.22);
      } else if (kind === 'clear') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(660, now + 0.2);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.03);
        gain.gain.linearRampToValueAtTime(0, now + 0.25);
      } else {
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(160, now + 0.15);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + 0.18);
      }
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.3);
      setTimeout(() => ctx.close(), 350);
    } catch {}
  }
  ,
  playSizzle: () => {
    const { isMuted } = get();
    if (isMuted) return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const bufferSize = Math.floor(0.18 * ctx.sampleRate);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3200;
      bp.Q.value = 1.0;
      const gain = ctx.createGain();
      gain.gain.value = 0.06;
      noise.connect(bp).connect(gain).connect(ctx.destination);
      noise.start();
      noise.stop(ctx.currentTime + 0.18);
      setTimeout(() => ctx.close(), 280);
    } catch {}
  }
}));
