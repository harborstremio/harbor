import { useEffect, useState } from "react";
import {
  athletePortraits,
  publishedPortraitUrl,
  type AthletePortrait,
  type AthletePortraitRequest,
} from "@/lib/sports/athlete-portraits";

/** Flags remain caller-owned; photo lookup never delays scores or resets an existing picture. */
export function useAthletePortrait(request: AthletePortraitRequest, enabled = true) {
  const { path, group, id, name, image = "" } = request;
  const key = `${path}:${group ?? ""}:${id}:${name}`;
  const primary = publishedPortraitUrl(image);
  const resolver = athletePortraits();
  const [state, setState] = useState<{
    key: string;
    portrait: AthletePortrait | null;
    loading: boolean;
  }>(() => ({
    key,
    portrait: resolver.peek(request) ?? null,
    loading: enabled && !primary && resolver.peek(request) === undefined,
  }));
  useEffect(() => {
    if (!enabled || primary) return;
    const controller = new AbortController();
    const hit = resolver.peek({ path, group, id, name });
    setState((prior) => ({
      key,
      portrait: hit ?? (prior.key === key ? prior.portrait : null),
      loading: hit === undefined,
    }));
    if (hit !== undefined) return;
    void resolver
      .resolve({ path, group, id, name }, controller.signal)
      .then((portrait) => {
        if (!controller.signal.aborted) setState({ key, portrait, loading: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, portrait: null, loading: false });
      });
    return () => controller.abort();
  }, [path, group, id, name, key, enabled, primary, resolver]);
  const cached = resolver.peek(request);
  const current = state.key === key ? state : cached ? { portrait: cached, loading: false } : null;
  return {
    image: primary || current?.portrait?.url || "",
    attribution: primary ? null : (current?.portrait ?? null),
    loading: enabled && !primary && (current?.loading ?? true),
  };
}
