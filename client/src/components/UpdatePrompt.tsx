import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';

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
    <div className="arcade-panel panel-yellow fixed bottom-4 left-1/2 -translate-x-1/2 z-50 text-white text-lg px-3 py-2 flex items-center">
      <span className="mr-3">An update is available.</span>
      <Button
        variant="warning"
        size="sm"
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
      </Button>
    </div>
  );
}
