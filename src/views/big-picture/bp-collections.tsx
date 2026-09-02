import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { pushBigPicture } from "@/lib/big-picture";
import { BpGrid, BpGridScroller } from "./bp-grid";
import { BpChip, BpChipRow } from "./bp-library-chips";
import { useBpT } from "./bp-i18n";
import { useBpPersistedState } from "./bp-view-state";
import {
  BpCollectionCard,
  BpCollectionCardSkeleton,
  BpCollectionMoreCard,
} from "./bp-collection-card";
import { BpCollectionItems } from "./bp-collection-items";
import { BpConnect } from "./bp-connect";
import { publishBpBand } from "./use-bp-sections";
import { BP_COLLECTIONS_ALL, BP_COLLECTION_CATEGORIES, type BpCollectionTarget } from "./use-bp-collections";
import { setBpFocus } from "./use-bp-focus";
import {
  BP_COLLECTION_SOURCES,
  useBpCollectionFeed,
  type BpCollectionEntry,
  type BpCollectionFeed,
  type BpCollectionOpen,
  type BpCollectionSource,
} from "./use-bp-collection-feed";

type BpItemsOpen = Extract<BpCollectionOpen, { kind: "items" }>;

const GRID_COLUMNS = "repeat(auto-fill, minmax(clamp(196px, 16vw, 320px), 1fr))";
const GRID_GAP = "clamp(11px,1vw,20px)";
const PLACEHOLDERS = 8;

const SOURCE_LABELS: Record<BpCollectionSource, string> = {
  all: "All",
  mine: "Mine",
  community: "Community",
  tmdb: "TMDB",
  tvdb: "TVDB",
};

function BpSourceRow({
  options,
  active,
  label,
  onPick,
  keyPrefix,
  trailing,
  autofocus,
}: {
  options: readonly string[];
  active: string;
  label: (value: string) => string;
  onPick: (value: string) => void;
  keyPrefix: string;
  trailing?: ReactNode;
  /** Hold the page's arrival seed while there is no card to hand it to. */
  autofocus?: boolean;
}) {
  return (
    <BpChipRow trailing={trailing}>
      {options.map((value) => (
        <BpChip
          key={value}
          label={label(value)}
          selected={active === value}
          restoreKey={`${keyPrefix}:${value}`}
          autofocus={autofocus && active === value}
          onSelect={() => onPick(value)}
        />
      ))}
    </BpChipRow>
  );
}

function endMessage(
  t: (key: string, vars?: Record<string, string | number>) => string,
  source: BpCollectionSource,
  empty: boolean,
  feed: BpCollectionFeed,
): string {
  const broke = feed.communityFailed || feed.tvdbFailed;
  if (empty) {
    if (source === "mine") return t("You have not made a collection yet.");
    if (source === "community") {
      return feed.communityFailed
        ? t("Community collections are unavailable right now.")
        : t("Nobody has shared a collection yet.");
    }
    if (source === "tvdb" && feed.tvdbFailed) {
      return t("TVDB lists are unavailable right now.");
    }
    return t("Nothing to show here yet.");
  }
  if (source === "tvdb") {
    return feed.tvdbFailed
      ? t("That's every TVDB list we could reach. Some are unavailable right now.")
      : t("That's every TVDB list we could find.");
  }
  if (source === "community") return t("That's every shared collection right now.");
  if (source === "mine") return t("That's all of your collections.");
  if (source === "all" && broke) {
    return t("That's everything we could reach. Some sources are unavailable right now.");
  }
  return t("That's every collection TMDB knows about.");
}

