import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { usePosterChain } from "@/components/poster";
import { fetchMovieAssets } from "@/lib/providers/tmdb/tmdb-images";
import { imageLangPriority } from "@/lib/providers/tmdb/tmdb-image-lang";
import { IMG } from "@/lib/providers/tmdb/tmdb-client";
import { useSettings } from "@/lib/settings";
import type { LocalEntry } from "@/lib/local-library";

function artSrc(value: string): string {
  return /^https?:\/\//i.test(value) ? value : convertFileSrc(value);
}

export function useLocalPoster(entry: LocalEntry) {
  const { settings } = useSettings();
  const localPoster = entry.localArt?.poster ? artSrc(entry.localArt.poster) : undefined;
  const [localized, setLocalized] = useState<string | undefined>(undefined);

  useEffect(() => {
    setLocalized(undefined);
    if (localPoster || entry.tmdbId == null || !settings.tmdbKey) return;
    let alive = true;
    const kind = entry.type === "show" ? "tv" : "movie";
    const metaId = `tmdb:${kind}:${entry.tmdbId}`;
    const langs = imageLangPriority();
    const rankOf = (iso: string | null | undefined) =>
      langs.indexOf(iso ? iso.toLowerCase() : null);
    void fetchMovieAssets(settings.tmdbKey, metaId).then((assets) => {
      if (!alive) return;
      const best = (assets?.posters ?? [])
        .map((p) => ({ p, i: rankOf(p.iso_639_1) }))
        .filter((x) => x.i !== -1)
        .sort((a, b) => a.i - b.i || (b.p.vote_average ?? 0) - (a.p.vote_average ?? 0))[0]?.p;
      if (best?.file_path) setLocalized(`${IMG}/w342${best.file_path}`);
    });
    return () => {
      alive = false;
    };
  }, [entry.tmdbId, entry.type, settings.tmdbKey, localPoster]);

  return usePosterChain(
    settings.rpdbKey,
    entry.imdbId ?? `local:${entry.id}`,
    localPoster ?? localized ?? entry.poster ?? undefined,
    entry.type === "show" ? "series" : "movie",
  );
}
