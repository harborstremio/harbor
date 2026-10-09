import { useEffect, useRef, useState } from "react";
import type { AwardSourceId } from "@/lib/anime-awards";
import type { Meta } from "@/lib/cinemeta";
import type { AwardType } from "@/lib/providers/wikidata";
import { useSettings } from "@/lib/settings";
import { BpAnimeAward } from "./bp-anime-awards";
import { BpAward } from "./bp-award";
import { BpAwardsBand } from "./bp-award-tiles";
import { pushBpBack } from "./bp-back";
import { BpCollectionsBand } from "./bp-collections-band";
import { BpDiscoverWash } from "./bp-discover-wash";
import { BpGenreGrid } from "./bp-genre-grid";
import { useBpGenreGrid } from "./use-bp-genre-grid";
import { BpGenresBand } from "./bp-genre-tiles";
import { useBpT } from "./bp-i18n";
import { BpPeopleBand } from "./bp-people-band";
import { BpRail, type BpRailEntry } from "./bp-rail";
import { BpRow } from "./bp-row";
import { BpQueue } from "./queue/bp-queue";
import { BpQueueBand } from "./queue/bp-queue-band";
import { useBpRail } from "./use-bp-rail";
import { bpRailSignature, useBpLayoutReflow } from "./use-bp-row-layout";
import {
  bpFocusables,
  currentBpFocus,
  markBpInteracted,
  setBpFocus,
} from "./use-bp-focus";
import {
  BP_GENRES,
  useBpAwardsOverview,
  useBpDiscoverRails,
  useBpTopPeople,
} from "./use-bp-discover";

// Long enough for a cold TMDB page on a stick, short enough that a genuinely
// empty overlay stops observing rather than watching an idle subtree forever.
const OVERLAY_SEED_MS = 8000;

type BpDiscoverOverlay =
  | { kind: "queue" }
  | { kind: "award"; awardType: AwardType }
  | { kind: "anime-award"; source: AwardSourceId }
  | { kind: "genre"; genre: string };

const RAIL_COUNT = 8;
const PEOPLE_COUNT = 24;

// The band's copy travels WITH its row, in one array, and the rail index is that
// entry's position in it. This replaced two separate expressions of the same
// order, a run of ROW_* constants plus arithmetic over the conditional bands,
// and a parallel `bands` array the page hero read by index to title itself.
// Either could drift off the other by hand: a duplicated index makes a row
// unreachable, a gap dead-ends vertical navigation outright, and a desynced
// title made the headline name a band that was not on screen.
type BpDiscoverEntry = BpRailEntry & { eyebrow: string; title: string; blurb: string };

