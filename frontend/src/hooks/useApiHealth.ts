import { useEffect, useState } from 'react';
import { api } from '../services/api';

export type ApiHealth = 'checking' | 'online' | 'offline';

/** GET /health on mount and every 60s (the endpoint isn't rate-limited). */
export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>('checking');

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    const check = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await api.health(controller.signal);
        if (active) setHealth(res.status === 'ok' ? 'online' : 'offline');
      } catch (err) {
        if (active && !(err instanceof DOMException && err.name === 'AbortError')) setHealth('offline');
      }
    };
    void check();
    const id = window.setInterval(check, 60000);
    return () => {
      active = false;
      window.clearInterval(id);
      controller?.abort();
    };
  }, []);

  return health;
}
