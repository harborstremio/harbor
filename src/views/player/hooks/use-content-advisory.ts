import { useEffect, useRef, useState } from "react";
import { isAdvisoryIgnored } from "@/lib/player/content-advisory-ignore";
import {
  harborImdbMpaRating,
  harborImdbParental,
  type ParentalCategory,
} from "@/lib/providers/harbor-imdb";

export function useContentAdvisory(
  enabled: boolean,
  imdbId: string | null,
  srcKey: string,
  playing: boolean,
): {
  categories: ParentalCategory[];
  playKey: string;
  imdbId: string | null;
  mpaRating: string | null;
} {
  const [categories, setCategories] = useState<ParentalCategory[]>([]);
  const [mpaRating, setMpaRating] = useState<string | null>(null);
  const [playKey, setPlayKey] = useState("");
  const startedRef = useRef("");

  useEffect(() => {
    setPlayKey("");
    startedRef.current = "";
  }, [srcKey]);

  useEffect(() => {
    setCategories([]);
    setMpaRating(null);
    if (!enabled || !imdbId || isAdvisoryIgnored(imdbId)) return;
    let cancelled = false;
    harborImdbParental(imdbId)
      .then((c) => {
        if (!cancelled) {
          setCategories(c);
          setMpaRating(harborImdbMpaRating(imdbId));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, imdbId]);

  useEffect(() => {
    if (!enabled || !playing) return;
    if (startedRef.current === srcKey) return;
    startedRef.current = srcKey;
    setPlayKey(srcKey);
  }, [enabled, playing, srcKey]);

  return { categories, playKey, imdbId, mpaRating };
}
