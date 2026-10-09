import { useMemo, useState } from "react";
import { useChannelStatsVersion } from "@/lib/iptv/channel-stats";
import { useFavorites } from "@/lib/iptv/favorites";
import { useGroupPrefs } from "@/lib/iptv/group-order";
import { usePinnedOrder } from "@/lib/iptv/pins";
import type { IptvChannel } from "@/lib/iptv/types";
import { useSettings } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import { BpGrid, BpGridScroller } from "./bp-grid";
import { BpGuide } from "./bp-guide";
import { bpGuideOrder } from "./bp-guide-order";
import { useBpT } from "./bp-i18n";
import { BP_CHIP_EDGE_MASK } from "./bp-library-chips";
import { BpGuideCellSkeleton } from "./bp-live-cell";
import { BpLiveFilters } from "./bp-live-filters";
import { BpLiveSetup } from "./bp-live-setup";
import { BpLiveSourceButton } from "./bp-live-source-button";
import { BpLiveSources } from "./bp-live-sources";
import { useBpPersistedState } from "./bp-view-state";
import { useBpGuideData } from "./use-bp-guide-data";
import { useBpLive } from "./use-bp-live";

const GRID_COLUMNS = "repeat(auto-fill, minmax(clamp(300px, 25vw, 440px), 1fr))";
const MAX_CATEGORIES = 30;
const UNCATEGORIZED = "Uncategorized";
const FAV_KEY = "fav";
const ALL_KEY = "all";

const EDGE_MASK = BP_CHIP_EDGE_MASK;

// Derived from the top bar's own height, never a parallel clamp. Two clamps
// that were meant to match drifted by 6px and the chips sat under the bar.
const BAND_TOP = "calc(var(--bp-bar-h) + clamp(5px,0.64vh,10px))";

type BpLiveCategory = {
  key: string;
  label: string;
  translateLabel?: boolean;
  flagCode?: string;
  star?: boolean;
  channels: IptvChannel[];
};

