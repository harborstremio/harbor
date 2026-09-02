import { MOST_WATCHED_MIN, channelPlayCount } from "@/lib/iptv/channel-stats";
import { promoteTopChannelsToFront, rowsForRegion } from "@/lib/iptv/top-networks";
import type { IptvChannel } from "@/lib/iptv/types";

const UNCATEGORIZED = "Uncategorized";

export type BpGuideOrderArgs = {
  channels: IptvChannel[];
  favoriteIds: ReadonlySet<string>;
  pinnedOrder: string[];
  hiddenGroups: string[];
  region: string;
  promoteNetworks: boolean;
};

// Bands 2 to 5 are the desktop pipeline (applyUserChannelOrder plus the guide's
// promoteTopChannelsToFront gate) reproduced without its React plumbing. Band 1
// is the only addition.
//
// Favourites are emitted in their existing relative order, never in star order.
// Star order reshuffles the top of the guide every time the user stars
// something, which on a D-pad means the row under the cursor changes identity
// mid press.
export function bpGuideOrder(args: BpGuideOrderArgs): IptvChannel[] {
  const { channels, favoriteIds, pinnedOrder, hiddenGroups, region, promoteNetworks } = args;
  if (channels.length === 0) return channels;

  const out: IptvChannel[] = [];
  const taken = new Set<string>();
  const push = (ch: IptvChannel) => {
    if (taken.has(ch.id)) return;
    taken.add(ch.id);
    out.push(ch);
  };

  if (favoriteIds.size > 0) {
    for (const ch of channels) if (favoriteIds.has(ch.id)) push(ch);
  }

  if (pinnedOrder.length > 0) {
    const byId = new Map(channels.map((ch) => [ch.id, ch] as const));
    for (const id of pinnedOrder) {
      const ch = byId.get(id);
      if (ch) push(ch);
    }
  }

  const watched: Array<{ ch: IptvChannel; n: number; i: number }> = [];
  channels.forEach((ch, i) => {
    if (taken.has(ch.id)) return;
    const n = channelPlayCount(ch.id);
    if (n >= MOST_WATCHED_MIN) watched.push({ ch, n, i });
  });
  watched.sort((a, b) => b.n - a.n || a.i - b.i);
  for (const w of watched) push(w.ch);

  const rest = channels.filter((ch) => !taken.has(ch.id));
  const rows = promoteNetworks ? rowsForRegion(region) : [];
  // promoteTopChannelsToFront returns the resolved networks followed by the
  // untouched remainder, so one pass emits band 4 and band 5 together.
  for (const ch of rows.length > 0 ? promoteTopChannelsToFront(rest, rows, rest) : rest) push(ch);

  if (hiddenGroups.length === 0) return out;
  const hidden = new Set(hiddenGroups);
  return out.filter((ch) => !hidden.has(ch.group ?? UNCATEGORIZED));
}
