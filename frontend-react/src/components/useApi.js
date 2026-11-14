import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data with `loader()`; optionally polls every `intervalMs`.
 * Returns { data, error, loading, reload }. Polling refreshes silently (no loading flicker).
 */
export function useApi(loader, deps = [], { intervalMs } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const alive = useRef(true);

  const run = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const d = await loaderRef.current();
      if (alive.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(e);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    run(false);
    let timer;
    if (intervalMs) timer = setInterval(() => run(true), intervalMs);
    return () => {
      alive.current = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs]);

  return { data, error, loading, reload: () => run(true) };
}
