import { useEffect, useState } from 'react';

function secondsUntil(deadline: number | null): number {
  return deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
}

/** Seconds remaining until `deadline` (epoch ms), ticking once per second. */
export function useCountdown(deadline: number | null): number {
  const [left, setLeft] = useState(() => secondsUntil(deadline));

  useEffect(() => {
    setLeft(secondsUntil(deadline));
    if (!deadline) return;
    const id = window.setInterval(() => {
      const next = secondsUntil(deadline);
      setLeft(next);
      if (next <= 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  return left;
}

/** Ticks every second while `enabled`; returns the current time. */
export function useNow(enabled = true): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}
