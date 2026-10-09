import { useEffect, useRef } from "react";
import { useSettings, type Settings } from "@/lib/settings";
import { assertJlAccountCurrent, jlAccountContext, jlRpc, useJlSession, type JlAccountContext } from "./client";
import { claimKeySyncOwner, runKeySync } from "./key-sync-run";
import {
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

async function pullRemote(context: JlAccountContext): Promise<KeyValues> {
  const rows = await jlRpc<Array<{ name: string; value: string }>>("get_secrets", {}, context);
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row.name !== "string" || typeof row.value !== "string")) {
    throw new Error("Invalid JL key response");
  }
  const out: KeyValues = {};
  for (const row of rows ?? []) {
    const key = settingKeyFromSecret(row.name);
    if (key) out[key] = row.value ?? "";
  }
  return out;
}

const running = new Map<string, Promise<void>>();

/** Pull and push now. Safe to call often; overlapping calls share one run. */
export function syncJlKeys(settings: Settings, update: (patch: Partial<Settings>) => void, read = () => settings): Promise<void> {
  const context = jlAccountContext();
  if (!context || !claimKeySyncOwner(localStorage, context.userId)) return Promise.resolve();
  const key = `${context.userId}:${context.generation}`;
  const existing = running.get(key);
  if (existing) return existing;
  const promise = runKeySync({
    assertCurrent: () => assertJlAccountCurrent(context),
    readLocal: () => localValues(read()),
    readBase: () => readBase(context.userId),
    writeBase: (base) => writeBase(context.userId, base),
    pull: () => pullRemote(context),
    push: (setting, value) => jlRpc("set_secret", { p_name: secretName(setting), p_value: value }, context),
    apply: (values) => {
      const patch = toPatch(values);
      if (Object.keys(patch).length) update(patch);
    },
  })
    .catch(() => {
      /* offline or signed out: the next focus, interval or change retries */
    })
    .finally(() => {
      if (running.get(key) === promise) running.delete(key);
    });
  running.set(key, promise);
  return promise;
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
    const run = () => void syncJlKeys(latest.current.settings, latest.current.update, () => latest.current.settings);
    run();
    const timer = window.setInterval(run, PULL_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", run);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", run);
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
      () => void syncJlKeys(latest.current.settings, latest.current.update, () => latest.current.settings),
      PUSH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [userId, fingerprint]);
}
