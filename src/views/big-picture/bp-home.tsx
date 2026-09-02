import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { HomeRow } from "@/views/home/home-types";
import { pushBigPicture } from "@/lib/big-picture";
import { isAndroidTv } from "@/lib/platform";
import { useSettings, type StreamingService } from "@/lib/settings";
import { useMobileCw, useMobileCwReady } from "@/views/mobile/mobile-cw-row";
import { BpPageSkeleton } from "./bp-page-skeleton";
import { BpSpotlight } from "./bp-spotlight";
import { useBpHeroCycle } from "./use-bp-hero-cycle";
import { BpCwRow, cwMeta } from "./bp-cw-row";
import { seedBpMeta, unpinBpMeta } from "./bp-focus-meta";
import { BpRail, type BpRailEntry } from "./bp-rail";
import { useBpPagePhase } from "./bp-catalog-page";
import { useBpRail } from "./use-bp-rail";
import { BpRow, bpRowShape, useBpNumerals } from "./bp-row";
import { BpBandIdentity } from "./bp-section";
import { BpCollectionsRow } from "./bp-collections-row";
import { BpLiveRow } from "./bp-live-row";
import { BpServiceRow } from "./bp-service-row";
import { BpAddonRow } from "./addons/bp-addon-row";
import { useBpCatalog } from "./use-bp-catalog";
import {
  bpHomeSignature,
  bpRailSignature,
  useBpLayoutReflow,
  useBpPinnedRows,
} from "./use-bp-row-layout";
import { useBpT } from "./bp-i18n";
import { forgetBpPosition, forgetBpRowPosition } from "./bp-restore";
import type { BpRowLead } from "./bp-row-header";
import { BAND_SETTLE_MS, publishBpBand, useBpBandState } from "./use-bp-sections";

const VISIBLE_ROWS = 60;
const SERVICES_SLOT = 2;

