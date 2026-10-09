import { useEffect } from "react";
import { subscribeActivity, type ActivityState } from "@/lib/discord/presence";
import { socialPatch } from "./client";
import { currentAuthor } from "@/lib/theme-auth";
import { useSettings } from "@/lib/settings";

const DEBOUNCE_MS = 2500;
const HEARTBEAT_MS = 240000;

type WatchingPayload = {
  kind: "watching" | "party";
  title?: string;
  metaId?: string;
  metaType?: string;
  sub?: string;
  posterUrl?: string;
  partySize?: number;
  paused?: boolean;
  startedAt?: number;
  positionSec?: number;
  positionAt?: number;
  durationSec?: number;
};

function dedupeKey(p: WatchingPayload | null): string {
  return p ? JSON.stringify(p, (k, v) => (k === "positionAt" ? undefined : v)) : "null";
}

let enabled = false;
let current: WatchingPayload | null = null;
let startedAt = 0;
let lastSentKey = "";
let hasShared = false;
let debounceTimer: number | null = null;

function buildPayload(s: ActivityState): WatchingPayload | null {
  const partySize = s.party ? Math.max(1, s.party.size) : 0;
  if (s.playback) {
    const sub = s.playback.subtitle || (s.playback.year ? String(s.playback.year) : "");
    const dur = s.playback.durationSec > 0 ? Math.floor(s.playback.durationSec) : 0;
    return {
      kind: partySize ? "party" : "watching",
      title: s.playback.title.slice(0, 120),
      metaId: s.playback.metaId,
      metaType: s.playback.metaType,
      sub: sub ? sub.slice(0, 60) : undefined,
      posterUrl:
        s.playback.posterUrl && /^https:\/\//i.test(s.playback.posterUrl)
          ? s.playback.posterUrl.slice(0, 300)
          : undefined,
      partySize: partySize || undefined,
      paused: s.playback.paused || undefined,
      durationSec: dur || undefined,
      positionSec: dur ? Math.max(0, Math.floor(s.playback.positionSec)) : undefined,
      positionAt: dur ? Date.now() : undefined,
    };
  }
  if (partySize) return { kind: "party", partySize };
  return null;
}

async function push(payload: WatchingPayload | null): Promise<void> {
  if (!currentAuthor()) return;
  await socialPatch("/social/me/profile", { watching: payload });
}

function send(force = false): void {
  const payload = current ? { ...current, startedAt: startedAt || undefined } : null;
  const key = dedupeKey(payload);
  if (!force && key === lastSentKey) return;
  if (payload === null && !hasShared) {
    lastSentKey = key;
    return;
  }
  lastSentKey = key;
  if (payload) hasShared = true;
  void push(payload).catch(() => {
    lastSentKey = "";
  });
}

function onActivity(s: ActivityState): void {
  const next = enabled ? buildPayload(s) : null;
  if (next && !current) startedAt = Date.now();
  if (!next) startedAt = 0;
  current = next;
  if (debounceTimer != null) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => send(), DEBOUNCE_MS);
}

export function useWatchShare(): void {
  const { settings } = useSettings();
  const on = settings.shareWatchPresence;
  useEffect(() => {
    enabled = on;
    if (!on) {
      current = null;
      startedAt = 0;
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
      send();
      return;
    }
    const offActivity = subscribeActivity(onActivity);
    const beat = window.setInterval(() => {
      if (current) send(true);
    }, HEARTBEAT_MS);
    return () => {
      offActivity();
      window.clearInterval(beat);
    };
  }, [on]);
}
