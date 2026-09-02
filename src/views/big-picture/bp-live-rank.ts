import { channelPlayCount } from "@/lib/iptv/channel-stats";
import { resolveNetworks, rowsForRegion } from "@/lib/iptv/top-networks";
import type { EpgIndex, IptvChannel } from "@/lib/iptv/types";
import { channelNumber } from "@/views/live/live-home/now-format";
import { buildBpGuide, type NowItem } from "./use-bp-live";

export const BP_LIVE_CELLS = 16;
export const BP_LIVE_MIN_CELLS = 4;

const SCAN_CAP = 4000;
const NETWORK_SCAN_CAP = 2000;
const ADMIT_MIN = 8;

// Tested against name and group together, so a channel whose name is clean but
// whose group carries the marker still pays. Penalties sum; none of these are
// exclusive. scoreChannel in top-networks.ts is not exported, and this table is
// the replacement rather than a second copy of it.
const JUNK: ReadonlyArray<{ re: RegExp; penalty: number }> = [
  { re: /(^|[^a-z0-9])24\s*[\/x]\s*7([^a-z0-9]|$)/i, penalty: -45 },
  { re: /[#*=~_]{2,}/, penalty: -40 },
  { re: /\b(raw|backup|feed|mirror|secondary|dummy|test|tmp|temp)\b/i, penalty: -30 },
  { re: /\b\d{2,3}\s*fps\b/i, penalty: -30 },
  { re: /\b(ppv|vip)\b/i, penalty: -25 },
  { re: /\b(alt|altern\w*)\b/i, penalty: -20 },
  { re: /\bstream\s*\d{1,2}\b/i, penalty: -20 },
  { re: /\(/, penalty: -18 },
  { re: /\bsd\b/i, penalty: -12 },
];

export type BpRankInput = {
  channels: IptvChannel[];
  guide: NowItem[];
  epg: EpgIndex | null;
  tvgCounts: ReadonlyMap<string, number>;
  nowMs: number;
  region: string;
  favoriteIds: ReadonlySet<string>;
};

type RankCtx = {
  networkIds: ReadonlySet<string>;
  tvgCounts: ReadonlyMap<string, number>;
  favoriteIds: ReadonlySet<string>;
};

function score(it: NowItem, ctx: RankCtx): number {
  const { channel, current } = it;
  let s = 0;

  if (current) s += 40;
  if (current?.iconUrl) s += 14;

  if (ctx.networkIds.has(channel.id)) s += 12;
  if (channel.logo) s += 10;
  if (channelNumber(channel.attrs)) s += 8;
  if (channel.tvgId && ctx.tvgCounts.get(channel.tvgId) === 1) s += 6;

  if (ctx.favoriteIds.has(channel.id)) s += 20;
  s += Math.min(18, 6 * channelPlayCount(channel.id));

  if (current) {
    const p = it.progress ?? 0;
    if (p >= 0.9) s -= 8;
    else if (p <= 0.15) s += 6;
    else if (p <= 0.55) s += 3;
  }

  const haystack = `${channel.name} ${channel.group ?? ""}`;
  for (const rule of JUNK) {
    if (rule.re.test(haystack)) s += rule.penalty;
  }

  return s;
}

function dedupeById(items: NowItem[]): NowItem[] {
  const seen = new Set<string>();
  const out: NowItem[] = [];
  for (const it of items) {
    if (seen.has(it.channel.id)) continue;
    seen.add(it.channel.id);
    out.push(it);
  }
  return out;
}

// Resolving 2000 channels against 121 network definitions is the single most
// expensive thing in this row, and it cannot change until the playlist or the
// region does. The row's memo also depends on nowMs, which advances at every
// programme boundary, so without this one entry cache the whole pass would rerun
// on the home screen every few minutes for a result that is already known.
let netChannels: IptvChannel[] | null = null;
let netRegion = "";
let netIds: ReadonlySet<string> = new Set<string>();

function networkIdsFor(channels: IptvChannel[], region: string): ReadonlySet<string> {
  if (netChannels === channels && netRegion === region) return netIds;
  const defs = rowsForRegion(region).flatMap((row) => row.networks);
  netIds = new Set(
    resolveNetworks(channels.slice(0, NETWORK_SCAN_CAP), defs).map((r) => r.channel.id),
  );
  netChannels = channels;
  netRegion = region;
  return netIds;
}

export function rankBpLive(input: BpRankInput): NowItem[] {
  const networkIds = networkIdsFor(input.channels, input.region);

  const pool = dedupeById([
    ...input.guide,
    ...buildBpGuide(
      input.channels.slice(0, SCAN_CAP),
      input.epg,
      input.tvgCounts,
      input.nowMs,
    ),
  ]);

  const ctx: RankCtx = {
    networkIds,
    tvgCounts: input.tvgCounts,
    favoriteIds: input.favoriteIds,
  };

  // Favourites are a band, not a bonus. The +20 in score() is 20 out of a
  // reachable ~90, so a starred channel with a thin EPG topped out near 56 while
  // an unstarred one with programme, icon, network, logo, number and a unique
  // tvgId reached 90 and pushed it out of the sixteen entirely. A star has to
  // mean the channel is here, so it partitions first and skips ADMIT_MIN.
  //
  // Array.prototype.sort is spec-stable, but the tiebreak is written out anyway
  // because the pool is two concatenated lists and a silent reorder between them
  // would move the row under the ring for no reason a reader could see.
  const scored = pool.map((it, i) => ({
    it,
    i,
    s: score(it, ctx),
    fav: ctx.favoriteIds.has(it.channel.id),
  }));
  scored.sort((a, b) => Number(b.fav) - Number(a.fav) || b.s - a.s || a.i - b.i);

  const admitted = scored.filter((x) => x.fav || x.it.current != null || x.s >= ADMIT_MIN);
  let out = admitted.slice(0, BP_LIVE_CELLS);

  // A playlist with no EPG and no logos would otherwise clear the row entirely.
  // The top-up ignores ADMIT_MIN on purpose: something is owed to a user who
  // configured a playlist, even when every candidate scored zero.
  if (out.length < BP_LIVE_MIN_CELLS) {
    out = scored.slice(0, Math.min(BP_LIVE_MIN_CELLS, scored.length));
  }

  return out.map((x) => x.it);
}
