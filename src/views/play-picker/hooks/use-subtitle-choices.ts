import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "@/lib/auth";
import type { Addon } from "@/lib/addons";
import { probeMpv } from "@/lib/player/mpv";
import { isWeb } from "@/lib/platform";
import { gatherSubtitleAddons } from "@/lib/subtitles/addon-source";
import { languageName } from "@/lib/subtitles/language";
import { searchSubtitles } from "@/lib/subtitles/search";
import { subtitleTrackLanguageLabel } from "@/lib/subtitles/track-label";
import { useSettings } from "@/lib/settings";
import { buildStreamIds } from "@/lib/streams/stream-ids";
import type { PlayerSrc } from "@/lib/view";
import {
  loadEmbeddedTracksWhenMpvAvailable,
  loadSubtitleChoices,
  type EmbeddedSubtitleTrack,
  type SubtitleChoice,
} from "../subtitle-choice";

export type SubtitleLangGroup = { langKey: string; langDisplay: string; items: SubtitleChoice[] };

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

function choiceLanguage(choice: SubtitleChoice): string {
  if (choice.kind === "external") return languageName(choice.result.lang);
  return subtitleTrackLanguageLabel({ lang: choice.track.lang, external: false });
}

export function useSubtitleChoices(src: PlayerSrc) {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const [choices, setChoices] = useState<SubtitleChoice[] | null>(null);
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
    setChoices(null);
    void (async () => {
      const result = await loadSubtitleChoices(
        async () => {
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
          const animeIds = candidateIds.some(
            (id) => id.startsWith("kitsu:") || id.startsWith("mal:"),
          );
          const imdbEpAligned =
            !animeIds ||
            src.episode?.imdbEpisode == null ||
            src.episode.episode === src.episode.imdbEpisode;
          return searchSubtitles(
            {
              imdbId: src.imdbId ?? (src.meta.id?.startsWith("tt") ? src.meta.id : undefined),
              stremioId: src.meta.id,
              candidateIds,
              type: src.meta.type === "series" ? "series" : "movie",
              season: imdbEpAligned
                ? (src.episode?.imdbSeason ?? src.episode?.season)
                : src.episode?.season,
              episode: imdbEpAligned
                ? (src.episode?.imdbEpisode ?? src.episode?.episode)
                : src.episode?.episode,
              langs: preferredLangs,
              filename: src.streamRef?.parsedTitle ?? src.streamRef?.title ?? undefined,
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
        },
        async () => {
          if (isWeb() || settings.playerEngine === "html5") return [];
          return loadEmbeddedTracksWhenMpvAvailable(probeMpv, () =>
            invoke<EmbeddedSubtitleTrack[]>("subtitle_probe_tracks", {
              url: src.url,
              headers: src.headers ?? null,
            }),
          );
        },
        (available) => {
          if (cancelled) return;
          setChoices(available.choices);
          setError(available.externalError);
          setLoading(false);
        },
      );
      if (!cancelled) {
        setChoices(result.choices);
        setError(result.externalError);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    src.url,
    src.headers,
    authKey,
    preferredLangs,
    settings.subProvidersEnabled,
    settings.playerEngine,
  ]);

  const groups = useMemo<SubtitleLangGroup[]>(() => {
    if (!choices) return [];
    const m = new Map<string, SubtitleChoice[]>();
    for (const choice of choices) {
      const key = choiceLanguage(choice);
      const arr = m.get(key) ?? [];
      arr.push(choice);
      m.set(key, arr);
    }
    return [...m.entries()].map(([langDisplay, items]) => ({
      langKey: langDisplay,
      langDisplay,
      items,
    }));
  }, [choices]);

  const bestKey = choices?.find((choice) => choice.kind === "external")?.key ?? null;

  return { loading, error, choices, groups, bestKey };
}
