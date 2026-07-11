import { harborImdbTitle } from "@/lib/providers/harbor-imdb";
import { useMdblistScores } from "@/lib/providers/mdblist";
import { omdbScores, type OmdbScores } from "@/lib/providers/omdb";
import { useSettings } from "@/lib/settings";
import { useEffect, useState } from "react";

export function useModalRatings(imdbId: string | null, mediaType: "movie" | "show") {
  const { settings } = useSettings();
  const [scores, setScores] = useState<OmdbScores | null>(null);
  const [harborImdb, setHarborImdb] = useState<string | null>(null);
  const mdblist = useMdblistScores(settings.mdblistKey, imdbId, mediaType);

  useEffect(() => {
    if (!imdbId || !settings.omdbKey) {
      setScores(null);
      return;
    }
    let cancelled = false;
    setScores(null);
    omdbScores(settings.omdbKey, imdbId)
      .then((s) => {
        if (!cancelled) setScores(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imdbId, settings.omdbKey]);

  useEffect(() => {
    if (!imdbId?.startsWith("tt")) {
      setHarborImdb(null);
      return;
    }
    let cancelled = false;
    setHarborImdb(null);
    harborImdbTitle(imdbId)
      .then((r) => {
        if (!cancelled && r != null) setHarborImdb(r.toFixed(1));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imdbId]);

  return { scores, mdblist, harborImdb };
}
