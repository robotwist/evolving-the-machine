import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useSettingsStore } from "./lib/stores/useSettingsStore";
import { useAudio } from "./lib/stores/useAudio";
import { useHaptics } from "./lib/stores/useHaptics";

createRoot(document.getElementById("root")!).render(<App />);

// Expose FPS cap to non-React classes
(() => {
  const applySettingsToGlobals = () => {
    const { fpsCap, graphicsQuality, hapticsEnabled, reduceMotion, particles, screenShake, hitMarkers, damageNumbers, comboCounters } = useSettingsStore.getState();
    (window as any).__CULTURAL_ARCADE_FPS_CAP__ = fpsCap;
    (window as any).__CULTURAL_ARCADE_QUALITY__ = graphicsQuality;
    (window as any).__CULTURAL_ARCADE_HAPTICS_ENABLED__ = hapticsEnabled;
    (window as any).__CULTURAL_ARCADE_REDUCE_MOTION__ = reduceMotion;
    (window as any).__CULTURAL_ARCADE_PARTICLES__ = particles;
    (window as any).__CULTURAL_ARCADE_SCREEN_SHAKE__ = screenShake;
    (window as any).__CULTURAL_ARCADE_HIT_MARKERS__ = hitMarkers;
    (window as any).__CULTURAL_ARCADE_DAMAGE_NUMBERS__ = damageNumbers;
    (window as any).__CULTURAL_ARCADE_COMBO_COUNTERS__ = comboCounters;
    
    // Expose audio and haptics stores
    (window as any).__CULTURAL_ARCADE_AUDIO__ = useAudio.getState();
    (window as any).__CULTURAL_ARCADE_HAPTICS__ = useHaptics.getState();
  };
  // Apply mobile defaults on first load
  useSettingsStore.getState().applyMobileDefaultsOnce();
  applySettingsToGlobals();
  useSettingsStore.subscribe(applySettingsToGlobals);
  useAudio.subscribe(() => {
    (window as any).__CULTURAL_ARCADE_AUDIO__ = useAudio.getState();
  });
  useHaptics.subscribe(() => {
    (window as any).__CULTURAL_ARCADE_HAPTICS__ = useHaptics.getState();
  });
})();

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
