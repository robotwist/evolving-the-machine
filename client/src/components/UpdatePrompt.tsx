import React, { useState, useEffect } from 'react';

export function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      reg.onupdatefound = () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.onstatechange = () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(sw);
            setShow(true);
          }
        };
      };
    });
  }, []);

  if (!show || !waiting) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 border border-white/20 text-white px-3 py-2 rounded shadow">
      <span className="mr-3">An update is available.</span>
      <button
        className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
        onClick={() => {
          waiting.postMessage({ type: 'SKIP_WAITING' });
          waiting.addEventListener('statechange', () => {
            if (waiting.state === 'activated') {
              window.location.reload();
            }
          });
        }}
      >
        Update now
      </button>
    </div>
  );
}
