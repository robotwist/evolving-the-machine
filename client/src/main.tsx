import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useSettingsStore } from "./lib/stores/useSettingsStore";

createRoot(document.getElementById("root")!).render(<App />);

// Expose FPS cap to non-React classes
(() => {
  const applySettingsToGlobals = () => {
    const { fpsCap, graphicsQuality, hapticsEnabled, reduceMotion } = useSettingsStore.getState();
    (window as any).__CULTURAL_ARCADE_FPS_CAP__ = fpsCap;
    (window as any).__CULTURAL_ARCADE_QUALITY__ = graphicsQuality;
    (window as any).__CULTURAL_ARCADE_HAPTICS__ = hapticsEnabled;
    (window as any).__CULTURAL_ARCADE_REDUCE_MOTION__ = reduceMotion;
  };
  // Apply mobile defaults on first load
  useSettingsStore.getState().applyMobileDefaultsOnce();
  applySettingsToGlobals();
  useSettingsStore.subscribe(applySettingsToGlobals);
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
