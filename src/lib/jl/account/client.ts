import { useSyncExternalStore } from "react";
import { createJlSessionClient, SESSION_KEY } from "./session-client";
import { stageJlWorkspace, switchJlWorkspace, WORKSPACE_OWNER } from "./workspace";

export type { JlSession, JlAccountContext } from "./session-client";
let workspaceError: string | null = null;
const workspaceListeners = new Set<() => void>();
function workspaceFailed(): void {
  workspaceError =
    "JL Media Vision could not safely open this account's saved workspace. Your data has been preserved. Check available device storage and restart. If this continues, contact support before resetting app data.";
  for (const listener of workspaceListeners) listener();
}
export function useJlWorkspaceError(): string | null {
  return useSyncExternalStore(
    (listener) => {
      workspaceListeners.add(listener);
      return () => {
        workspaceListeners.delete(listener);
      };
    },
    () => workspaceError,
    () => null,
  );
}

// Public project configuration. Supabase RLS authorizes every media request.
const client = createJlSessionClient({
  url: import.meta.env.VITE_JL_SUPABASE_URL || "",
  anonKey: import.meta.env.VITE_JL_SUPABASE_ANON_KEY || "",
  storage: {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  },
  fetch: (input, init) => fetch(input, init),
  beforeIdentityChange: (previous, next) =>
    stageJlWorkspace(localStorage, previous?.userId ?? null, next?.userId ?? null),
  onIdentityChange: () => {
    // Recreate legacy profile caches and providers before they can write into the
    // new workspace. Refreshing the same user never takes this path.
    window.dispatchEvent(new CustomEvent("jl:account-changed"));
    window.location.reload();
    return true;
  },
});

// Recover a process interrupted between workspace parking and session persistence.
// This runs before providers are mounted; no stored private data is rendered first.
if (typeof window !== "undefined") {
  try {
    const userId = client.read()?.userId ?? null;
    const workspaceOwner = localStorage.getItem(WORKSPACE_OWNER);
    if (!workspaceOwner || workspaceOwner !== (userId ?? "local"))
      switchJlWorkspace(localStorage, workspaceOwner === "local" ? null : workspaceOwner, userId);
  } catch {
    workspaceFailed();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_KEY || event.key === null) {
      try {
        client.storageChanged();
      } catch {
        workspaceFailed();
      }
    }
  });
}

export const jlAccountsConfigured = client.configured;
export const currentJlSession = client.read;
export const jlAccountContext = client.context;
export const isJlAccountCurrent = client.isCurrent;
export const assertJlAccountCurrent = client.assertCurrent;
export const signInJl = client.signIn;
export const signUpJl = client.signUp;
export const signOutJl = client.signOut;
export const resetJlPassword = client.resetPassword;
export const freshJlSession = client.fresh;
export const jlRest = client.rest;
export const jlRpc = client.rpc;
export const jlStorage = client.storage;
export const jlStorageUrl = client.storageUrl;
export const subscribeJlSession = client.subscribe;

export function useJlSession() {
  return useSyncExternalStore(client.subscribe, client.read, () => null);
}
