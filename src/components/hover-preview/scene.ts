import type { PreviewPayload } from "@/lib/hover-preview/store";
import { useEffect, useState } from "react";

import type { PanelPlacement } from "./use-preview-position";

export type Layer = { key: number; payload: PreviewPayload };

export type Scene = {
  seq: number;
  width: number;
  crownH: number;
  topInset: number;
  pos: PanelPlacement | null;
  height: number;
  nextHeight: number;
  current: Layer;
  outgoing: Layer | null;
  incoming: Layer | null;
  exiting: "soft" | "hard" | null;
};

export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return match;
}
