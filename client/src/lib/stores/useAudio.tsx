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
  playVO: (text: string, opts?: { rate?: number; pitch?: number; volume?: number; distortion?: boolean; haunting?: boolean }) => Promise<void>;
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
  // Enhanced VO with digital distortion and Sinistar-like effects
  playVO: async (text: string, opts?: { rate?: number; pitch?: number; volume?: number; distortion?: boolean; haunting?: boolean }) => {
    const { isMuted, backgroundMusic } = get();
    if (isMuted) return;
    try {
      const originalVolume = backgroundMusic ? backgroundMusic.volume : 0;
      if (backgroundMusic) backgroundMusic.volume = Math.max(0, originalVolume * 0.35);
      await new Promise<void>((resolve) => {
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = opts?.rate ?? (opts?.haunting ? 0.75 : 0.92);
        utt.pitch = opts?.pitch ?? (opts?.haunting ? 0.6 : 0.8);
        utt.volume = opts?.volume ?? 1.0;
        utt.onend = () => {
          if (backgroundMusic) backgroundMusic.volume = originalVolume;
          resolve();
        };
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length) {
          // Prefer deeper, more masculine voices for haunting effect
          const deepVoice = voices.find(v => v.name.includes('Deep') || v.name.includes('Male') || v.name.includes('David') || v.name.includes('James')) || voices[0];
          utt.voice = deepVoice;
        }
        // Enhanced digital distortion effects
        try {
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            if (opts?.haunting) {
              // Sinistar-like haunting effects
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              const filter = ctx.createBiquadFilter();
              const distortion = ctx.createWaveShaper();
              
              // Create distortion curve for digital garbling
              const curve = new Float32Array(44100);
              for (let i = 0; i < 44100; i++) {
                const x = (i * 2) / 44100 - 1;
                curve[i] = (Math.PI + x) * Math.tan(Math.PI * x) / (Math.PI + x * x);
              }
              distortion.curve = curve;
              
              osc.type = 'sawtooth';
              osc.frequency.value = 180;
              filter.type = 'lowpass';
              filter.frequency.value = 400;
              filter.Q.value = 8;
              
              gain.gain.setValueAtTime(0, ctx.currentTime);
              gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
              gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
              
              osc.connect(filter).connect(distortion).connect(gain).connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.8);
              
              // Add intermittent digital glitches
              const glitchOsc = ctx.createOscillator();
              const glitchGain = ctx.createGain();
              glitchOsc.type = 'square';
              glitchOsc.frequency.value = 800;
              glitchGain.gain.setValueAtTime(0, ctx.currentTime);
              
              // Random glitch bursts
              for (let i = 0; i < 3; i++) {
                const glitchTime = ctx.currentTime + 0.2 + (i * 0.15);
                glitchGain.gain.setValueAtTime(0.03, glitchTime);
                glitchGain.gain.setValueAtTime(0, glitchTime + 0.05);
              }
              
              glitchOsc.connect(glitchGain).connect(ctx.destination);
              glitchOsc.start();
              glitchOsc.stop(ctx.currentTime + 0.8);
              
              setTimeout(() => ctx.close(), 1000);
            } else {
              // Standard glitch beep for non-haunting VO
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
          }
        } catch {}
        window.speechSynthesis.speak(utt);
      });
    } catch (e) {
      console.log('VO failed', e);
    }
  }
  ,
  playStinger: (type: 'start' | 'clear' | 'fail' | 'hit' | 'pop' | 'defender_shoot' | 'defender_explosion' | 'starwars_laser' | 'starwars_explosion' | 'arcade_hit' | 'arcade_powerup') => {
    const { isMuted } = get();
    if (isMuted) return;
    
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      // Classic arcade sound effects
      switch (type) {
        case 'start':
          // Defender-style start sound
          oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
          break;
        case 'clear':
          // Star Wars arcade victory sound
          oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);
          gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
          break;
        case 'fail':
          // Classic arcade death sound
          oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
          gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
          break;
        case 'hit':
          // Defender-style hit sound
          oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
          break;
        case 'pop':
          // Quick pop sound
          oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.05);
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
          break;
        case 'defender_shoot':
          // Authentic Defender shooting sound
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.08);
          gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2000, audioCtx.currentTime);
          break;
        case 'defender_explosion':
          // Defender explosion with noise
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.4);
          gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, audioCtx.currentTime);
          break;
        case 'starwars_laser':
          // Star Wars arcade laser sound
          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.12);
          gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(300, audioCtx.currentTime);
          break;
        case 'starwars_explosion':
          // Star Wars arcade explosion
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.5);
          gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(600, audioCtx.currentTime);
          break;
        case 'arcade_hit':
          // Classic arcade hit sound
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
          break;
        case 'arcade_powerup':
          // Classic arcade powerup sound
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.2);
          gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
          break;
      }
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
      setTimeout(() => audioCtx.close(), 550);
    } catch (e) {
      // Audio system not available
    }
  },
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
