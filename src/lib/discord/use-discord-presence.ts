import { useEffect, useSyncExternalStore } from "react";
import { useSettings } from "@/lib/settings";
import { useView, type MetaFilter } from "@/lib/view";
import { useTogether } from "@/lib/together/provider";
import { buildInviteUrl } from "@/lib/together/invite";
import { SERVICES } from "@/lib/providers/streaming";
import { awardTypeLabel } from "@/lib/providers/wikidata";
import { awardSourceMeta } from "@/lib/anime-awards";
import { tmdbPerson, tmdbPersonCached } from "@/lib/providers/tmdb/tmdb-people";
import type { Meta } from "@/lib/cinemeta";
import {
  getMangaReading,
  subscribeMangaReading,
  type MangaReadingState,
} from "@/lib/manga-reading-state";
import {
  configureDiscord,
  setBrowsePresence,
  setPartyPresence,
  type BrowsePresence,
} from "./presence";
import { useActivityHint } from "./activity-hint";

const JOIN_BASE = "https://app.harbor.site";

const AWARD_IMG = "https://harbor.site/discord/awards";
const NORMAL_AWARD_IMG: Record<string, string> = {
  oscar: "oscar.png",
  emmy: "emmy.png",
  golden_globe: "golden-globe.png",
  bafta: "bafta.png",
  critics_choice: "critics-choice.png",
  sag: "sag.png",
  cannes: "cannestrophy.png",
  venice: "venice.png",
  berlin: "berlin.png",
};
const ANIME_AWARD_IMG: Record<string, string> = {
  crunchyroll: "crunchyroll-awards.png",
  taaf: "taaf-icon.png",
  jmaf: "jmaf-icon.png",
  r_anime: "r-anime-icon.png",
  animation_kobe: "animation-kobe.png",
};

const STATIC_LABELS: Record<string, BrowsePresence> = {
  home: { details: "Browsing Harbor" },
  discover: { details: "Browsing Discover" },
  movies: { details: "Browsing movies" },
  shows: { details: "Browsing shows" },
  anime: { details: "Browsing anime" },
  manga: { details: "Browsing manga" },
  live: { details: "Watching live TV" },
  library: { details: "Browsing their library" },
  calendar: { details: "Checking the calendar" },
  queue: { details: "Checking the queue" },
  addons: { details: "Browsing the addon store" },
  "addon-detail": { details: "Browsing the addon store" },
  settings: { details: "Tweaking settings" },
  picker: { details: "Picking a stream" },
};

function mangaBrowse(m: NonNullable<MangaReadingState>): BrowsePresence {
  const page =
    typeof m.page === "number" && typeof m.totalPages === "number" && m.totalPages > 0
      ? `Page ${m.page + 1} / ${m.totalPages}`
      : undefined;
  const chapter = m.chapterLabel?.trim() || undefined;
  return {
    details: m.title ? `Reading ${m.title}` : "Reading manga",
    state: [chapter, page].filter(Boolean).join(" · ") || "Manga",
    largeImage: m.cover ?? undefined,
    largeText: m.title || undefined,
  };
}

function metaBrowse(m: Meta): BrowsePresence {
  const year = typeof m.releaseInfo === "string" ? m.releaseInfo.slice(0, 4) : undefined;
  const type = m.type === "series" ? "Series" : m.type === "movie" ? "Movie" : undefined;
  const state = [year, type].filter(Boolean).join(" · ") || undefined;
  return {
    details: `Browsing ${m.name}`,
    state,
    largeImage: m.poster ?? undefined,
    largeText: year ? `${m.name} (${year})` : m.name,
  };
}

function filterBrowse(f: MetaFilter): BrowsePresence {
  const media = f.mediaType === "movie" ? "movies" : "shows";
  if (f.kind === "year") return { details: `Browsing ${f.value} ${media}` };
  if (f.kind === "runtime") return { details: `Browsing ${media} around ${f.value} min` };
  if (f.kind === "country")
    return { details: `Browsing ${media} from ${f.name}`, largeText: f.name };
  return { details: `Browsing ${f.name} ${media}`, largeText: f.name };
}

