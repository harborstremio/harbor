import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { Addon } from "@/lib/addons";
import { gatherSubtitleAddons } from "@/lib/subtitles/addon-source";
import { langScore, languageName } from "@/lib/subtitles/language";
import { subtitleStreamDescriptor } from "@/lib/subtitles/provider-label";
import { searchSubtitles } from "@/lib/subtitles/search";
import { resolveAnimeSearchCoords } from "@/lib/subtitles/anime-numbering";
import type { SubResult } from "@/lib/subtitles/types";
import { useSettings } from "@/lib/settings";
import { buildStreamIds } from "@/lib/streams/stream-ids";
import type { PlayerSrc } from "@/lib/view";

export type SubtitleLangGroup = { langKey: string; langDisplay: string; items: SubResult[] };

function isAnimeSrc(src: PlayerSrc): boolean {
  return (
    !!src.meta.id?.startsWith("kitsu:") ||
    !!src.meta.id?.startsWith("mal:") ||
    (src.meta.genres ?? []).some((g) => g.toLowerCase() === "anime")
  );
}

function isJapanese(lang: string): boolean {
  const l = lang.trim().toLowerCase();
  return l === "ja" || l === "jpn" || l === "jp" || l === "japanese";
}

export function useSubtitleChoices(src: PlayerSrc) {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const [results, setResults] = useState<SubResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const preferredLangs = useMemo(() => {
    const primary = settings.preferredSubLangs?.length
      ? settings.preferredSubLangs
      : (settings.preferredLanguages ?? []);
    const base = primary.length > 0 ? primary : ["English"];
    return isAnimeSrc(src) ? base : base.filter((l) => !isJapanese(l));
  }, [settings.preferredSubLangs, settings.preferredLanguages, src.meta.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setResults(null);
    void (async () => {
      let addons: Addon[] = [];
      try {
        addons = await gatherSubtitleAddons(authKey);
      } catch {
        addons = [];
      }
      const enabled = settings.subProvidersEnabled ?? {};
      const candidateIds = buildStreamIds(
        src.meta.id,
        src.episode,
        src.imdbId ?? null,
        src.meta.behaviorHints?.defaultVideoId ?? null,
      );
      const animeIds = candidateIds.some((i) => i.startsWith("kitsu:") || i.startsWith("mal:"));
      const imdbEpAligned =
        !animeIds ||
        src.episode?.imdbEpisode == null ||
        src.episode.episode === src.episode.imdbEpisode;
      try {
        const coords = await resolveAnimeSearchCoords({
          isAnime: isAnimeSrc(src),
          metaId: src.meta.id,
          imdbId: src.imdbId ?? (src.meta.id?.startsWith("tt") ? src.meta.id : undefined),
          imdbVerified: src.imdbIdVerified === true || !!src.meta.id?.startsWith("tt"),
          episode: src.episode,
        });
        const r = await searchSubtitles(
          {
            imdbId: src.imdbId ?? (src.meta.id?.startsWith("tt") ? src.meta.id : undefined),
            stremioId: src.meta.id,
            candidateIds,
            type: src.meta.type === "series" ? "series" : "movie",
            season: coords
              ? coords.season
              : imdbEpAligned
                ? (src.episode?.imdbSeason ?? src.episode?.season)
                : src.episode?.season,
            episode: coords
              ? coords.episode
              : imdbEpAligned
                ? (src.episode?.imdbEpisode ?? src.episode?.episode)
                : src.episode?.episode,
            // This screen is a picker, so request every available language.
            // Preferences are still used below to rank and preselect safely.
            langs: [],
            filename: subtitleStreamDescriptor(src.streamRef),
          },
          {
            timeoutMs: 7_000,
            providers: {
              wyzie: enabled.wyzie === true,
              addons: enabled.addons !== false,
              opensubtitles: enabled.opensubtitles !== false,
            },
            addons,
            preferredLangs,
            streamHints: {
              release: src.streamRef?.title ?? src.streamRef?.parsedTitle ?? null,
              source: src.streamRef?.source ?? null,
              resolution: src.streamRef?.resolution ?? null,
            },
          },
        );
        if (!cancelled) {
          setResults(r);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src.url, authKey, preferredLangs, settings.subProvidersEnabled]);

  const groups = useMemo<SubtitleLangGroup[]>(() => {
    if (!results) return [];
    const m = new Map<string, SubResult[]>();
    for (const r of results) {
      const key = languageName(r.lang);
      const arr = m.get(key) ?? [];
      arr.push(r);
      m.set(key, arr);
    }
    return [...m.entries()].map(([langDisplay, items]) => ({
      langKey: langDisplay,
      langDisplay,
      items,
    }));
  }, [results]);

  const bestId =
    results?.find((result) => langScore(result.lang, preferredLangs) >= 0)?.id ?? null;

  return { loading, error, results, groups, bestId };
}
