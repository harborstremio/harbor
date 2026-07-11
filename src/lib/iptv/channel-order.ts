import { channelPlayCount, MOST_WATCHED_MIN } from "./channel-stats";
import type { IptvChannel } from "./types";

export function applyUserChannelOrder(channels: IptvChannel[], pinnedOrder: string[]): IptvChannel[] {
  if (channels.length === 0) return channels;
  const pinRank = new Map<string, number>();
  pinnedOrder.forEach((id, i) => pinRank.set(id, i));
  const pinned: IptvChannel[] = [];
  const watched: Array<{ ch: IptvChannel; n: number }> = [];
  const rest: IptvChannel[] = [];
  for (const ch of channels) {
    if (pinRank.has(ch.id)) {
      pinned.push(ch);
      continue;
    }
    const n = channelPlayCount(ch.id);
    if (n >= MOST_WATCHED_MIN) {
      watched.push({ ch, n });
      continue;
    }
    rest.push(ch);
  }
  if (pinned.length === 0 && watched.length === 0) return channels;
  pinned.sort((a, b) => (pinRank.get(a.id) ?? 0) - (pinRank.get(b.id) ?? 0));
  watched.sort((a, b) => b.n - a.n);
  return [...pinned, ...watched.map((w) => w.ch), ...rest];
}

export function applyUserGroupOrder(groups: string[], prefs: { pinned: string[]; hidden: string[] }): string[] {
  if (prefs.pinned.length === 0 && prefs.hidden.length === 0) return groups;
  const hidden = new Set(prefs.hidden);
  const pinRank = new Map(prefs.pinned.map((g, i) => [g, i] as const));
  const pinned: string[] = [];
  const rest: string[] = [];
  for (const g of groups) {
    if (hidden.has(g)) continue;
    if (pinRank.has(g)) pinned.push(g);
    else rest.push(g);
  }
  pinned.sort((a, b) => (pinRank.get(a) ?? 0) - (pinRank.get(b) ?? 0));
  return [...pinned, ...rest];
}
