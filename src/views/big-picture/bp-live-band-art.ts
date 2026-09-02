import { formatTimeLabel } from "@/views/live/guide/guide-utils";
import type { NowItem } from "./use-bp-live";
import type { BpBandArt } from "./use-bp-sections";

export type BpT = (key: string, vars?: Record<string, string | number>) => string;

// posters carries the next programme's title, not a poster grid. BpBandArt lives
// in use-bp-sections and cannot gain a field, and the live band declares
// mosaic: false, so bp-ambient never reads this as a mosaic. The trap: same()
// compares posters by length alone, so republishing one key with a different
// one-entry array is swallowed in silence. Safe only because the key changes per
// channel and title changes at rollover. Never rely on the array alone.
export function bpLiveBandArt(
  item: NowItem,
  sourceId: string,
  art: string | undefined,
  t: BpT,
): BpBandArt {
  const { channel, current, next } = item;
  const nextTitle = next?.title?.trim();
  return {
    key: `iptv:${sourceId}:${channel.id}`,
    src: art,
    title: current?.title ?? channel.name,
    line: current
      ? t("Started at {time}", { time: formatTimeLabel(current.startMs) })
      : (channel.group ?? t("Live")),
    logo: channel.logo ?? undefined,
    logoScale: "bug",
    posters: nextTitle ? [nextTitle] : undefined,
  };
}

export function bpLiveNextTitle(art: BpBandArt | null | undefined): string | null {
  const first = art?.posters?.[0];
  return first ? first : null;
}
