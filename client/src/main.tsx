import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useSettingsStore } from "./lib/stores/useSettingsStore";
import { useAudio } from "./lib/stores/useAudio";
import { useHaptics } from "./lib/stores/useHaptics";
import { useGameStore } from "./lib/stores/useGameStore";

// Extend window interface for game globals
declare global {
  interface Window {
    __CULTURAL_ARCADE_FPS_CAP__: number;
    __CULTURAL_ARCADE_QUALITY__: string;
    __CULTURAL_ARCADE_HAPTICS_ENABLED__: boolean;
    __CULTURAL_ARCADE_REDUCE_MOTION__: boolean;
    __CULTURAL_ARCADE_PARTICLES__: boolean;
    __CULTURAL_ARCADE_SCREEN_SHAKE__: boolean;
    __CULTURAL_ARCADE_HIT_MARKERS__: boolean;
    __CULTURAL_ARCADE_DAMAGE_NUMBERS__: boolean;
    __CULTURAL_ARCADE_COMBO_COUNTERS__: boolean;
    __CULTURAL_ARCADE_AUDIO__: unknown;
    __CULTURAL_ARCADE_HAPTICS__: unknown;
    gameInstance: any; // Game instance for mobile controls
    unlockAllLevels: () => void; // Console command to unlock all levels
  }
}

// Initialize React app
try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Root element not found!");
    throw new Error("Root element not found");
  }

  const root = createRoot(rootElement);
  root.render(<App />);
  console.log("React app initialized successfully");
} catch (error) {
  console.error("Failed to initialize React app:", error);
  // Fallback: show error message
  document.body.innerHTML = `
    <div style="color: red; padding: 20px; font-family: monospace;">
      <h1>Game Initialization Error</h1>
      <p>Error: ${error}</p>
      <p>Please check the browser console for more details.</p>
    </div>
  `;
}

// Initialize global settings after React app starts
setTimeout(() => {
  const applySettingsToGlobals = () => {
    const { fpsCap, graphicsQuality, hapticsEnabled, reduceMotion, particles, screenShake, hitMarkers, damageNumbers, comboCounters } = useSettingsStore.getState();
    window.__CULTURAL_ARCADE_FPS_CAP__ = fpsCap;
    window.__CULTURAL_ARCADE_QUALITY__ = graphicsQuality;
    window.__CULTURAL_ARCADE_HAPTICS_ENABLED__ = hapticsEnabled;
    window.__CULTURAL_ARCADE_REDUCE_MOTION__ = reduceMotion;
    window.__CULTURAL_ARCADE_PARTICLES__ = particles;
    window.__CULTURAL_ARCADE_SCREEN_SHAKE__ = screenShake;
    window.__CULTURAL_ARCADE_HIT_MARKERS__ = hitMarkers;
    window.__CULTURAL_ARCADE_DAMAGE_NUMBERS__ = damageNumbers;
    window.__CULTURAL_ARCADE_COMBO_COUNTERS__ = comboCounters;

    // Expose audio and haptics stores
    window.__CULTURAL_ARCADE_AUDIO__ = useAudio.getState();
    window.__CULTURAL_ARCADE_HAPTICS__ = useHaptics.getState();
    
    // Expose unlock function for console access
    window.unlockAllLevels = () => {
      console.log('🔓 Unlocking all levels via console command...');
      useGameStore.getState().unlockAllLevels();
      console.log('✅ All levels unlocked! Current unlocked stages:', useGameStore.getState().unlockedStages);
    };
  };

  // Apply mobile defaults on first load
  useSettingsStore.getState().applyMobileDefaultsOnce();
  applySettingsToGlobals();

  // Subscribe to store changes
  useSettingsStore.subscribe(applySettingsToGlobals);
  useAudio.subscribe(() => {
    window.__CULTURAL_ARCADE_AUDIO__ = useAudio.getState();
  });
  useHaptics.subscribe(() => {
    window.__CULTURAL_ARCADE_HAPTICS__ = useHaptics.getState();
  });
}, 0);

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {
        // ignore
      });
  });
}
