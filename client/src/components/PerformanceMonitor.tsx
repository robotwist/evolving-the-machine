import React, { useState, useEffect, useRef } from 'react';

export function PerformanceMonitor() {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState<number | null>(null);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const isDev = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('dev') === '1';

  useEffect(() => {
    if (!isDev) return;

    let animationFrameId: number;
    const updatePerformance = () => {
      frameCount.current++;
      const now = performance.now();
      if (now - lastTime.current >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / (now - lastTime.current)));
        frameCount.current = 0;
        lastTime.current = now;
        
        if ('memory' in performance) {
          const mem = (performance as any).memory;
          setMemory(Math.round(mem.usedJSHeapSize / 1024 / 1024));
        }
      }
      animationFrameId = requestAnimationFrame(updatePerformance);
    };
    
    animationFrameId = requestAnimationFrame(updatePerformance);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDev]);

  if (!isDev) return null;

  return (
    <div className="absolute top-4 right-4 text-white text-xs bg-black/50 p-2 rounded">
      <div>FPS: {fps}</div>
      {memory && <div>Memory: {memory}MB</div>}
    </div>
  );
}
