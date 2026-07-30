import { useEffect, useRef } from "react";
import { useSimkl } from "./provider";
import { simklScrobble, buildBody, type ScrobbleInfo } from "./scrobble";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";
import {
  SIMKL_API_BASE,
  SIMKL_APP_NAME,
  SIMKL_APP_VERSION,
  SIMKL_CLIENT_ID,
  SIMKL_USER_AGENT,
  SIMKL_WATCHED_RATIO,
} from "./config";
import { getSession } from "./session";
import { safeFetch } from "@/lib/safe-fetch";

type Snap = {
  status: string;
  positionSec: number;
  durationSec: number;
};

type LastAction = "start" | "pause" | "stop" | null;

const STUB_MAX_SEC = 150;
const WATCHED_MARK_PCT = SIMKL_WATCHED_RATIO * 100;

function srcInfo(src: PlayerSrc): ScrobbleInfo {
  const raw = src.meta.releaseInfo ? String(src.meta.releaseInfo).slice(0, 4) : "";
  const year = raw ? Number(raw) : NaN;
  return {
    title: src.meta.name || undefined,
    year: Number.isFinite(year) ? year : undefined,
    imdb: src.imdbId,
  };
}

export function useSimklScrobble({ src, snap }: { src: PlayerSrc; snap: Snap }): void {
  const { isConnected } = useSimkl();
  const { settings } = useSettings();
  const enabled = isConnected && settings.simklScrobbleEnabled;
  const pauseOnPauseRef = useRef(settings.pauseListStatusOnPause);
  pauseOnPauseRef.current = settings.pauseListStatusOnPause;
  const lastActionRef = useRef<LastAction>(null);
  const lastKeyRef = useRef<string | null>(null);
  const infoRef = useRef<ScrobbleInfo>(srcInfo(src));
  infoRef.current = srcInfo(src);
  const prevIdentityRef = useRef({ metaId: src.meta.id, episode: src.episode, info: infoRef.current });
  const progressRef = useRef(0);
  const loadResetSeenRef = useRef(true);

  const metaId = src.meta.id;
  const season = src.episode?.season;
  const episode = src.episode?.episode;
  const key = `${metaId}|${season ?? ""}|${episode ?? ""}`;

  const stopArgsRef = useRef({ metaId, episode: src.episode, snap, info: infoRef.current });
  stopArgsRef.current = { metaId, episode: src.episode, snap, info: infoRef.current };

  useEffect(() => {
    if (!enabled) return;
    const onPageHide = () => {
      const a = stopArgsRef.current;
      if (a.snap.durationSec < STUB_MAX_SEC) return;
      if (lastActionRef.current !== "start" && lastActionRef.current !== "pause") return;
      const live = (getPlaybackPosition() / a.snap.durationSec) * 100;
      const progress = Math.min(100, Math.max(0, progressRef.current, live));
      if (progress < WATCHED_MARK_PCT && !pauseOnPauseRef.current) return;
      const action = progress >= WATCHED_MARK_PCT ? "stop" : "pause";
      sendBeacon(a.metaId, a.episode, action === "stop" ? 100 : progress, action, a.info);
      lastActionRef.current = action;
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [enabled, metaId, src.episode]);

  useEffect(() => {
    if (lastKeyRef.current && lastKeyRef.current !== key) {
      const prev = prevIdentityRef.current;
      const prevProgress = progressRef.current;
      if (enabled && lastActionRef.current !== "stop") {
        if (prevProgress >= WATCHED_MARK_PCT) {
          void simklScrobble("stop", prev.metaId, prev.episode, 100, prev.info);
        } else if (prevProgress > 0 && pauseOnPauseRef.current) {
          void simklScrobble("pause", prev.metaId, prev.episode, prevProgress, prev.info);
        }
      }
      lastActionRef.current = null;
      progressRef.current = 0;
      loadResetSeenRef.current = false;
    }
    lastKeyRef.current = key;
    prevIdentityRef.current = { metaId, episode: src.episode, info: infoRef.current };
  }, [enabled, key, metaId, src.episode]);

  useEffect(() => {
    if (!enabled) return;
    if (snap.status === "ended") {
      if (
        snap.durationSec >= STUB_MAX_SEC &&
        (lastActionRef.current === "start" || lastActionRef.current === "pause")
      ) {
        const endPct =
          snap.durationSec > 0
            ? Math.min(
                100,
                Math.max(0, progressRef.current, (getPlaybackPosition() / snap.durationSec) * 100),
              )
            : 100;
        void simklScrobble("stop", metaId, src.episode, endPct, infoRef.current);
        lastActionRef.current = "stop";
      }
      return;
    }
    if (!loadResetSeenRef.current) {
      if (snap.status === "loading" || snap.durationSec <= 0) loadResetSeenRef.current = true;
      return;
    }
    if (snap.durationSec < STUB_MAX_SEC) return;
    const progress = Math.min(100, Math.max(0, (getPlaybackPosition() / snap.durationSec) * 100));
    if (progress > progressRef.current) progressRef.current = progress;

    if (lastActionRef.current === "stop") return;

    if (snap.status === "playing" && lastActionRef.current !== "start") {
      void simklScrobble("start", metaId, src.episode, progress, infoRef.current);
      lastActionRef.current = "start";
    } else if (snap.status === "paused" && lastActionRef.current === "start") {
      if (pauseOnPauseRef.current) {
        void simklScrobble("pause", metaId, src.episode, progress, infoRef.current);
      }
      lastActionRef.current = "pause";
    }
  }, [enabled, metaId, src.episode, snap.status, snap.durationSec]);

  useEffect(() => {
    if (!enabled) return;
    if (snap.durationSec < STUB_MAX_SEC) return;
    if (key !== lastKeyRef.current) return;
    if (lastActionRef.current !== "start" && lastActionRef.current !== "pause") return;
    const pct = Math.min(100, Math.max(0, (snap.positionSec / snap.durationSec) * 100));
    if (pct > progressRef.current) progressRef.current = pct;
  }, [enabled, key, snap.positionSec, snap.durationSec]);

  useEffect(() => {
    return () => {
      if (lastActionRef.current !== "start" && lastActionRef.current !== "pause") return;
      const a = stopArgsRef.current;
      if (a.snap.durationSec >= STUB_MAX_SEC) {
        const live = (getPlaybackPosition() / a.snap.durationSec) * 100;
        const progress = Math.min(100, Math.max(progressRef.current, live));
        const action = progress >= WATCHED_MARK_PCT ? "stop" : "pause";
        if (action === "stop" || pauseOnPauseRef.current) {
          void simklScrobble(
            action,
            a.metaId,
            a.episode,
            action === "stop" ? 100 : progress,
            a.info,
          );
        }
        lastActionRef.current = action;
      } else {
        lastActionRef.current = "pause";
      }
    };
  }, []);
}

function sendBeacon(
  metaId: string,
  episode: PlayerSrc["episode"],
  progress: number,
  action: "stop" | "pause",
  info?: ScrobbleInfo,
): void {
  const session = getSession();
  if (!session) return;

  const body = buildBody(metaId, episode, progress, info);
  if (!body) return;

  const url = new URL(`${SIMKL_API_BASE}/scrobble/${action}`);
  url.searchParams.set("client_id", SIMKL_CLIENT_ID);
  url.searchParams.set("app-name", SIMKL_APP_NAME);
  url.searchParams.set("app-version", SIMKL_APP_VERSION);

  try {
    void safeFetch(url.toString(), {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "simkl-api-key": SIMKL_CLIENT_ID,
        "User-Agent": SIMKL_USER_AGENT,
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    /* noop */
  }
}
