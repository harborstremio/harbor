import { invoke } from "@tauri-apps/api/core";
import { useSyncExternalStore } from "react";

const SECRET_PREFIXES = [
  "harbor.simkl.session.v1",
  "harbor.trakt.session.v1",
  "harbor.mal.session.v1",
  "harbor.anilist.session.v1",
  "harbor.debrid.rdKey",
  "harbor.debrid.tbKey",
  "harbor.debrid.adKey",
  "harbor.debrid.pmKey",
  "harbor.debrid.dlKey",
];

let store: Record<string, string> = {};
let rustAvailable = false;
let loaded = false;
let persistTimer: number | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();
let emit = function emitImpl(): void {
  debridSnapshot = computeDebridSnapshot();
  for (const l of listeners) l();
};
function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function isSecretKey(key: string): boolean {
  return SECRET_PREFIXES.some((p) => key === p || key.startsWith(`${p}.`));
}

async function persist(): Promise<void> {
  if (!rustAvailable) return;
  try {
    await invoke("secrets_write", { content: JSON.stringify(store) });
  } catch {
    void 0;
  }
}

function schedulePersist(): void {
  if (persistTimer != null) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void persist();
  }, 200);
}

export async function loadSecrets(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await invoke<string | null>("secrets_read");
    rustAvailable = true;
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") store = parsed as Record<string, string>;
    }
  } catch {
    rustAvailable = false;
  }

  let migrated = false;
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key || !isSecretKey(key)) continue;
      const val = localStorage.getItem(key);
      if (val != null && store[key] == null) {
        store[key] = val;
        migrated = true;
      }
    }
  } catch {
    void 0;
  }

  if (migrated) {
    await persist();
    try {
      for (const key of Object.keys(store)) {
        if (isSecretKey(key)) localStorage.removeItem(key);
      }
    } catch {
      void 0;
    }
  }
  emit();
}

export function getSecret(key: string): string | null {
  if (rustAvailable) {
    if (store[key] != null) return store[key];
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setSecret(key: string, value: string | null): void {
  if (rustAvailable) {
    if (value == null) delete store[key];
    else store[key] = value;
    schedulePersist();
    emit();
    try {
      localStorage.removeItem(key);
    } catch {
      void 0;
    }
    return;
  }
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    void 0;
  }
  emit();
}

export type DebridSecrets = {
  rdKey: string;
  tbKey: string;
  adKey: string;
  pmKey: string;
  dlKey: string;
};

const DEBRID_KEYS: (keyof DebridSecrets)[] = [
  "rdKey",
  "tbKey",
  "adKey",
  "pmKey",
  "dlKey",
];

function computeDebridSnapshot(): DebridSecrets {
  const out = {} as DebridSecrets;
  for (const k of DEBRID_KEYS) {
    out[k] = getSecret(`harbor.debrid.${k}`) ?? "";
  }
  return out;
}

let debridSnapshot: DebridSecrets = computeDebridSnapshot();

const EMPTY: DebridSecrets = {
  rdKey: "",
  tbKey: "",
  adKey: "",
  pmKey: "",
  dlKey: "",
};

export function useDebridSecrets(): DebridSecrets {
  return useSyncExternalStore(
    subscribe,
    () => debridSnapshot,
    () => EMPTY,
  );
}
