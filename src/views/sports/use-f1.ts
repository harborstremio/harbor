import { useEffect, useState } from "react";
import { fetchF1, readF1, type F1Response } from "@/lib/sports/f1-data";
export function useF1(path: string) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    path: string;
    data?: F1Response;
    loading: boolean;
    failed: boolean;
    at: number;
  }>({ path: "", loading: true, failed: false, at: 0 });
  useEffect(() => {
    if (!path) return;
    let active = true;
    const hit = readF1(path);
    setState({ path, data: hit?.data, at: hit?.at || 0, loading: !hit, failed: false });
    void fetchF1(path, retry > 0)
      .then((entry) => {
        if (active)
          setState({ path, data: entry.data, at: entry.at, loading: false, failed: false });
      })
      .catch(() => {
        if (active) setState((prior) => ({ ...prior, loading: false, failed: true }));
      });
    return () => {
      active = false;
    };
  }, [path, retry]);
  return {
    ...(state.path === path
      ? state
      : { data: readF1(path)?.data, at: 0, loading: !!path, failed: false }),
    retry: () => setRetry((n) => n + 1),
  };
}
