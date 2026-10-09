import { applyServerUser, type RawUser } from "@/lib/theme-auth";
import { getJson, postJson } from "./client";

export type HandleState = "available" | "taken" | "reserved" | "invalid" | "too-short";

export type HandleCheck = {
  state: HandleState;
  reason?: string;
  suggestions?: string[];
};

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

export function localHandleCheck(raw: string): HandleCheck | null {
  const h = normalizeHandle(raw);
  if (h.length < HANDLE_MIN) return { state: "too-short", reason: `Handles are at least ${HANDLE_MIN} characters.` };
  if (h.length > HANDLE_MAX) return { state: "invalid", reason: `Handles are at most ${HANDLE_MAX} characters.` };
  if (!/^[a-z0-9-]+$/.test(h)) return { state: "invalid", reason: "Use letters, numbers, and single hyphens only." };
  if (h.startsWith("-") || h.endsWith("-")) return { state: "invalid", reason: "Handles cannot start or end with a hyphen." };
  if (h.includes("--")) return { state: "invalid", reason: "Handles cannot contain two hyphens in a row." };
  if (!/[a-z]/.test(h)) return { state: "invalid", reason: "Handles need at least one letter." };
  return null;
}

export async function handleAvailable(raw: string, signal?: AbortSignal): Promise<HandleCheck> {
  const local = localHandleCheck(raw);
  if (local) return local;
  const h = normalizeHandle(raw);
  return getJson<HandleCheck>(`/account/handle/available?h=${encodeURIComponent(h)}`, { signal });
}

export async function claimHandle(raw: string): Promise<void> {
  const h = normalizeHandle(raw);
  const d = await postJson<{ user: RawUser }>("/account/handle/claim", { handle: h }, { bearer: true });
  applyServerUser(d.user);
}