export function BpCollections({ onOpen }: { onOpen: (target: BpCollectionTarget) => void }) {
  const t = useBpT();
  const { settings } = useSettings();
  const [source, setSource] = useBpPersistedState<BpCollectionSource>("collectionSource", "all");
  const [category, setCategory] = useBpPersistedState<string>(
    "collectionCategory",
    BP_COLLECTIONS_ALL,
  );
  const [items, setItems] = useState<{ open: BpItemsOpen; key: string } | null>(null);
  useEffect(() => {
    publishBpBand("collections");
    return () => publishBpBand(null);
  }, []);
  const feed = useBpCollectionFeed(source, source === "tmdb" ? category : BP_COLLECTIONS_ALL);
  const lastTvdb = feed.tvdbCapped
    ? feed.entries.map((e) => e.source).lastIndexOf("tvdb")
    : -1;

  const open = useCallback(
    (entry: BpCollectionEntry) => {
      if (entry.open.kind === "tmdb") {
        onOpen({
          collectionId: entry.open.collectionId,
          name: entry.open.name,
          image: entry.open.image,
        });
        return;
      }
      if (entry.open.kind === "tvdb") {
        pushBigPicture({
          kind: "collection",
          collectionId: entry.open.collectionId,
          name: entry.open.name,
          image: entry.open.image,
        });
        return;
      }
      setItems({ open: entry.open, key: entry.key });
    },
    [onOpen],
  );

  const empty = feed.entries.length === 0 && feed.done;
  const first = feed.entries.length === 0 && feed.loading;

  // Picking this card unmounts it, and it is the element holding focus. Nothing
  // else on the page removes itself on activation, so nothing else needs this.
  const showAllTvdb = useCallback(() => {
    setSource("tvdb");
    requestAnimationFrame(() => {
      setBpFocus(
        document.querySelector<HTMLElement>('[data-bp-restore-key="collection-source:tvdb"]'),
        { silent: true },
      );
    });
  }, [setSource]);

  // Collections is TMDB's surface, so with no key there is nothing to show and
  // the tab used to be hidden outright. Hiding it left a TV-only viewer with no
  // route to the key at all, so the tab stays and explains itself instead.
  if (!settings.tmdbKey.trim()) {
    return (
      <div
        data-bp-scroll-y
        className="flex h-full flex-col overflow-y-auto bg-[var(--bp-void)] px-[var(--bp-gutter)] pb-[var(--bp-hint-h)] pt-[var(--bp-page-top)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <BpConnect />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-[clamp(11px,1.4vh,22px)] bg-[var(--bp-void)] px-[var(--bp-gutter)] pb-[var(--bp-hint-h)] pt-[var(--bp-page-top)]">
      <BpSourceRow
        options={BP_COLLECTION_SOURCES}
        active={source}
        label={(value) => t(SOURCE_LABELS[value as BpCollectionSource])}
        onPick={(value) => setSource(value as BpCollectionSource)}
        keyPrefix="collection-source"
        // While the feed loads there are only skeletons, which are not
        // focusable, so the page named no arrival target at all and the ring
        // landed on whatever bpFocusables(scope)[0] happened to be. The active
        // source chip holds it until the first card exists, and the two swap in
        // the same render so the page never carries two markers or none.
        autofocus={feed.entries.length === 0}
        trailing={
          <span className="ms-auto shrink-0 text-[clamp(11px,1.5vh,17px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {t("{count} collections", { count: feed.entries.length })}
          </span>
        }
      />

      {source === "tmdb" && (
        <BpSourceRow
          options={BP_COLLECTION_CATEGORIES}
          active={category}
          label={(value) => t(value)}
          onPick={setCategory}
          keyPrefix="collection-category"
        />
      )}

      <BpGridScroller>
        {first ? (
          <div aria-hidden>
            <BpGrid columns={GRID_COLUMNS} gap={GRID_GAP}>
              {Array.from({ length: PLACEHOLDERS }).map((_, i) => (
                <BpCollectionCardSkeleton key={i} />
              ))}
            </BpGrid>
          </div>
        ) : (
          <BpGrid columns={GRID_COLUMNS} gap={GRID_GAP}>
            {feed.entries.map((entry, i) => (
              <Fragment key={entry.key}>
                <BpCollectionCard entry={entry} onOpen={open} autofocus={i === 0} />
                {i === lastTvdb && (
                  <BpCollectionMoreCard label={t("See every TVDB list")} onOpen={showAllTvdb} />
                )}
              </Fragment>
            ))}
            {feed.loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <BpCollectionCardSkeleton key={`load-${i}`} />
              ))}
          </BpGrid>
        )}
        {feed.sentinels.map((ref, i) => (
          <div key={i} ref={ref} className="h-px w-full" />
        ))}
        {feed.loading && !first && (
          <p className="flex items-center justify-center gap-2 pb-8 text-[clamp(12px,1.65vh,19px)] font-semibold text-ink-subtle">
            <Loader2 size={17} strokeWidth={2.4} className="animate-spin motion-reduce:animate-none" />
            {t("Loading more collections...")}
          </p>
        )}
        {feed.done && (
          <p className="flex items-center justify-center pb-8 text-[clamp(12px,1.65vh,19px)] font-medium text-ink-subtle">
            {endMessage(t, source, empty, feed)}
          </p>
        )}
      </BpGridScroller>

      {items && (
        <BpCollectionItems
          open={items.open}
          restoreKey={items.key}
          onClose={() => setItems(null)}
        />
      )}
    </div>
  );
}