export function BpHome({ onSelect }: { onSelect: (m: Meta) => void }) {
  const { rows, loading, failed } = useBpCatalog();
  const cwAll = useMobileCw(16);
  const cwReady = useMobileCwReady();
  const { cwHidden, collectionsHidden } = useBpPinnedRows();
  const cw = cwReady && !cwHidden ? cwAll : [];
  const t = useBpT();
  const { settings } = useSettings();
  const numerals = useBpNumerals();
  const { band, art: bandArt } = useBpBandState(BAND_SETTLE_MS);
  const [identityUp, setIdentityUp] = useState(false);

  const services = useMemo(
    () =>
      settings.tmdbKey
        ? (Object.keys(settings.streaming) as StreamingService[]).filter((s) => settings.streaming[s])
        : [],
    [settings.tmdbKey, settings.streaming],
  );
  const showServices = services.length > 0;
  const showCollections = Boolean(settings.tmdbKey) && !collectionsHidden;
  const cwShown = !cwHidden && (!cwReady || cw.length > 0);
  const signature = bpHomeSignature(cwShown, showServices, showCollections, rows);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const phase = useBpPagePhase(pageRef);
  const { railRef, activeRow, railShift } = useBpRail(
    bpRailSignature([signature, String(cw.length)]),
  );
  useBpLayoutReflow({ railRef, signature, routeKey: "home" });
  const head = rows.slice(0, SERVICES_SLOT);
  const tail = rows.slice(SERVICES_SLOT, VISIBLE_ROWS);

  const seedItem = cw[0];
  const seedMeta = rows[0]?.metas[0];
  const seed = useMemo(() => (seedItem ? cwMeta(seedItem) : seedMeta), [seedItem, seedMeta]);

  const heroPool = useMemo(() => (rows[0]?.metas ?? []).slice(0, 8), [rows]);
  useBpHeroCycle(heroPool, heroPool.length > 1 && !isAndroidTv());

  // Continue watching and the catalogs resolve at different moments. Emitting a
  // seed before both have settled hands data-bp-autofocus from one row to
  // another mid-flight, and the settle pass then drags the ring across with it.
  // Live only ever holds the seed provisionally: BpLiveRow renders nothing
  // without playlists, so latching it would leave the view with no autofocus at
  // all and park the ring in the top bar.
  const seedRowRef = useRef<"cw" | "catalog" | null>(null);
  if (seedRowRef.current === null && cwReady && !loading) {
    if (cw.length > 0) seedRowRef.current = "cw";
    else if (rows.length > 0) seedRowRef.current = "catalog";
  }
  const seedRow: "cw" | "catalog" | "live" = seedRowRef.current ?? "live";

  // Continue watching reorders by recency, so a remembered card points at a
  // different title on the way back. Home always opens on the first one, and
  // only that row forgets: every other row keeps its per-row memory.
  useEffect(() => {
    forgetBpPosition("home");
    forgetBpRowPosition("home", "cw");
    unpinBpMeta();
  }, []);

  useEffect(() => {
    unpinBpMeta();
    seedBpMeta(seed ?? null);
  }, [seed?.id]);

  useEffect(() => () => publishBpBand(null), []);

  // Only a band that owns its own backdrop has nothing better to put in the
  // hero. A card-owning band already has the focused title, so flashing its
  // label first just delays the hero and reads as the page loading twice.
  useEffect(() => {
    setIdentityUp(band?.owns === "band");
  }, [band]);

  // Every row declares the tab it belongs to, and that is the whole link-out
  // now: Left at the start of the row lands the ring on that tab rather than on
  // whichever tab is active, so a movies row reaches Movies in two presses where
  // the lead tile took three. The header prints the destination while the row
  // holds the ring, so the binding is taught rather than hidden.
  const catalogLead = (row: HomeRow): BpRowLead => ({
    rowKey: row.key,
    title: row.name,
    action: row.type === "series" ? t("All shows") : t("All movies"),
    tab: row.type === "series" ? "shows" : "movies",
  });

  if (loading && rows.length === 0 && cw.length === 0)
    return <BpPageSkeleton topClass="pt-[var(--bp-page-top)]" />;

  if (failed && rows.length === 0 && cw.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <h2 className="font-display text-[clamp(20px,3vh,38px)] font-semibold text-ink">
          {t("Couldn't load your catalogs")}
        </h2>
        <p className="max-w-md text-[clamp(13px,1.85vh,21px)] text-ink-muted">
          {t("Harbor couldn't reach the catalog servers. Check the connection and reopen Big Picture.")}
        </p>
      </div>
    );
  }

  // Indices come from position in this list, never from arithmetic: a gap in
  // data-bp-rail-row is what breaks vertical navigation outright.
  const entries: BpRailEntry[] = [];

  // Pushed UNCONDITIONALLY, so a hidden row keeps its index (BpCwRow returns null and
  // empty:hidden collapses the wrapper) instead of renumbering every row below it.
  // settings.update is a live context: a synced layout hiding "cw" arrives mid-session,
  // which is exactly the renumber under a live ring that useBpLayoutReflow must survive.
  {
    entries.push({
      key: "cw",
      band: "resume",
      node: (
        <BpCwRow
          items={cw}
          loading={!cwReady && !cwHidden}
          onSelect={onSelect}
          autofocusFirst={seedRow === "cw"}
          lead={{
            rowKey: "cw",
            title: t("Jump back in"),
            action: t("Your library"),
            tab: "library",
          }}
        />
      ),
    });
  }

  entries.push({
    key: "services",
    band: "services",
    node: showServices ? (
      <BpServiceRow
        services={services}
        onOpen={(s) => pushBigPicture({ kind: "service", service: s })}
        lead={{
          rowKey: "services",
          title: t("Your streaming"),
          action: t("Manage"),
          tab: "settings",
        }}
      />
    ) : null,
  });

  entries.push({ key: "addons", band: "addons", node: <BpAddonRow /> });

  // Pushed unconditionally: BpLiveRow renders nothing without playlists, and the
  // empty wrapper collapses via empty:hidden, so rail indices stay contiguous
  // without bp-home having to duplicate the playlist fetch to predict it.
  entries.push({
    key: "live",
    band: "live",
    node: (
      <BpLiveRow
        autofocusFirst={seedRow === "live"}
        lead={{
          rowKey: "live",
          title: t("Guide"),
          action: t("Live TV"),
          tab: "live",
        }}
      />
    ),
  });

  head.forEach((row, i) => {
    entries.push({
      key: row.key,
      band: "catalog",
      node: (
        <BpRow
          title={row.name}
          metas={row.metas}
          row={row}
          shape={bpRowShape(row, numerals)}
          onSelect={onSelect}
          autofocusFirst={seedRow === "catalog" && i === 0}
          lead={catalogLead(row)}
        />
      ),
    });
  });

  entries.push({
    key: "collections",
    band: "collections",
    node: showCollections ? (
      <BpCollectionsRow
        onOpen={(c) =>
          pushBigPicture({
            kind: "tmdb-collection",
            collectionId: c.collectionId,
            name: c.name,
            image: c.image,
          })
        }
        lead={{
          rowKey: "collections",
          title: t("Collections"),
          action: t("View all"),
          tab: "collections",
        }}
      />
    ) : null,
  });

  for (const row of tail) {
    entries.push({
      key: row.key,
      band: "more",
      node: (
        <BpRow
          title={row.name}
          metas={row.metas}
          row={row}
          shape={bpRowShape(row, numerals)}
          onSelect={onSelect}
          lead={catalogLead(row)}
        />
      ),
    });
  }

  return (
    <div ref={pageRef} className="relative flex h-full flex-col">
      {/* data-bp-home-hero is the anchor for --bp-hero-give in bp-tokens, which
          is television only. Home is the one surface that keeps expanded={true}
          forever instead of collapsing the hero off row 0, so it is the one
          surface whose row band does not fit above --bp-hint-h at 641px. The
          attribute stays on this wrapper rather than on the spotlight so the
          give is inherited rather than restated, and nothing here is inside the
          rail, so no rail-row parent chain is touched. */}
      <div data-bp-home-hero className="relative z-20 shrink-0 pt-[var(--bp-page-top)]">
        <div className="relative">
          <div
            className={`motion-reduce:transition-none ${
              identityUp
                ? "opacity-0 transition-opacity duration-[180ms] ease-[var(--bp-ease-in)]"
                : "opacity-100 transition-opacity duration-[300ms] delay-[140ms] ease-[var(--bp-ease)]"
            }`}
          >
            <BpSpotlight phase={phase} />
          </div>
          <BpBandIdentity band={band} art={bandArt} up={identityUp} />
        </div>
      </div>
      <BpRail railRef={railRef} entries={entries} activeRow={activeRow} railShift={railShift} />
    </div>
  );
}
