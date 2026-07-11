import type { Meta } from "@/lib/cinemeta";
import { createContext, useCallback, useContext, useRef, type MutableRefObject } from "react";

const SeenIdsContext = createContext<MutableRefObject<Map<string, string>> | null>(null);

export function useSeenIdsRef(): MutableRefObject<Map<string, string>> {
  const ref = useContext(SeenIdsContext);
  const fallback = useRef(new Map<string, string>());
  return ref ?? fallback;
}

export function useDedupOnSeenIds(owner: string) {
  const ref = useSeenIdsRef();
  return useCallback(
    (incoming: Meta[]): Meta[] => {
      const out: Meta[] = [];
      for (const m of incoming) {
        const claimedBy = ref.current.get(m.id);
        if (claimedBy !== undefined && claimedBy !== owner) continue;
        ref.current.set(m.id, owner);
        out.push(m);
      }
      return out;
    },
    [ref, owner],
  );
}

export function useClaimSeenIds(owner: string) {
  const ref = useSeenIdsRef();
  return useCallback(
    (incoming: Meta[]): void => {
      for (const m of incoming) {
        if (!ref.current.has(m.id)) ref.current.set(m.id, owner);
      }
    },
    [ref, owner],
  );
}

export const SeenIdsProvider = SeenIdsContext.Provider;
