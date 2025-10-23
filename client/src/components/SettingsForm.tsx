import React from 'react';
import { useSettingsStore } from '../lib/stores/useSettingsStore';

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
    <div className="text-left mt-4 p-3 bg-white/5 rounded border border-white/10">
      <div className="text-white font-semibold mb-2">Settings</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white/90">
        <label className="flex items-center justify-between gap-2">
          <span>Preset</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className="bg-black/50 border border-white/20 rounded px-2 py-1">
            {presetOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
            <span>Voice Style</span>
            <select value={voiceStyle} onChange={(e) => setVoiceStyle(e.target.value)} className="bg-black/50 border border-white/20 rounded px-2 py-1">
                <option value="normal">Normal</option>
                <option value="haunting">Haunting</option>
                <option value="glitch">Glitch</option>
            </select>
        </label>
        <label className="flex items-center justify-between gap-2">
            <span>Graphics Quality</span>
            <select value={graphicsQuality} onChange={(e) => setGraphicsQuality(e.target.value)} className="bg-black/50 border border-white/20 rounded px-2 py-1">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
            </select>
        </label>
        <label className="flex items-center justify-between gap-2">
            <span>FPS Cap</span>
            <select value={fpsCap} onChange={(e) => setFpsCap(Number(e.target.value))} className="bg-black/50 border border-white/20 rounded px-2 py-1">
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
                <option value={120}>120 FPS</option>
                <option value={0}>Unlimited</option>
            </select>
        </label>
        <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
            <span>High-DPI Scaling</span>
            <input type="checkbox" checked={enableDprScaling} onChange={(e) => setEnableDprScaling(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
            <span>Reduce Motion</span>
            <input type="checkbox" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
            <span>Haptics</span>
            <input type="checkbox" checked={hapticsEnabled} onChange={(e) => setHapticsEnabled(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
            <span>Particles</span>
            <input type="checkbox" checked={particles} onChange={(e) => setParticles(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-2 col-span-1 sm:col-span-2">
            <span>Screenshake</span>
            <input type="checkbox" checked={screenShake} onChange={(e) => setScreenShake(e.target.checked)} />
        </label>
      </div>
    </div>
  );
}
