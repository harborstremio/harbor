import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { verifyApiKey } from "./client";
import { invalidatePmdbWatchedCache, markPmdbWatched, unmarkPmdbWatched } from "./history";
import { resolvePmdbEpisodeTarget, resolvePmdbTarget, stremioIdToPmdbTarget } from "./ids";
import { armOnlineFlush, clearPendingResumes, flushPendingResumes } from "./pending-sync";
import { pmdbSaveResume } from "./scrobble";
import { getSession, setSession, subscribeSession, updateSessionUsername } from "./session";
import { clearPmdbWatchlistCache } from "./watchlist";
import type { PmdbSession, PmdbTarget } from "./types";

type Value = {
  session: PmdbSession | null;
  isConnected: boolean;
  username: string | null;
  connect: (apiKey: string, username?: string) => Promise<boolean>;
  updateUsername: (username: string) => void;
  disconnect: () => void;
  markWatched: (
    metaId: string,
    episode?: { season: number; episode: number },
    type?: "movie" | "series",
  ) => Promise<boolean>;
  unmarkWatched: (
    metaId: string,
    episode?: { season: number; episode: number },
    type?: "movie" | "series",
  ) => Promise<boolean>;
  resolveTarget: (
    metaId: string,
    episode?: { season: number; episode: number },
    type?: "movie" | "series",
  ) => PmdbTarget | null;
  resolveTargetAsync: (
    metaId: string,
    episode?: { season: number; episode: number; absoluteNumber?: number },
    type?: "movie" | "series",
  ) => Promise<PmdbTarget | null>;
};

const Ctx = createContext<Value | null>(null);

export function PublicMetaDbProvider({ children }: { children: ReactNode }) {
  const [session, setLocalSession] = useState<PmdbSession | null>(() => getSession());

  useEffect(
    () =>
      subscribeSession(() => {
        setLocalSession(getSession());
      }),
    [],
  );

  const connect = useCallback(async (apiKey: string, username?: string): Promise<boolean> => {
    const trimmed = apiKey.trim();
    if (!trimmed) return false;
    const ok = await verifyApiKey(trimmed);
    if (!ok) return false;

    setSession({
      apiKey: trimmed,
      username: username?.trim() || undefined,
      validatedAt: Date.now(),
    });
    return true;
  }, []);

  const updateUsername = useCallback((username: string) => {
    updateSessionUsername(username);
  }, []);

  const disconnect = useCallback(() => {
    setSession(null);
    invalidatePmdbWatchedCache();
    clearPmdbWatchlistCache();
    clearPendingResumes();
  }, []);

  const resolveTarget = useCallback(
    (
      metaId: string,
      episode?: { season: number; episode: number },
      type?: "movie" | "series",
    ): PmdbTarget | null => {
      return stremioIdToPmdbTarget(metaId, episode, type);
    },
    [],
  );

  const markWatched = useCallback(
    async (
      metaId: string,
      episode?: { season: number; episode: number },
      type?: "movie" | "series",
    ): Promise<boolean> => {
      const target = episode
        ? await resolvePmdbEpisodeTarget(
            metaId,
            { season: episode.season, episode: episode.episode },
        ).catch(() => null)
        : ((await resolvePmdbTarget(metaId, type).catch(() => null)) ??
          resolveTarget(metaId, episode, type));
      if (!target) return false;
      return markPmdbWatched(target);
    },
    [resolveTarget],
  );

  const unmarkWatched = useCallback(
    async (
      metaId: string,
      episode?: { season: number; episode: number },
      type?: "movie" | "series",
    ): Promise<boolean> => {
      const target = episode
        ? await resolvePmdbEpisodeTarget(
            metaId,
            { season: episode.season, episode: episode.episode },
        ).catch(() => null)
        : ((await resolvePmdbTarget(metaId, type).catch(() => null)) ??
          resolveTarget(metaId, episode, type));
      if (!target) return false;
      return unmarkPmdbWatched(target);
    },
    [resolveTarget],
  );

  const resolveTargetAsync = useCallback(
    async (
      metaId: string,
      episode?: { season: number; episode: number; absoluteNumber?: number },
      type?: "movie" | "series",
    ): Promise<PmdbTarget | null> => {
      try {
        if (episode) {
          return await resolvePmdbEpisodeTarget(metaId, {
            season: episode.season,
            episode: episode.episode,
            absoluteNumber: episode.absoluteNumber,
          });
        }
        return (await resolvePmdbTarget(metaId, type)) ?? resolveTarget(metaId, episode, type);
      } catch {
        return resolveTarget(metaId, episode, type);
      }
    },
    [resolveTarget],
  );

  // Replays resume points amassed while unloading/offline. safeFetch routes
  // through the Tauri bridge in prod, so unlike a raw keepalive beacon this
  // survives app restarts and has no CORS preflight problem.
  useEffect(
    () =>
      armOnlineFlush({
        hasSession: () => getSession() != null,
        save: (target, positionMs, runtimeMs) =>
          pmdbSaveResume(target, positionMs, runtimeMs).then((res) => res !== null),
      }),
    [],
  );

  useEffect(() => {
    if (session) void flushPendingResumes().catch(() => {});
  }, [session]);

  const value = useMemo<Value>(
    () => ({
      session,
      isConnected: !!session?.apiKey,
      username: session?.username ?? null,
      connect,
      updateUsername,
      disconnect,
      markWatched,
      unmarkWatched,
      resolveTarget,
      resolveTargetAsync,
    }),
    [session, connect, updateUsername, disconnect, markWatched, unmarkWatched, resolveTarget, resolveTargetAsync],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePublicMetaDb(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePublicMetaDb outside PublicMetaDbProvider");
  return v;
}