export function BpDiscover({ onSelect }: { onSelect: (m: Meta) => void }) {
  const t = useBpT();
  const { settings } = useSettings();
  const [overlay, setOverlay] = useState<BpDiscoverOverlay | null>(null);
  // Keyed by the band that supplied it: a colour picked up in Genres must not
  // follow the ring down into Collections, where nothing can ever replace it.
  const [tint, setTint] = useState<{ band: string; colour: string } | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<string | null>(null);

  const people = useBpTopPeople(PEOPLE_COUNT);
  const rails = useBpDiscoverRails(RAIL_COUNT);
  const awards = useBpAwardsOverview();
  const showCollections = Boolean(settings.tmdbKey);
  const showPeople = people.length > 0;

  // Not a second expression of the order: an identity for "the rail changed",
  // which is what the warmer and the reflow rebind on.
  const signature = bpRailSignature([
    overlay ? "overlay" : "",
    showCollections ? "collections" : "",
    showPeople ? "people" : "",
    ...rails.map((r) => r.key),
  ]);
  const { railRef, activeRow, railShift } = useBpRail(signature);
  // useBpDiscoverRails refreshes on its own, and a refresh can destroy the cell
  // holding the ring. Without this nothing carries data-bp-focus afterwards and
  // the next press teleports to the autofocus seed at row zero.
  useBpLayoutReflow({ railRef, signature, routeKey: "discover" });

  useEffect(() => {
    if (!overlay) return;
    return pushBpBack(() => {
      setOverlay(null);
      return true;
    });
  }, [overlay]);

  // The overlay replaces the rail, so nothing carries focus into it and the tile
  // that opened it is gone by the time it closes.
  //
  // The seed cannot be a single frame. A genre grid fills from TMDB, so the
  // overlay mounts holding a skeleton with nothing focusable in it, that one
  // frame found an empty pool, and the page sat with no ring at all until
  // recoverBpFocus spent the viewer's first press putting one on tile zero.
  // Measured on the Action genre: 20 tiles, 0 rings, one ArrowRight landing on
  // index 0 rather than moving. This retries while the overlay settles and
  // stops on the first ring it lands.
  useEffect(() => {
    if (overlay) {
      markBpInteracted();
      let raf = 0;
      let observer: MutationObserver | null = null;
      const stop = () => {
        observer?.disconnect();
        observer = null;
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
      };
      const attempt = () => {
        raf = 0;
        const scope = overlayRef.current;
        if (!scope) return;
        if (currentBpFocus(scope)) {
          stop();
          return;
        }
        // The mark before the pool: bp-genre-grid stamps tile zero on purpose,
        // and a header chip added later would otherwise win by document order.
        const seed =
          scope.querySelector<HTMLElement>("[data-bp-autofocus='true']") ?? bpFocusables(scope)[0];
        if (seed && setBpFocus(seed, { silent: true })) stop();
      };
      const schedule = () => {
        if (!raf) raf = window.requestAnimationFrame(attempt);
      };
      schedule();
      if (overlayRef.current) {
        observer = new MutationObserver(schedule);
        observer.observe(overlayRef.current, { childList: true, subtree: true });
      }
      const give = window.setTimeout(stop, OVERLAY_SEED_MS);
      return () => {
        window.clearTimeout(give);
        stop();
      };
    }
    const key = openerRef.current;
    openerRef.current = null;
    if (!key) return;
    const frame = window.requestAnimationFrame(() => {
      const back = document.querySelector<HTMLElement>(`[data-bp-restore-key="${CSS.escape(key)}"]`);
      if (back) setBpFocus(back, { silent: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [overlay]);

  const open = (next: BpDiscoverOverlay, restoreKey: string) => {
    openerRef.current = restoreKey;
    setOverlay(next);
  };

  if (overlay) {
    return (
      <div ref={overlayRef} data-bp-dialog className="absolute inset-0 bg-[var(--bp-void)]">
        {overlay.kind === "queue" && <BpQueue onSelect={onSelect} />}
        {overlay.kind === "award" && (
          <BpAward awardType={overlay.awardType} onSelect={onSelect} />
        )}
        {overlay.kind === "anime-award" && (
          <BpAnimeAward sourceId={overlay.source} onSelect={onSelect} />
        )}
        {overlay.kind === "genre" && <BpGenreOverlay genre={overlay.genre} onSelect={onSelect} />}
      </div>
    );
  }

  // Indices come from position in this list, never from arithmetic, and every
  // band's headline copy sits beside the node it describes.
  const entries: BpDiscoverEntry[] = [];

  entries.push({
    key: "queue",
    eyebrow: t("Discover"),
    title: t("Discovery Queue"),
    blurb: t("One pick at a time, full screen, until something lands."),
    node: (
      <BpQueueBand
        onOpen={() => open({ kind: "queue" }, "bp-lead:queue")}
        onTint={(colour) => setTint({ band: "queue", colour })}
      />
    ),
  });

  // Pushed unconditionally: BpAwardsBand renders nothing until its summaries
  // resolve, and BpRailRow's empty:hidden collapses the wrapper so the rail
  // shows no hole and the indices below keep their numbers.
  entries.push({
    key: "awards",
    eyebrow: t("Discover"),
    title: t("Awards"),
    blurb:
      awards.wins > 0 && awards.span
        ? t("{bodies} awards, {wins} winners, {span}, all offline", {
            bodies: awards.bodies,
            wins: awards.wins.toLocaleString(),
            span: awards.span,
          })
        : t("Every winner Harbor ships, browsable offline by year and category."),
    node: (
      <BpAwardsBand
        onTint={(colour) => setTint({ band: "awards", colour })}
        onOpenAward={(type) => open({ kind: "award", awardType: type }, `bp-award:${type}`)}
        onOpenAnime={(source) => open({ kind: "anime-award", source }, `bp-anime-award:${source}`)}
        onOpenAll={() => open({ kind: "award", awardType: "oscar" }, "bp-lead:awards")}
      />
    ),
  });

  {
    // entries.length IS this entry's index, read before the push. Anything else
    // is the arithmetic this array exists to delete.
    const at = entries.length;
    entries.push({
      key: "genres",
      eyebrow: t("Discover"),
      title: t("Genres"),
      blurb: t("{n} shelves, one press into any of them", { n: BP_GENRES.length }),
      node: (
        <BpGenresBand
          active={activeRow === at}
          onTint={(colour) => setTint({ band: "genres", colour })}
          onOpen={(genre) => open({ kind: "genre", genre }, `bp-genre:${genre}`)}
          onSurprise={() => {
            const pick = BP_GENRES[Math.floor(Math.random() * BP_GENRES.length)];
            open({ kind: "genre", genre: pick }, "bp-lead:genres");
          }}
        />
      ),
    });
  }

  entries.push({
    key: "collections",
    eyebrow: t("Discover"),
    title: t("Collections"),
    blurb: t("Sagas and series, gathered in the order they were meant to be watched."),
    node: showCollections ? <BpCollectionsBand /> : null,
  });

  entries.push({
    key: "people",
    eyebrow: t("Discover"),
    title: t("Top People"),
    blurb: t("Top {n}, ranked by the work they left behind", { n: people.length }),
    node: showPeople ? <BpPeopleBand people={people} /> : null,
  });

  for (const rail of rails) {
    const series = rail.metas[0]?.type === "series";
    const shelf = rail.kicker ? t(rail.kicker) : t(rail.name);
    entries.push({
      key: rail.key,
      eyebrow: t("Picked for you"),
      title: t(rail.name),
      blurb: t("{n} picks, refreshed daily", { n: rail.metas.length }),
      node: (
        <BpRow
          title={shelf}
          metas={rail.metas}
          onSelect={onSelect}
          lead={{
            rowKey: rail.key,
            title: shelf,
            action: series ? t("All shows") : t("All movies"),
            tab: series ? "shows" : "movies",
          }}
        />
      ),
    });
  }

  const band = entries[Math.min(activeRow, entries.length - 1)] ?? entries[0];

  return (
    <div className="relative flex h-full flex-col">
      <BpDiscoverWash
        tint={tint && tint.band === band?.key ? tint.colour : null}
        bandId={band?.key ?? "awards"}
      />
      <div className="relative z-20 shrink-0 px-[var(--bp-gutter)] pb-[clamp(10px,1.6vh,24px)] pt-[var(--bp-page-top)]">
        <div
          key={band?.key}
          className="flex flex-col gap-[clamp(3px,0.5vh,8px)] [animation:bp-rise_var(--bp-dur)_var(--bp-ease)_backwards] motion-reduce:[animation:none]"
        >
          <span className="text-[clamp(9.5px,1.25vh,14px)] font-bold uppercase tracking-[0.2em] text-ink-subtle">
            {band?.eyebrow ?? t("Discover")}
          </span>
          <h1 className="font-display text-[clamp(24px,4.2vh,58px)] font-semibold leading-[1.03] tracking-[-0.02em] text-ink">
            {band?.title}
          </h1>
          <p className="line-clamp-2 max-w-[min(52vw,860px)] text-[clamp(12.5px,1.75vh,21px)] text-ink-muted">
            {band?.blurb}
          </p>
        </div>
      </div>
      <BpRail railRef={railRef} entries={entries} activeRow={activeRow} railShift={railShift} />
    </div>
  );
}

function BpGenreOverlay({ genre, onSelect }: { genre: string; onSelect: (m: Meta) => void }) {
  const feed = useBpGenreGrid(genre);
  return (
    <BpGenreGrid
      genre={genre}
      metas={feed.metas}
      status={feed.status}
      onMore={feed.more}
      onRetry={feed.retry}
      onSelect={onSelect}
    />
  );
}