function personBrowse(name: string, profilePath: string | null): BrowsePresence {
  return {
    details: name || "Looking someone up",
    state: "Cast & crew",
    largeImage: profilePath ? `https://image.tmdb.org/t/p/w300${profilePath}` : undefined,
    largeText: name || undefined,
  };
}

export function useDiscordPresence(): void {
  const { settings } = useSettings();
  const { topKind, service, meta, awardType, animeAwardSource, filter, personId } = useView();
  const hint = useActivityHint();
  const { snapshot } = useTogether();
  const relayUrl = settings.togetherRelayUrl;
  const manga = useSyncExternalStore(subscribeMangaReading, getMangaReading, getMangaReading);

  useEffect(() => {
    configureDiscord({
      enabled: settings.discordRichPresence,
      hideTitle: settings.discordHideTitle,
      showWhenPaused: settings.discordShowWhenPaused,
      showWhenBrowsing: settings.discordShowWhenBrowsing,
      showPoster: settings.discordShowPoster,
      showTimestamp: settings.discordShowTimestamp,
      showPartyJoin: settings.discordShowPartyJoin,
    });
  }, [
    settings.discordRichPresence,
    settings.discordHideTitle,
    settings.discordShowWhenPaused,
    settings.discordShowWhenBrowsing,
    settings.discordShowPoster,
    settings.discordShowTimestamp,
    settings.discordShowPartyJoin,
  ]);

  useEffect(() => {
    if (topKind === "player") return;
    if (hint) {
      setBrowsePresence(hint);
      return;
    }
    if (manga) {
      setBrowsePresence(mangaBrowse(manga));
      return;
    }
    if (topKind === "meta" && meta) {
      setBrowsePresence(metaBrowse(meta));
      return;
    }
    if (topKind === "service" && service) {
      setBrowsePresence({ details: `Browsing ${SERVICES[service]?.name ?? "a service"}` });
      return;
    }
    if (topKind === "award" && awardType) {
      const label = awardTypeLabel(awardType, 2);
      const file = NORMAL_AWARD_IMG[awardType];
      setBrowsePresence({
        details: `Browsing ${label}`,
        state: "Awards",
        largeImage: file ? `${AWARD_IMG}/${file}?v=2` : undefined,
        largeText: label,
      });
      return;
    }
    if (topKind === "anime-award" && animeAwardSource) {
      const name = awardSourceMeta(animeAwardSource)?.name;
      const file = ANIME_AWARD_IMG[animeAwardSource];
      setBrowsePresence({
        details: name ? `Browsing ${name}` : "Browsing anime awards",
        state: "Awards",
        largeImage: file ? `${AWARD_IMG}/${file}?v=2` : undefined,
        largeText: name ?? "Anime awards",
      });
      return;
    }
    if (topKind === "filter" && filter) {
      setBrowsePresence(filterBrowse(filter));
      return;
    }
    if (topKind === "person" && personId != null) {
      const cached = tmdbPersonCached(personId);
      if (cached) {
        setBrowsePresence(personBrowse(cached.name, cached.profilePath));
        return;
      }
      setBrowsePresence({ details: "Looking someone up" });
      let cancelled = false;
      void tmdbPerson(settings.tmdbKey, personId).then((p) => {
        if (!cancelled && p) setBrowsePresence(personBrowse(p.name, p.profilePath));
      });
      return () => {
        cancelled = true;
      };
    }
    setBrowsePresence(STATIC_LABELS[topKind] ?? { details: "Browsing Harbor" });
  }, [
    topKind,
    service,
    meta,
    awardType,
    animeAwardSource,
    filter,
    personId,
    settings.tmdbKey,
    hint,
    manga,
  ]);

  useEffect(() => {
    if (snapshot.state !== "joined" || !snapshot.room) {
      setPartyPresence(null);
      return;
    }
    const joinUrl = relayUrl ? buildInviteUrl(relayUrl, snapshot.room, JOIN_BASE) : undefined;
    setPartyPresence({
      id: snapshot.room,
      size: Math.max(1, snapshot.participants.length),
      joinUrl,
    });
  }, [snapshot.state, snapshot.room, snapshot.participants.length, relayUrl]);
}