export function BpLive() {
  const t = useBpT();
  const live = useBpLive();
  const favorites = useFavorites();
  const pinnedOrder = usePinnedOrder();
  const groupPrefs = useGroupPrefs(live.activeId);
  const statsVersion = useChannelStatsVersion();
  const { settings } = useSettings();
  const [key, setKey] = useBpPersistedState<string>("liveCategory", ALL_KEY);

  const categories = useMemo<BpLiveCategory[]>(() => {
    const rails = [...live.rails, ...live.categoryRails];
    const fav = rails.find((rail) => rail.key === FAV_KEY);
    // Favourites is pinned to slot zero here rather than taken from the rail
    // order, so it can never move or vanish when use-live-home reshuffles.
    const out: BpLiveCategory[] = [
      {
        key: FAV_KEY,
        label: "Favorites",
        translateLabel: true,
        star: true,
        channels: fav?.channels ?? [],
      },
      { key: ALL_KEY, label: "All", translateLabel: true, channels: live.channels },
    ];
    const hidden = new Set(groupPrefs.hidden);
    for (const rail of rails) {
      if (rail.key === FAV_KEY) continue;
      if (out.length >= MAX_CATEGORIES) break;
      if (rail.group != null && hidden.has(rail.group)) continue;
      // railFor caps every group rail at 30 channels, which silently truncated
      // Sports on a 400 channel playlist. Group rails are re-derived from the
      // full list here; the theme rails cannot be, their regex table is private
      // to use-live-home.
      const channels =
        rail.group != null
          ? live.channels.filter((c) => (c.group ?? UNCATEGORIZED) === rail.group)
          : rail.channels;
      if (channels.length === 0) continue;
      out.push({
        key: rail.key,
        label: rail.title,
        flagCode: rail.flagCode,
        channels,
      });
    }
    return out;
  }, [live.channels, live.rails, live.categoryRails, groupPrefs.hidden]);

  const category =
    categories.find((c) => c.key === key) ??
    categories.find((c) => c.key === ALL_KEY) ??
    categories[0];

  // Keyed on the channel array, never on the category object: use-live-home
  // rebuilds every rail on each programme boundary tick, and the network
  // resolver behind promoteNetworks is a few hundred regex passes per channel.
  const { key: catKey, channels: catChannels } = category;
  const ordered = useMemo(
    () =>
      bpGuideOrder({
        channels: catChannels,
        favoriteIds: favorites.ids,
        pinnedOrder,
        hiddenGroups: groupPrefs.hidden,
        region: settings.region,
        promoteNetworks: catKey === ALL_KEY,
      }),
    [
      catChannels,
      catKey,
      favorites.ids,
      pinnedOrder,
      groupPrefs.hidden,
      settings.region,
      statsVersion,
    ],
  );

  const guide = useBpGuideData({
    channels: ordered,
    epg: live.epg,
    tvgCounts: live.tvgCounts,
    nowMs: live.nowMs,
  });

  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesAdd, setSourcesAdd] = useState(false);
  const empty = guide.rows.length === 0;
  // First run only, when nothing has ever been added. Once a provider exists,
  // switching and adding both happen in the sources sheet OVER the live guide,
  // never by replacing it. Do NOT fold an add flag back into showSetup: routing
  // "Add" through here is what used to blank the guide.
  const showSetup = !live.loading && !live.hasPlaylists;
  const activeSource = live.sources.find((s) => s.id === live.activeId) ?? live.sources[0] ?? null;
  const emptyCopy = bpLiveEmptyCopy({ error: live.error, favorites: catKey === FAV_KEY, t });
  const openSources = (add: boolean) => {
    setSourcesAdd(add);
    setSourcesOpen(true);
  };

  return (
    <div className="flex h-full flex-col">
      {!showSetup &&
        activeSource && (
          // The mask stays on this tall container, never on the filter row: it is
          // a horizontal fade and clips nothing vertically, so the segment ring
          // has room, and the source button sits at the gutter well clear of the
          // fade so it never dims.
          <div
            className="flex shrink-0 flex-col gap-[clamp(7px,0.9vh,15px)] px-[var(--bp-gutter)] pb-[clamp(7px,0.96vh,16px)]"
            style={{
              paddingTop: BAND_TOP,
              maskImage: EDGE_MASK,
              WebkitMaskImage: EDGE_MASK,
            }}
          >
            <BpLiveSourceButton
              name={activeSource.name}
              channelCount={live.channels.length}
              onOpen={() => openSources(false)}
            />
            <BpLiveFilters
              items={categories.map((c) => ({
                key: c.key,
                label: c.label,
                translateLabel: c.translateLabel,
                count: c.channels.length,
                star: c.star,
                flagCode: c.flagCode,
              }))}
              activeKey={catKey}
              onSelect={setKey}
            />
          </div>
        )}

      {showSetup && (
        // First run stands alone with no band above it, so it owns the top-bar
        // clearance the band used to provide. pt-14 here would lay the heading
        // under the nav.
        <div
          data-bp-scroll-y
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[var(--bp-gutter)] pt-[var(--bp-page-top)] pb-[var(--bp-hint-h)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <BpLiveSetup />
        </div>
      )}

      {!showSetup && !empty && (
        <BpGuide
          rows={guide.rows}
          laneFor={guide.laneFor}
          nowMs={live.nowMs}
          sourceId={live.activeId}
          resetKey={`${live.activeId}:${catKey}`}
          onPlay={live.play}
        />
      )}

      {!showSetup && empty && (
        <div className="flex min-h-0 flex-1 flex-col px-[var(--bp-gutter)] pb-[var(--bp-hint-h)]">
          {live.loading ? (
            <BpGridScroller>
              <div aria-hidden>
                <BpGrid columns={GRID_COLUMNS} gap="clamp(11px,1vw,20px)">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <BpGuideCellSkeleton key={i} fluid />
                  ))}
                </BpGrid>
              </div>
            </BpGridScroller>
          ) : (
            // One setup entry point, and it is the branch above with a scroller.
            // A second BpLiveSetup used to sit here as a third arm that showSetup
            // had already made unreachable, and it had no overflow-y-auto, so had
            // anything ever reached it the fields would have run off a 641px panel.
            <BpLiveEmpty
              title={emptyCopy.title}
              body={emptyCopy.body}
              action={emptyCopy.action}
              onAction={() => {
                if (emptyCopy.kind === "retry") live.refresh();
                else if (emptyCopy.kind === "all") setKey(ALL_KEY);
                else openSources(true);
              }}
            />
          )}
        </div>
      )}

      {sourcesOpen && activeSource && (
        <BpLiveSources
          sources={live.sources}
          activeId={live.activeId}
          channelCount={live.channels.length}
          startInAdd={sourcesAdd}
          onPick={live.setActiveId}
          onAdded={live.setActiveId}
          onClose={() => setSourcesOpen(false)}
        />
      )}
    </div>
  );
}

function bpLiveEmptyCopy(args: {
  error: string | null;
  favorites: boolean;
  t: (key: string) => string;
}): { title: string; body: string; action: string; kind: "retry" | "all" | "add" } {
  const { error, favorites, t } = args;
  if (error) {
    return {
      title: t("Couldn't load this playlist"),
      body: error,
      action: t("Try again"),
      kind: "retry",
    };
  }
  if (favorites) {
    return {
      title: t("No favorites yet"),
      body: t("Press the star on any channel to keep it at the top of the guide."),
      action: t("Show all channels"),
      kind: "all",
    };
  }
  return {
    title: t("No channels here"),
    body: t("This playlist came back without any live channels."),
    action: t("Add a playlist"),
    kind: "add",
  };
}

function BpLiveEmpty({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(6px,0.8vh,12px)] text-center">
      <h2 className="font-display text-[clamp(28px,3.8vh,38px)] font-semibold text-ink">{title}</h2>
      <p className="max-w-[52ch] text-[clamp(17px,2.3vh,22px)] font-medium leading-snug text-ink-subtle">
        {body}
      </p>
      <button
        type="button"
        data-bp-focusable
        data-bp-chip
        onClick={() => {
          SFX.click();
          onAction();
        }}
        className="mt-[clamp(8px,1.2vh,20px)] h-[clamp(56px,6.6vh,72px)] shrink-0 rounded-[var(--bp-r-md)] border border-transparent bg-[var(--bp-on)] px-[clamp(24px,2.2vw,42px)] text-[clamp(17px,2.2vh,24px)] font-semibold text-ink"
      >
        {action}
      </button>
    </div>
  );
}
