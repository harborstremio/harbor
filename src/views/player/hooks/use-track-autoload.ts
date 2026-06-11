import { useEffect, useRef, useState, type RefObject } from "react";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { applySubStyle } from "@/lib/player/sub-style";
import { langScore, pickBestTrack } from "@/lib/subtitles/language";
import { searchSubtitles } from "@/lib/subtitles/search";
import { readPlayerPrefs } from "@/lib/player-prefs";
import { tmdbImdbId } from "@/lib/providers/tmdb";
import { userAddons, type Addon } from "@/lib/addons";
import type { PlayerSrc } from "@/lib/view";
import type { Settings } from "@/lib/settings";

export function useTrackAutoload(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  src: PlayerSrc;
  snap: PlayerSnapshot;
  engine: "html5" | "mpv";
  settings: Settings;
  authKey: string | null;
}) {
  const { bridgeRef, src, snap, engine, settings, authKey } = params;
  const snapRef = useRef(snap);
  snapRef.current = snap;

  const [resolvedImdbId, setResolvedImdbId] = useState<string | null>(null);
  const [resolvedImdbVerified, setResolvedImdbVerified] = useState(false);
  const [resolutionSettled, setResolutionSettled] = useState(false);
  useEffect(() => {
    setResolvedImdbId(null);
    setResolvedImdbVerified(false);
    setResolutionSettled(false);
    if (src.imdbId) {
      setResolvedImdbId(src.imdbId);
      setResolvedImdbVerified(src.imdbIdVerified === true);
      setResolutionSettled(true);
      return;
    }
    const raw = src.meta.id ?? "";
    if (raw.startsWith("tt")) {
      setResolvedImdbId(raw);
      setResolvedImdbVerified(true);
      setResolutionSettled(true);
      return;
    }
    if (!settings.tmdbKey) {
      setResolutionSettled(true);
      return;
    }
    let cancelled = false;
    tmdbImdbId(settings.tmdbKey, raw)
      .then((id) => {
        if (cancelled) return;
        setResolvedImdbId(id);
        setResolvedImdbVerified(!!id);
        setResolutionSettled(true);
      })
      .catch(() => {
        if (!cancelled) setResolutionSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src.imdbId, src.imdbIdVerified, src.meta.id, settings.tmdbKey]);

  const userAddonsRef = useRef<Addon[] | null>(null);
  useEffect(() => {
    if (!authKey) {
      userAddonsRef.current = [];
      return;
    }
    let cancelled = false;
    userAddons(authKey)
      .then((a) => {
        if (!cancelled) userAddonsRef.current = a;
      })
      .catch(() => {
        if (!cancelled) userAddonsRef.current = [];
      });
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  const autoSubLoadKeyRef = useRef<string | null>(null);
  const userPickedSubRef = useRef(false);
  useEffect(() => {
    if (!resolvedImdbId) return;
    if (snap.audioTracks.length === 0 && snap.durationSec === 0) return;
    const key = `${resolvedImdbId}|${src.episode?.season ?? ""}|${src.episode?.episode ?? ""}|${src.url}`;
    if (autoSubLoadKeyRef.current === key) return;
    const subIsAnime =
      !!src.meta.id?.startsWith("kitsu:") ||
      !!src.meta.id?.startsWith("mal:") ||
      (src.meta.genres ?? []).some((g) => g.toLowerCase() === "anime");
    const rawLangs = resolveLangPreference(
      settings.preferredSubLangs,
      settings.preferredLanguages,
    );
    const langs = subIsAnime ? rawLangs : rawLangs.filter((l) => !isJapanese(l));
    autoSubLoadKeyRef.current = key;
    userPickedSubRef.current = false;
    const enabled = settings.subProvidersEnabled ?? {};
    void (async () => {
      console.info("[subs/autoload] starting", {
        imdbId: resolvedImdbId,
        season: src.episode?.season,
        episode: src.episode?.episode,
        langs,
      });
      const results = await searchSubtitles(
        {
          imdbId: resolvedImdbId,
          stremioId: src.meta.id,
          type: src.meta.type === "series" ? "series" : "movie",
          season: src.episode?.season,
          episode: src.episode?.episode,
          langs,
        },
        {
          providers: {
            wyzie: enabled.wyzie ?? true,
            addons: enabled.addons ?? true,
            opensubtitles: enabled.opensubtitles ?? true,
          },
          addons: userAddonsRef.current ?? [],
          preferredLangs: langs,
          streamHints: {
            release: src.streamRef?.title ?? src.streamRef?.parsedTitle ?? null,
            source: src.streamRef?.source ?? null,
            resolution: src.streamRef?.resolution ?? null,
          },
        },
      );
      console.info(`[subs/autoload] search returned ${results.length} subs`);
      const b = bridgeRef.current;
      if (!b) {
        console.warn("[subs/autoload] no bridge ready, skipping");
        return;
      }
      const matches = results.filter((r) => langScore(r.lang ?? "", langs) >= 0);
      console.info(`[subs/autoload] ${matches.length} match preferred langs`);
      const perLang = new Map<string, number>();
      const PER_LANG_MAX = 6;
      let firstAdded = false;
      let attempted = 0;
      let added = 0;
      for (const r of matches) {
        const k = (r.lang ?? "und").toLowerCase();
        const n = perLang.get(k) ?? 0;
        if (n >= PER_LANG_MAX) continue;
        perLang.set(k, n + 1);
        const blocked = snapRef.current.subtitleTracks.some((t) => t.selected);
        const shouldSelect =
          !settings.subtitlesOffByDefault && !blocked && !firstAdded && !userPickedSubRef.current;
        attempted++;
        const labeled = labelForTrack(r);
        const ok = await b.addSubtitle(r.url, r.lang, labeled, shouldSelect);
        if (ok) {
          firstAdded = true;
          added++;
        }
      }
      console.info(
        `[subs/autoload] ${added}/${attempted} subs accepted by player (${matches.length - attempted} skipped by per-lang cap)`,
      );
    })();
  }, [
    engine,
    resolvedImdbId,
    src.episode?.season,
    src.episode?.episode,
    src.url,
    snap.audioTracks.length,
    snap.durationSec,
    snap.subtitleTracks,
    settings,
  ]);

  const autoTrackKeyRef = useRef<string | null>(null);
  const prefsAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    const subIdSig = snap.subtitleTracks.map((t) => t.id).join(",");
    const audioIdSig = snap.audioTracks.map((t) => t.id).join(",");
    const key = `${src.url}|${audioIdSig}|${subIdSig}`;
    if (autoTrackKeyRef.current === key) return;
    if (snap.audioTracks.length === 0 && snap.subtitleTracks.length === 0) return;
    autoTrackKeyRef.current = key;
    if (userPickedSubRef.current) return;
    if (engine === "mpv") void applySubStyle(settings);
    if (settings.audioNormalize) bridgeRef.current?.setAudioNormalize(true);

    const prefs = readPlayerPrefs(src.meta.id);
    const isAnime =
      !!src.meta.id?.startsWith("kitsu:") ||
      !!src.meta.id?.startsWith("mal:") ||
      (src.meta.genres ?? []).some((g) => g.toLowerCase() === "anime");
    const stripJaForNonAnime = (langs: string[]) =>
      isAnime ? langs : langs.filter((l) => !isJapanese(l));
    const baseAudio = stripJaForNonAnime(
      resolveLangPreference(settings.preferredAudioLangs, settings.preferredLanguages),
    );
    const baseSub = stripJaForNonAnime(
      resolveLangPreference(settings.preferredSubLangs, settings.preferredLanguages),
    );
    const audioLangs = prefs?.audioLang
      ? [prefs.audioLang, ...baseAudio.filter((l) => l !== prefs.audioLang)]
      : baseAudio;
    const subLangs = prefs?.subLang
      ? [prefs.subLang, ...baseSub.filter((l) => l !== prefs.subLang)]
      : baseSub;

    if (snap.audioTracks.length > 0) {
      const want = pickBestTrack(snap.audioTracks, audioLangs);
      const cur = snap.audioTracks.find((t) => t.selected) ?? null;
      if (want && (!cur || cur.id !== want.id)) bridgeRef.current?.setAudioTrack(want.id);
    }
    const subSelected = snap.subtitleTracks.some((t) => t.selected);
    if (!subSelected && snap.subtitleTracks.length > 0 && subLangs.length > 0 && !userPickedSubRef.current) {
      const want = pickBestTrack(snap.subtitleTracks, subLangs);
      if (want) bridgeRef.current?.setSubtitleTrack(want.id);
    }

    if (prefs && prefsAppliedRef.current !== src.meta.id) {
      prefsAppliedRef.current = src.meta.id;
      if (typeof prefs.rate === "number" && prefs.rate !== snap.rate) {
        bridgeRef.current?.setRate(prefs.rate);
      }
      if (typeof prefs.subDelaySec === "number" && prefs.subDelaySec !== snap.subDelaySec) {
        bridgeRef.current?.setSubDelay(prefs.subDelaySec);
      }
    }
  }, [engine, src.url, src.meta.id, snap.audioTracks, snap.subtitleTracks, snap.rate, snap.subDelaySec, settings]);

  return { resolvedImdbId, resolvedImdbVerified, resolutionSettled, userPickedSubRef };
}

function resolveLangPreference(
  primary: string[] | undefined,
  fallback: string[] | undefined,
): string[] {
  if (primary && primary.length > 0) return primary;
  if (fallback && fallback.length > 0) return fallback;
  return ["English"];
}

function isJapanese(lang: string): boolean {
  const l = lang.trim().toLowerCase();
  return l === "ja" || l === "jpn" || l === "jp" || l === "japanese";
}

function labelForTrack(r: { title?: string; source: string; release?: string | null }): string {
  const sourceLabel =
    r.source === "opensubtitles"
      ? "OpenSubtitles"
      : r.source === "wyzie"
        ? "Wyzie"
        : r.source === "addon"
          ? r.title || "Addon"
          : r.source;
  const release = r.release?.trim();
  if (release && release !== r.title) {
    return `${sourceLabel} · ${release}`;
  }
  if (r.title && r.title !== sourceLabel) {
    return `${sourceLabel} · ${r.title}`;
  }
  return sourceLabel;
}
