import { useEffect, useRef, useState, type RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { langScore, pickBestTrack } from "@/lib/subtitles/language";
import { searchSubtitles } from "@/lib/subtitles/search";
import { readPlayerPrefs, type PerShowPrefs } from "@/lib/player-prefs";
import { tmdbImdbId } from "@/lib/providers/tmdb";
import type { Addon } from "@/lib/addons";
import { gatherSubtitleAddons } from "@/lib/subtitles/addon-source";
import type { PlayerSrc } from "@/lib/view";
import type { Settings } from "@/lib/settings";
import {
  canStartSubtitleAutoload,
  loadFirstWorkingSubtitle,
  subtitleSearchImdbId,
} from "@/lib/subtitles/autoload";
import { pickDesiredSubtitleTrack } from "@/lib/subtitles/track-selection";

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

  const [userAddonsState, setUserAddonsState] = useState<{
    authKey: string | null;
    addons: Addon[] | null;
  }>({ authKey, addons: null });
  const userAddons = userAddonsState.authKey === authKey ? userAddonsState.addons : null;
  useEffect(() => {
    let cancelled = false;
    gatherSubtitleAddons(authKey)
      .then((a) => {
        if (!cancelled) setUserAddonsState({ authKey, addons: a });
      })
      .catch(() => {
        if (!cancelled) setUserAddonsState({ authKey, addons: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  const autoSubLoadKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!resolutionSettled) return;
    const mediaReady = snap.audioTracks.length > 0 || snap.durationSec > 0;
    const enabled = settings.subProvidersEnabled ?? {};
    const readyAddons = enabled.addons === false ? [] : userAddons;
    const searchImdbId = subtitleSearchImdbId(resolvedImdbId, resolvedImdbVerified);
    const contentId = searchImdbId ?? src.meta.id;
    if (!canStartSubtitleAutoload({ imdbId: contentId, mediaReady, addons: readyAddons })) return;
    const key = `${contentId}|${src.episode?.season ?? ""}|${src.episode?.episode ?? ""}|${src.url}`;
    if (autoSubLoadKeyRef.current === key) return;
    const subIsAnime =
      !!src.meta.id?.startsWith("kitsu:") ||
      !!src.meta.id?.startsWith("mal:") ||
      (src.meta.genres ?? []).some((g) => g.toLowerCase() === "anime");
    const rawLangs = resolveLangPreference(settings.preferredSubLangs, settings.preferredLanguages);
    const langs = subIsAnime ? rawLangs : rawLangs.filter((l) => !isJapanese(l));
    autoSubLoadKeyRef.current = key;
    void (async () => {
      console.info("[subs/autoload] starting", {
        imdbId: searchImdbId,
        season: src.episode?.season,
        episode: src.episode?.episode,
        langs,
      });
      const { videoHash, videoSize } = settings.subtitleAutoSync ? await resolveVideoHash(src) : {};
      if (videoHash) console.info(`[subs/autoload] moviehash ${videoHash} (${videoSize})`);
      const results = await searchSubtitles(
        {
          imdbId: searchImdbId,
          stremioId: src.meta.id,
          type: src.meta.type === "series" ? "series" : "movie",
          season: src.episode?.season,
          episode: src.episode?.episode,
          langs,
          videoHash,
          videoSize,
          filename: src.streamRef?.parsedTitle ?? src.streamRef?.title ?? undefined,
        },
        {
          providers: {
            wyzie: enabled.wyzie ?? true,
            addons: enabled.addons ?? true,
            opensubtitles: enabled.opensubtitles ?? true,
          },
          addons: readyAddons ?? [],
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
      if (!b || autoSubLoadKeyRef.current !== key) {
        console.warn("[subs/autoload] no bridge ready, skipping");
        return;
      }
      const matches = results.filter((r) => langScore(r.lang ?? "", langs) >= 0);
      console.info(`[subs/autoload] ${matches.length} match preferred langs`);
      const loaded = await loadFirstWorkingSubtitle(matches, async (r) => {
        if (autoSubLoadKeyRef.current !== key) return false;
        return b.addSubtitle(r.url, r.lang, labelForTrack(r), false, {
          format: r.format,
          encoding: r.encoding,
        });
      });
      console.info(
        `[subs/autoload] ${loaded ? "loaded best available subtitle" : "no subtitle loaded"}`,
      );
    })();
  }, [
    resolvedImdbId,
    resolvedImdbVerified,
    resolutionSettled,
    src,
    snap.audioTracks.length,
    snap.durationSec,
    userAddons,
    settings,
    bridgeRef,
  ]);

  const autoTrackKeyRef = useRef<string | null>(null);
  const prefsAppliedRef = useRef<string | null>(null);
  const autoSubIdRef = useRef<string | null>(null);
  useEffect(() => {
    autoSubIdRef.current = null;
  }, [src.url]);

  const preselectAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    const choice = src.subtitlePreselect;
    if (!choice) return;
    if (snap.audioTracks.length === 0 && snap.subtitleTracks.length === 0 && snap.durationSec === 0)
      return;
    if (preselectAppliedRef.current === src.url) return;
    preselectAppliedRef.current = src.url;
    if (choice.off) {
      if (snap.subtitleTracks.some((t) => t.selected)) bridgeRef.current?.setSubtitleTrack(null);
      return;
    }
    if (choice.url) {
      void bridgeRef.current?.addSubtitle(choice.url, choice.lang, choice.title, true);
    }
  }, [
    src.url,
    src.subtitlePreselect,
    snap.audioTracks.length,
    snap.subtitleTracks,
    snap.durationSec,
    bridgeRef,
  ]);
  useEffect(() => {
    if (engine !== "mpv") return;
    bridgeRef.current?.setAudioDevice?.(settings.audioDevice);
  }, [engine, settings.audioDevice, bridgeRef]);
  useEffect(() => {
    const subIdSig = snap.subtitleTracks.map((t) => t.id).join(",");
    const audioIdSig = snap.audioTracks.map((t) => t.id).join(",");
    const key = `${src.url}|${audioIdSig}|${subIdSig}`;
    if (autoTrackKeyRef.current === key) return;
    if (snap.audioTracks.length === 0 && snap.subtitleTracks.length === 0) return;
    autoTrackKeyRef.current = key;
    bridgeRef.current?.setAudioNormalize(settings.audioNormalize);
    bridgeRef.current?.setAudioProfile?.(settings.audioProfile);
    bridgeRef.current?.setAudioDevice?.(settings.audioDevice);

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

    const allow = <T extends { title?: string; label?: string }>(tracks: T[]): T[] => {
      const words = blockWords(settings);
      if (words.length === 0) return tracks;
      const kept = tracks.filter((t) => !trackMatchesWords(t, words));
      return kept.length > 0 ? kept : tracks;
    };

    let effAudio: (typeof snap.audioTracks)[number] | null = null;
    if (snap.audioTracks.length > 0) {
      const want = pickBestTrack(allow(snap.audioTracks), audioLangs);
      const cur = snap.audioTracks.find((t) => t.selected) ?? null;
      effAudio = want ?? cur;
      if (want && (!cur || cur.id !== want.id)) bridgeRef.current?.setAudioTrack(want.id);
    }
    const subsOff = subsOffFor(prefs, settings);
    if (subsOff) {
      if (snap.subtitleTracks.some((t) => t.selected)) bridgeRef.current?.setSubtitleTrack(null);
    } else if (!src.subtitlePreselect && snap.subtitleTracks.length > 0 && subLangs.length > 0) {
      const current = snap.subtitleTracks.find((t) => t.selected) ?? null;
      const userPicked =
        current != null && autoSubIdRef.current != null && current.id !== autoSubIdRef.current;
      const lockedToAuto =
        current != null && autoSubIdRef.current != null && !settings.subtitleAutoUpgrade;
      if (!userPicked && !lockedToAuto) {
        const nativeAudio =
          settings.forcedSubsWhenNativeAudio &&
          effAudio != null &&
          langScore(effAudio.lang ?? "", subLangs) >= 0;
        const want = nativeAudio
          ? (snap.subtitleTracks
              .filter(isForcedTrack)
              .sort(
                (a, b) => langScore(b.lang ?? "", subLangs) - langScore(a.lang ?? "", subLangs),
              )[0] ?? null)
          : pickDesiredSubtitleTrack(
              allow(snap.subtitleTracks),
              subLangs,
              settings.preferEmbeddedSubs,
            );
        if (want) {
          if (want.id !== current?.id) bridgeRef.current?.setSubtitleTrack(want.id);
          autoSubIdRef.current = want.id;
        }
      }
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
  }, [
    engine,
    src.url,
    src.meta.id,
    snap.audioTracks,
    snap.subtitleTracks,
    snap.rate,
    snap.subDelaySec,
    settings,
  ]);

  useEffect(() => {
    if (!subsOffFor(readPlayerPrefs(src.meta.id), settings)) return;
    const selected = snap.subtitleTracks.find((t) => t.selected);
    if (selected) bridgeRef.current?.setSubtitleTrack(null);
  }, [src.meta.id, snap.subtitleTracks, settings]);

  return { resolvedImdbId, resolvedImdbVerified, resolutionSettled };
}

function blockWords(s: Settings): string[] {
  return (s.trackBlockWords ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean);
}

function trackMatchesWords(t: { title?: string; label?: string }, words: string[]): boolean {
  const hay = `${t.title ?? ""} ${t.label ?? ""}`.toLowerCase();
  return words.some((w) => hay.includes(w));
}

function isForcedTrack(t: { title?: string; label?: string }): boolean {
  return /\bforced\b/i.test(`${t.title ?? ""} ${t.label ?? ""}`);
}

function subsOffFor(prefs: PerShowPrefs | null, s: Settings): boolean {
  if (prefs?.subsOff != null) return prefs.subsOff;
  if (s.subtitlesOffByDefault) return true;
  if (prefs?.subLang) return false;
  return false;
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

function isLoopback(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(url);
}

function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function resolveVideoHash(
  src: PlayerSrc,
): Promise<{ videoHash?: string; videoSize?: number }> {
  if (isLoopback(src.url)) return {};
  if (!src.url || src.url.startsWith("blob:")) return {};
  try {
    const mh = await raceTimeout(
      invoke<{ hash: string; size: number }>("compute_moviehash", {
        url: src.url,
        headers: src.headers,
        size: src.streamRef?.size ?? undefined,
      }),
      1800,
    );
    if (mh?.hash) return { videoHash: mh.hash, videoSize: mh.size };
  } catch {
    return {};
  }
  return {};
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
  if (r.title && r.title !== sourceLabel && r.source !== "addon") {
    return `${sourceLabel} · ${r.title}`;
  }
  return sourceLabel;
}
