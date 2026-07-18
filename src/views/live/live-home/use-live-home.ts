import { useMemo } from "react";
import { computeTvgIdCounts, epgProgramsForChannel } from "@/lib/iptv/epg-resolver";
import { findCurrent } from "@/lib/iptv/xmltv";
import {
  recentChannels,
  topChannels,
  useChannelStatsVersion,
  type ChannelStat,
} from "@/lib/iptv/channel-stats";
import { useGroupPrefs } from "@/lib/iptv/group-order";
import { useCountryPrefs } from "@/lib/iptv/country-prefs";
import {
  detectCountryFromGroup,
  indexChannelsByCountry,
  stripCountryPrefix,
  type Country,
} from "@/lib/iptv/country-detect";
import { useFavorites, type StoredFavorite } from "@/lib/iptv/favorites";
import type { EpgIndex, EpgProgram, IptvChannel } from "@/lib/iptv/types";

export type NowItem = {
  channel: IptvChannel;
  current: EpgProgram | null;
  next: EpgProgram | null;
  progress: number | null;
};

export type ChannelRail = {
  key: string;
  title: string;
  group: string | null;
  flagCode?: string;
  channels: IptvChannel[];
};

type Favorites = ReturnType<typeof useFavorites>;

export function hydrationKey(item: NowItem): string {
  return item.current?.title?.trim() || item.channel.name;
}

export function buildNowItem(
  ch: IptvChannel,
  epg: EpgIndex | null,
  tvgCounts: ReadonlyMap<string, number>,
  nowMs: number,
): NowItem {
  const programs = epgProgramsForChannel(ch, epg, tvgCounts);
  const { current, next } = findCurrent(programs, nowMs);
  const progress =
    current && current.endMs > current.startMs
      ? Math.max(0, Math.min(1, (nowMs - current.startMs) / (current.endMs - current.startMs)))
      : null;
  return { channel: ch, current, next, progress };
}

