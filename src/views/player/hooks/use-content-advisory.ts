import { useEffect, useRef, useState } from "react";
import { harborImdbParental, type ParentalCategory } from "@/lib/providers/harbor-imdb";

export function useContentAdvisory(
  enabled: boolean,
  imdbId: string | null,
  srcKey: string,
  playing: boolean,
): { categories: ParentalCategory[]; playKey: string } {
  const [categories, setCategories] = useState<ParentalCategory[]>([]);
  const [playKey, setPlayKey] = useState("");
  const startedRef = useRef("");

  useEffect(() => {
    setCategories([]);
    setPlayKey("");
    startedRef.current = "";
    if (!enabled || !imdbId) return;
    let cancelled = false;
    harborImdbParental(imdbId)
      .then((c) => {
        if (!cancelled) setCategories(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, imdbId, srcKey]);

  useEffect(() => {
    if (!enabled || !playing) return;
    if (startedRef.current === srcKey) return;
    startedRef.current = srcKey;
    setPlayKey(srcKey);
  }, [enabled, playing, srcKey]);

  return { categories, playKey };
}
