import { useEffect, useState } from "react";
import { setPlaybackPresence } from "@/lib/discord/presence";
import { getPlaybackPosition, subscribePlaybackClock } from "@/lib/player/playback-clock";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import type { PlayerSrc } from "@/lib/view";
import { resolvePreferredAnimeTitle } from "@/lib/anime-title";
import { useSettings } from "@/lib/settings";

const POSITION_REFRESH_MS = 30000;
const SEEK_DRIFT_SEC = 5;
const ANIME_META_ID = /^(kitsu|mal|anilist):/;

export function usePlaybackPresence(params: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  season: number | undefined;
  episode: number | undefined;
  liveGuideOpen: boolean;
}) {
  const { src, snap, season, episode, liveGuideOpen } = params;
  const { settings } = useSettings();
  const [preferredTitle, setPreferredTitle] = useState<string | null>(null);

  // Presence shows one title for the whole session, but the meta a launch
  // carries depends on where it came from: a Kitsu addon meta is the Kitsu
  // canonical title (often romaji), while the detail page resolves an English
  // one. Resolve it the same way the cards do so both agree.
  useEffect(() => {
    const id = src.meta.id ?? "";
    const wanted = settings.discordRichPresence || settings.shareWatchPresence;
    if (!wanted || !ANIME_META_ID.test(id)) {
      setPreferredTitle(null);
      return;
    }
    let cancelled = false;
    void resolvePreferredAnimeTitle(id, settings.animeTitleLanguage)
      .then((title) => {
        if (!cancelled) setPreferredTitle(title?.trim() || null);
      })
      .catch(() => {
        if (!cancelled) setPreferredTitle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    src.meta.id,
    settings.animeTitleLanguage,
    settings.discordRichPresence,
    settings.shareWatchPresence,
  ]);

  useEffect(() => {
    if (snap.status !== "playing" && snap.status !== "paused") {
      setPlaybackPresence(null);
      return;
    }
    if (src.meta.id?.startsWith("iptv:")) return;
    const year =
      typeof src.meta.releaseInfo === "string" ? src.meta.releaseInfo.slice(0, 4) : undefined;
    const epLabel =
      season != null && episode != null
        ? `S${src.episode?.imdbSeason ?? season} E${src.episode?.imdbEpisode ?? episode}`
        : undefined;
    const epTitle = src.episode?.name?.trim();
    const epLine = epLabel && epTitle ? `${epLabel} · ${epTitle}` : epLabel;
    const title = preferredTitle ?? src.meta.name ?? "Untitled";
    const publish = () =>
      setPlaybackPresence({
        title,
        subtitle: epLine || year,
        metaId: src.meta.id ?? undefined,
        metaType: src.meta.type ?? undefined,
        posterUrl: src.meta.poster ?? src.episode?.still ?? undefined,
        smallImageUrl: src.episode?.still ?? undefined,
        year,
        paused: snap.status === "paused",
        positionSec: getPlaybackPosition(),
        durationSec: snap.durationSec,
      });
    publish();
    // A resume is applied as a seek after the file loads, so the first publish
    // above can land while the position is still 0 — Discord would then show
    // 0:00 until the slow refresh. Re-publish as soon as the position jumps away
    // from where playback was heading.
    let basePos = getPlaybackPosition();
    let baseAt = Date.now();
    const offClock = subscribePlaybackClock(() => {
      const pos = getPlaybackPosition();
      const at = Date.now();
      if (Math.abs(pos - (basePos + (at - baseAt) / 1000)) <= SEEK_DRIFT_SEC) return;
      basePos = pos;
      baseAt = at;
      publish();
    });
    if (snap.status !== "playing") return offClock;
    const tick = window.setInterval(publish, POSITION_REFRESH_MS);
    return () => {
      window.clearInterval(tick);
      offClock();
    };
  }, [
    snap.status,
    snap.durationSec,
    src.meta.id,
    src.meta.name,
    src.meta.poster,
    src.meta.releaseInfo,
    src.episode?.name,
    src.episode?.still,
    src.liveProgram,
    season,
    episode,
    preferredTitle,
  ]);

  useEffect(() => {
    if (!(src.meta.id?.startsWith("iptv:") ?? false)) return;
    if (snap.status !== "playing" && snap.status !== "paused") {
      setPlaybackPresence(null);
      return;
    }
    if (liveGuideOpen) {
      setPlaybackPresence({
        title: "Browsing the TV guide",
        subtitle: "Live TV",
        paused: false,
        positionSec: 0,
        durationSec: 0,
      });
      return;
    }
    const lead = src.liveProgram || src.meta.name || "Live TV";
    setPlaybackPresence({
      title: `Live · ${lead}`,
      subtitle: src.liveProgram ? src.meta.name : undefined,
      posterUrl: src.meta.poster ?? undefined,
      paused: snap.status === "paused",
      positionSec: 0,
      durationSec: 0,
    });
  }, [liveGuideOpen, snap.status, src.meta.id, src.meta.name, src.meta.poster, src.liveProgram]);

  useEffect(() => () => setPlaybackPresence(null), []);
}
