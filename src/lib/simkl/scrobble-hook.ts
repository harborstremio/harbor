import { getPlaybackPosition } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";
import { useEffect, useRef } from "react";

import { SIMKL_API_BASE, SIMKL_APP_NAME, SIMKL_APP_VERSION, SIMKL_CLIENT_ID, SIMKL_WATCHED_RATIO } from "./config";
import { useSimkl } from "./provider";
import { simklScrobble, buildBody } from "./scrobble";
import { getSession } from "./session";

type Snap = {
  status: string;
  positionSec: number;
  durationSec: number;
};

type LastAction = "start" | "pause" | "stop" | null;

const STUB_MAX_SEC = 150;

export function useSimklScrobble({ src, snap }: { src: PlayerSrc; snap: Snap }): void {
  const { isConnected } = useSimkl();
  const { settings } = useSettings();
  const enabled = isConnected;
  const pauseOnPauseRef = useRef(settings.pauseListStatusOnPause);
  pauseOnPauseRef.current = settings.pauseListStatusOnPause;
  const lastActionRef = useRef<LastAction>(null);
  const lastKeyRef = useRef<string | null>(null);
  const prevIdentityRef = useRef({ metaId: src.meta.id, episode: src.episode });

  const metaId = src.meta.id;
  const season = src.episode?.season;
  const episode = src.episode?.episode;
  const key = `${metaId}|${season ?? ""}|${episode ?? ""}`;

  const stopArgsRef = useRef({ metaId, episode: src.episode, snap });
  stopArgsRef.current = { metaId, episode: src.episode, snap };

  useEffect(() => {
    if (!enabled) return;
    const onPageHide = () => {
      const a = stopArgsRef.current;
      if (a.snap.durationSec < STUB_MAX_SEC) return;
      if (lastActionRef.current !== "start" && lastActionRef.current !== "pause") return;
      const progress = Math.min(100, Math.max(0, (getPlaybackPosition() / a.snap.durationSec) * 100));
      if (progress < SIMKL_WATCHED_RATIO * 100 && !pauseOnPauseRef.current) return;
      const action = progress >= SIMKL_WATCHED_RATIO * 100 ? "stop" : "pause";
      sendBeacon(a.metaId, a.episode, progress, action);
      lastActionRef.current = action;
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [enabled, metaId, src.episode]);

  useEffect(() => {
    if (!enabled) return;
    if (lastKeyRef.current && lastKeyRef.current !== key) {
      const prevPos = getPlaybackPosition();
      const prevDur = snap.durationSec;
      if (prevDur >= STUB_MAX_SEC && pauseOnPauseRef.current) {
        const progress = Math.min(100, (prevPos / prevDur) * 100);
        const prev = prevIdentityRef.current;
        void simklScrobble("pause", prev.metaId, prev.episode, progress);
      }
      lastActionRef.current = "pause";
    }
    lastKeyRef.current = key;
    prevIdentityRef.current = { metaId, episode: src.episode };
  }, [enabled, key, metaId, src.episode, snap.durationSec]);

  useEffect(() => {
    if (!enabled) return;
    if (snap.durationSec < STUB_MAX_SEC) return;
    const progress = Math.min(100, Math.max(0, (getPlaybackPosition() / snap.durationSec) * 100));

    if (snap.status === "ended") {
      if (lastActionRef.current === "start" || lastActionRef.current === "pause") {
        void simklScrobble("stop", metaId, src.episode, 100);
        lastActionRef.current = "stop";
      }
      return;
    }
    if (lastActionRef.current === "stop") return;

    if (snap.status === "playing" && lastActionRef.current !== "start") {
      void simklScrobble("start", metaId, src.episode, progress);
      lastActionRef.current = "start";
    } else if (snap.status === "paused" && lastActionRef.current === "start") {
      if (pauseOnPauseRef.current) {
        void simklScrobble("pause", metaId, src.episode, progress);
      }
      lastActionRef.current = "pause";
    }
  }, [enabled, metaId, src.episode, snap.status, snap.durationSec]);

  const seekTrackRef = useRef({ pos: 0, at: 0, lastResyncAt: 0 });
  useEffect(() => {
    if (!enabled) return;
    if (snap.durationSec < STUB_MAX_SEC) return;
    if (lastActionRef.current !== "start") {
      seekTrackRef.current = { pos: getPlaybackPosition(), at: Date.now(), lastResyncAt: 0 };
      return;
    }
    const id = window.setInterval(() => {
      if (lastActionRef.current !== "start") return;
      const now = Date.now();
      const ref = seekTrackRef.current;
      const pos = getPlaybackPosition();
      const dPos = pos - ref.pos;
      const dT = (now - ref.at) / 1000;
      ref.pos = pos;
      ref.at = now;
      const isSeek = Math.abs(dPos) > 8 && (dT < 1.5 || Math.abs(dPos / Math.max(0.001, dT)) > 4);
      if (!isSeek) return;
      if (now - ref.lastResyncAt < 30000) return;
      ref.lastResyncAt = now;
      const progress = Math.min(100, Math.max(0, (pos / snap.durationSec) * 100));
      void simklScrobble("start", metaId, src.episode, progress);
    }, 1000);
    return () => window.clearInterval(id);
  }, [enabled, metaId, src.episode, snap.status, snap.durationSec]);

  useEffect(() => {
    return () => {
      if (!enabled) return;
      if (lastActionRef.current !== "start" && lastActionRef.current !== "pause") return;
      const a = stopArgsRef.current;
      if (a.snap.durationSec >= STUB_MAX_SEC) {
        const progress = Math.min(100, (getPlaybackPosition() / a.snap.durationSec) * 100);
        const action = progress >= SIMKL_WATCHED_RATIO * 100 ? "stop" : "pause";
        if (action === "stop" || pauseOnPauseRef.current) {
          void simklScrobble(action, a.metaId, a.episode, progress);
        }
        lastActionRef.current = action;
      } else {
        lastActionRef.current = "pause";
      }
    };
  }, [enabled]);
}

function sendBeacon(metaId: string, episode: PlayerSrc["episode"], progress: number, action: "stop" | "pause"): void {
  const session = getSession();
  if (!session) return;

  const body = buildBody(metaId, episode, progress);
  if (!body) return;

  const url = new URL(`${SIMKL_API_BASE}/scrobble/${action}`);
  url.searchParams.set("client_id", SIMKL_CLIENT_ID);
  url.searchParams.set("app-name", SIMKL_APP_NAME);
  url.searchParams.set("app-version", SIMKL_APP_VERSION);

  try {
    void fetch(url.toString(), {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "simkl-api-key": SIMKL_CLIENT_ID,
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    /* noop */
  }
}
