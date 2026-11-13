import React from 'react';
import { useSettingsStore } from '../lib/stores/useSettingsStore';

const SELECT_CLASS = 'bg-black border-2 border-white/30 px-2 py-0.5 text-lg text-white focus:border-neon-cyan focus:outline-none';
const CHECKBOX_CLASS = 'w-4 h-4 accent-[var(--neon-cyan)]';

export function SettingsForm() {
  const {
    preset,
    voiceStyle,
    graphicsQuality,
    fpsCap,
    enableDprScaling,
    reduceMotion,
    hapticsEnabled,
    particles,
    screenShake,
    setPreset,
    setVoiceStyle,
    setGraphicsQuality,
    setFpsCap,
    setEnableDprScaling,
    setReduceMotion,
    setHapticsEnabled,
    setParticles,
    setScreenShake,
    presetOptions
  } = useSettingsStore();

  return (
    <div className="arcade-panel panel-dim text-left mt-4 p-4">
      <h3 className="arcade-label text-neon-cyan mb-3">Settings</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-lg text-white/90">
        <label className="flex items-center justify-between gap-2">
          <span>Preset</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value as 'custom' | 'performance' | 'quality' | 'mobile' | 'accessibility')} className={SELECT_CLASS}>
            {presetOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
            <span>Voice Style</span>
            <select value={voiceStyle} onChange={(e) => setVoiceStyle(e.target.value as 'normal' | 'haunting' | 'glitch')} className={SELECT_CLASS}>
                <option value="normal">Normal</option>
                <option value="haunting">Haunting</option>
                <option value="glitch">Glitch</option>
            </select>
        </label>
        <label className="flex items-center justify-between gap-2">
            <span>Graphics Quality</span>
            <select value={graphicsQuality} onChange={(e) => setGraphicsQuality(e.target.value as 'low' | 'medium' | 'high')} className={SELECT_CLASS}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
            </select>
        </label>
        <label className="flex items-center justify-between gap-2">
            <span>FPS Cap</span>
            <select value={fpsCap} onChange={(e) => setFpsCap(Number(e.target.value) as 30 | 60 | 120 | 0)} className={SELECT_CLASS}>
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
                <option value={120}>120 FPS</option>
                <option value={0}>Unlimited</option>
            </select>
        </label>
        <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
            <span>High-DPI Scaling</span>
            <input type="checkbox" className={CHECKBOX_CLASS} checked={enableDprScaling} onChange={(e) => setEnableDprScaling(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
            <span>Reduce Motion</span>
            <input type="checkbox" className={CHECKBOX_CLASS} checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
            <span>Haptics</span>
            <input type="checkbox" className={CHECKBOX_CLASS} checked={hapticsEnabled} onChange={(e) => setHapticsEnabled(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
            <span>Particles</span>
            <input type="checkbox" className={CHECKBOX_CLASS} checked={particles} onChange={(e) => setParticles(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
            <span>Screenshake</span>
            <input type="checkbox" className={CHECKBOX_CLASS} checked={screenShake} onChange={(e) => setScreenShake(e.target.checked)} />
        </label>
      </div>
    </div>
  );
}
