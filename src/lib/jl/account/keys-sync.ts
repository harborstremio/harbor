import { useEffect, useRef } from "react";
import { useSettings, type Settings } from "@/lib/settings";
import { currentJlSession, jlRpc, useJlSession } from "./client";
import {
  mergeKeys,
  secretName,
  settingKeyFromSecret,
  SYNCED_SETTING_KEYS,
  type KeyBase,
  type KeyValues,
  type SyncedSettingKey,
} from "./keys";

/**
 * Keeps service keys and IPTV logins the same on every device signed in to the account. Values
 * travel and rest encrypted in the account; only the account owner can read them back.
 */

const BASE_KEY = "jl.account.keys.base.v1";
const PULL_EVERY_MS = 10 * 60_000;
const PUSH_DELAY_MS = 1500;

function baseKey(userId: string): string {
  return `${BASE_KEY}.${userId}`;
}

function readBase(userId: string): KeyBase {
  try {
    const raw = localStorage.getItem(baseKey(userId));
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === "object" ? (v as KeyBase) : {};
  } catch {
    return {};
  }
}

function writeBase(userId: string, base: KeyBase): void {
  try {
    localStorage.setItem(baseKey(userId), JSON.stringify(base));
  } catch {
    /* storage unavailable: the next sync starts from an empty base and the account wins */
  }
}

function localValues(settings: Settings): KeyValues {
  const out: KeyValues = {};
  for (const key of SYNCED_SETTING_KEYS) {
    if (key === "iptvPlaylists") {
      out[key] = settings.iptvPlaylists.length ? JSON.stringify(settings.iptvPlaylists) : "";
    } else {
      out[key] = (settings[key] ?? "").trim();
    }
  }
  return out;
}

function toPatch(values: KeyValues): Partial<Settings> {
  const patch: Partial<Settings> = {};
  for (const [key, value] of Object.entries(values) as Array<[SyncedSettingKey, string]>) {
    if (key === "iptvPlaylists") {
      try {
        const list = value ? (JSON.parse(value) as unknown) : [];
        if (Array.isArray(list)) patch.iptvPlaylists = list as Settings["iptvPlaylists"];
      } catch {
        /* a damaged value is left out rather than wiping this device's playlists */
      }
    } else {
      patch[key] = value;
    }
  }
  return patch;
}

async function pullRemote(): Promise<KeyValues> {
  const rows = await jlRpc<Array<{ name: string; value: string }>>("get_secrets");
  const out: KeyValues = {};
  for (const row of rows ?? []) {
    const key = settingKeyFromSecret(row.name);
    if (key) out[key] = row.value ?? "";
  }
  return out;
}

let running: Promise<void> | null = null;

async function runKeySync(settings: Settings, update: (patch: Partial<Settings>) => void): Promise<void> {
  const session = currentJlSession();
  if (!session) return;
  const remote = await pullRemote();
  const merged = mergeKeys(readBase(session.userId), localValues(settings), remote);
  for (const [key, value] of Object.entries(merged.push) as Array<[SyncedSettingKey, string]>) {
    await jlRpc("set_secret", { p_name: secretName(key), p_value: value });
  }
  const patch = toPatch(merged.apply);
  if (Object.keys(patch).length) update(patch);
  writeBase(session.userId, merged.base);
}

/** Pull and push now. Safe to call often; overlapping calls share one run. */
export function syncJlKeys(settings: Settings, update: (patch: Partial<Settings>) => void): Promise<void> {
  running ??= runKeySync(settings, update)
    .catch(() => {
      /* offline or signed out: the next focus, interval or change retries */
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** Runs the key sync while signed in: on sign-in, on focus, every few minutes, and after each change. */
export function useJlKeySync(): void {
  const session = useJlSession();
  const { settings, update } = useSettings();
  const latest = useRef({ settings, update });
  latest.current = { settings, update };
  const userId = session?.userId ?? "";
  const fingerprint = JSON.stringify(localValues(settings));

  useEffect(() => {
    if (!userId) return;
    const run = () => void syncJlKeys(latest.current.settings, latest.current.update);
    run();
    const timer = window.setInterval(run, PULL_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  const first = useRef(true);
  useEffect(() => {
    if (!userId) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(
      () => void syncJlKeys(latest.current.settings, latest.current.update),
      PUSH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [userId, fingerprint]);
}