const UNCATEGORIZED = "Uncategorized";
const MIN_COUNTRY = 4;
const MAX_RAILS = 120;
const THEME_CAP = 60;
const JUNK_RE =
  /\b(xxx|adult|adults|porn|ppv|vip|sex|hardcore|nsfw)\b|18\s*\+|\+\s*18|^[\s#*\-=._|~>]+$/i;

const THEMES: Array<{ key: string; title: string; re: RegExp }> = [
  {
    key: "sports",
    title: "Sports",
    re: /\b(sports?|espn|bein|sky\s?sport|nfl|nba|mlb|nhl|ufc|wwe|boxing|football|soccer|dazn|fubo|golf|tennis|nascar|motogp|formula)\b/i,
  },
  {
    key: "news",
    title: "News",
    re: /\b(news|cnn|bbc|msnbc|cnbc|bloomberg|newsmax|gb\s?news|al\s?jazeera|sky\s?news|fox\s?news)\b/i,
  },
  {
    key: "movies",
    title: "Movies",
    re: /\b(movies?|cinema|film|films|hbo|cinemax|starz|showtime|tcm|mgm|paramount)\b/i,
  },
  {
    key: "kids",
    title: "Kids & Family",
    re: /\b(kids?|cartoon|disney|nick|nickelodeon|junior|baby|boomerang|cbeebies|pbs\s?kids)\b/i,
  },
  {
    key: "entertainment",
    title: "Entertainment",
    re: /\b(entertain\w*|comedy|drama|lifestyle|reality|bravo|tlc|usa\s?network|tnt|fx|amc)\b/i,
  },
  {
    key: "docs",
    title: "Documentary",
    re: /\b(document\w*|discovery|history|nat\s?geo|national\s?geographic|science|animal|smithsonian)\b/i,
  },
  { key: "music", title: "Music", re: /\b(music|mtv|vevo|vh1|kerrang|stingray|trace|hits)\b/i },
];

function isJunk(group: string): boolean {
  return JUNK_RE.test(group);
}

function statToChannel(s: ChannelStat): IptvChannel {
  return {
    id: s.id,
    tvgId: null,
    name: s.name,
    logo: s.logo,
    group: s.group,
    url: s.url,
    catchupSource: null,
    durationSec: null,
    attrs: {},
  };
}

function favToChannel(f: StoredFavorite): IptvChannel {
  return {
    id: f.id,
    tvgId: f.tvgId,
    name: f.name,
    logo: f.logo,
    group: f.group,
    url: f.url,
    catchupSource: null,
    durationSec: null,
    attrs: {},
  };
}

function railFor(g: string, channels: IptvChannel[], code?: string): ChannelRail {
  return {
    key: code ? `co:${code}:${g}` : `cat:${g}`,
    title: stripCountryPrefix(g),
    group: g,
    flagCode: code ?? detectCountryFromGroup(g)?.code,
    channels: channels.slice(0, 30),
  };
}

export function useLiveHome(params: {
  channels: IptvChannel[];
  epg: EpgIndex | null;
  nowMs: number;
  sourceId: string;
  region: string;
  favorites: Favorites;
}): {
  spotlight: NowItem[];
  tiles: IptvChannel[];
  guide: NowItem[];
  rails: ChannelRail[];
  categoryRails: ChannelRail[];
  countries: Array<Country & { count: number }>;
} {
  const { channels, epg, nowMs, sourceId, favorites } = params;
  const prefs = useGroupPrefs(sourceId);
  const countryPrefs = useCountryPrefs(sourceId);
  const statsVersion = useChannelStatsVersion();

  const index = useMemo(() => {
    const byId = new Map<string, IptvChannel>();
    const byGroup = new Map<string, IptvChannel[]>();
    const themeCh: Record<string, IptvChannel[]> = {};
    for (const t of THEMES) themeCh[t.key] = [];
    for (const ch of channels) {
      byId.set(ch.id, ch);
      const g = ch.group ?? UNCATEGORIZED;
      let arr = byGroup.get(g);
      if (!arr) {
        arr = [];
        byGroup.set(g, arr);
      }
      arr.push(ch);
      const name = ch.name;
      for (const t of THEMES) {
        const tc = themeCh[t.key];
        if (tc.length < THEME_CAP && (t.re.test(g) || t.re.test(name))) tc.push(ch);
      }
    }
    const topGroups = [...byGroup.entries()]
      .filter(([g, a]) => !isJunk(g) && a.length >= 4)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([g]) => g);
    return { byId, byGroup, themeCh, topGroups };
  }, [channels]);

  const tvgCounts = useMemo(() => computeTvgIdCounts(channels), [channels]);
  const { channelsByCountry, countries } = useMemo(
    () => indexChannelsByCountry(channels),
    [channels],
  );

  const out = useMemo(() => {
    const { byId, byGroup, themeCh, topGroups } = index;
    const item = (ch: IptvChannel) => buildNowItem(ch, epg, tvgCounts, nowMs);

    const recentCh = recentChannels(20, sourceId).map((s) => byId.get(s.id) ?? statToChannel(s));
    const topCh = topChannels(20, sourceId).map((s) => byId.get(s.id) ?? statToChannel(s));
    const favCh = [...favorites.items.values()]
      .filter((f) => (f.sourceId === sourceId || byId.has(f.id)) && (byId.get(f.id)?.url || f.url))
      .map((f) => byId.get(f.id) ?? favToChannel(f));

    const guide: NowItem[] = [];
    const gseen = new Set<string>();
    const pushGuide = (ch: IptvChannel) => {
      if (gseen.has(ch.id)) return;
      const it = item(ch);
      if (!it.current) return;
      gseen.add(ch.id);
      guide.push(it);
    };
    for (const ch of [...recentCh, ...favCh, ...topCh]) pushGuide(ch);
    for (let i = 0; i < channels.length && i < 600 && guide.length < 16; i += 1)
      pushGuide(channels[i]);

    const tiles: IptvChannel[] = [];
    const tseen = new Set<string>();
    const pushTile = (ch?: IptvChannel | null) => {
      if (!ch || !ch.logo || tseen.has(ch.id)) return;
      tseen.add(ch.id);
      tiles.push(ch);
    };
    for (const ch of [...favCh, ...topCh]) pushTile(ch);
    for (let i = 0; i < channels.length && i < 400 && tiles.length < 18; i += 1)
      pushTile(channels[i]);

    const seen = new Set<string>();
    const pool: IptvChannel[] = [];
    for (const ch of [...favCh, ...topCh, ...recentCh]) {
      if (seen.has(ch.id)) continue;
      seen.add(ch.id);
      pool.push(ch);
    }
    const score = (it: NowItem) =>
      (it.current ? 4 : 0) + (it.current?.iconUrl ? 2 : 0) + (it.channel.logo ? 1 : 0);
    const spotlight = pool
      .map((ch, i) => ({ it: item(ch), i }))
      .sort((a, b) => score(b.it) - score(a.it) || a.i - b.i)
      .slice(0, 6)
      .map((x) => x.it);
    if (spotlight.length === 0) spotlight.push(...channels.slice(0, 6).map(item));

    const rails: ChannelRail[] = [];
    const used = new Set<string>();
    if (recentCh.length)
      rails.push({ key: "recent", title: "Continue watching", group: null, channels: recentCh });
    if (favCh.length)
      rails.push({ key: "fav", title: "Your favorites", group: null, channels: favCh });
    for (const g of prefs.pinned) {
      if (used.has(g) || !byGroup.has(g)) continue;
      rails.push(railFor(g, byGroup.get(g) ?? []));
      used.add(g);
    }

    const categoryRails: ChannelRail[] = [];
    const selected = countryPrefs.selected.filter((c) => channelsByCountry.has(c));
    if (selected.length) {
      for (const code of selected.slice(0, 6)) {
        const inCountry = new Map<string, IptvChannel[]>();
        for (const ch of channelsByCountry.get(code) ?? []) {
          const g = ch.group ?? UNCATEGORIZED;
          let arr = inCountry.get(g);
          if (!arr) {
            arr = [];
            inCountry.set(g, arr);
          }
          arr.push(ch);
        }
        const ordered = [...inCountry.entries()]
          .filter(([g]) => !isJunk(g))
          .sort((a, b) => b[1].length - a[1].length);
        for (const [g, chs] of ordered) {
          if (categoryRails.length >= MAX_RAILS) break;
          categoryRails.push(railFor(g, chs, code));
        }
        if (categoryRails.length >= MAX_RAILS) break;
      }
    } else {
      for (const t of THEMES) {
        const chs = themeCh[t.key];
        if (chs.length >= 3)
          categoryRails.push({
            key: `theme:${t.key}`,
            title: t.title,
            group: null,
            channels: chs.slice(0, 30),
          });
      }
      for (const g of topGroups) {
        if (categoryRails.length >= MAX_RAILS) break;
        if (used.has(g)) continue;
        categoryRails.push(railFor(g, byGroup.get(g) ?? []));
      }
    }

    return { spotlight, tiles, guide, rails, categoryRails };
  }, [
    channels,
    epg,
    nowMs,
    sourceId,
    prefs,
    favorites.items,
    statsVersion,
    index,
    tvgCounts,
    channelsByCountry,
    countryPrefs.selected,
  ]);

  return { ...out, countries: countries.filter((c) => c.count >= MIN_COUNTRY) };
}
