import { useSyncExternalStore } from "react";
import { cachedLocalJson, readLocalJson, writeLocalJson } from "./local-store";

export type SurpriseBlend = "familiar" | "balanced" | "new";
export const SURPRISE_BLENDS: readonly SurpriseBlend[] = ["familiar", "balanced", "new"];

const STORE = "surprise-blend";
const DEFAULT: SurpriseBlend = "balanced";

/** Picks per six that may come from an artist the listener already plays. */
const KNOWN_PER_SIX: Record<SurpriseBlend, number> = { familiar: 6, balanced: 2, new: 0 };

export function knownArtistQuota(blend: SurpriseBlend): number {
  return KNOWN_PER_SIX[blend] ?? KNOWN_PER_SIX[DEFAULT];
}

const valid = (value: unknown): value is SurpriseBlend =>
  typeof value === "string" && (SURPRISE_BLENDS as readonly string[]).includes(value);

let held: SurpriseBlend = DEFAULT;
const listeners = new Set<() => void>();

export async function hydrateSurpriseBlend(): Promise<void> {
  const saved = await readLocalJson<{ blend?: unknown }>(STORE).catch(() => null);
  if (valid(saved?.blend)) {
    held = saved.blend;
    for (const listener of listeners) listener();
  }
}

export function getSurpriseBlend(): SurpriseBlend {
  const cached = cachedLocalJson<{ blend?: unknown }>(STORE);
  if (valid(cached?.blend)) held = cached.blend;
  return held;
}

export function setSurpriseBlend(blend: SurpriseBlend): void {
  if (!valid(blend) || blend === held) return;
  held = blend;
  writeLocalJson(STORE, { blend });
  for (const listener of listeners) listener();
}

export function useSurpriseBlend(): SurpriseBlend {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSurpriseBlend,
    () => DEFAULT,
  );
}
