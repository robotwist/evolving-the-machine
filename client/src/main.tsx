import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useSettingsStore } from "./lib/stores/useSettingsStore";

createRoot(document.getElementById("root")!).render(<App />);

// Expose FPS cap to non-React classes
(() => {
  const setGlobalFps = () => {
    const fps = useSettingsStore.getState().fpsCap;
    (window as any).__CULTURAL_ARCADE_FPS_CAP__ = fps;
  };
  setGlobalFps();
  useSettingsStore.subscribe(setGlobalFps);
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
