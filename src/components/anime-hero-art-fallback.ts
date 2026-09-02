import { useEffect, useRef, useState } from "react";
import { isArtHostDown, noteArtFailure, noteArtSuccess } from "@/lib/art-host-health";

const STALL_MS = 2500;

export function useArtFallback(sources: (string | undefined)[]): {
  src: string | undefined;
  onLoad: () => void;
  onError: () => void;
  exhausted: boolean;
} {
  const all = sources.filter((s): s is string => !!s);
  const live = all.filter((s) => !isArtHostDown(s));
  const list = live.length > 0 ? live : all;
  const key = list.join("|");
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  indexRef.current = index;

  useEffect(() => {
    setIndex(0);
    setDone(false);
  }, [key]);

  useEffect(() => {
    if (done || index >= list.length) return;
    const id = window.setTimeout(() => {
      if (indexRef.current !== index) return;
      noteArtFailure(list[index]);
      setIndex((v) => v + 1);
    }, STALL_MS);
    return () => window.clearTimeout(id);
  }, [index, done, list.length, key]);

  return {
    src: list[index],
    onLoad: () => {
      noteArtSuccess(list[index]);
      setDone(true);
    },
    onError: () => {
      noteArtFailure(list[index]);
      setIndex((v) => v + 1);
    },
    exhausted: index >= list.length,
  };
}
