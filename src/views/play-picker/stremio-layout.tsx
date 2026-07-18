import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { addonLogoSrc, resolveAddonLogo } from "@/components/addon-logo";
import type { Addon } from "@/lib/addons";
import type { ScoredStream } from "@/lib/streams/types";
import { StremioRow } from "./stremio-row";
import { FACET_DIMS, facetOptions, matchesFacets, type FacetState } from "./stream-facets";
import { addonInstanceKey, buildAddonOptions } from "./picker-utils";
import { useSettings } from "@/lib/settings";
import { matchesCustomFilter, type CustomStreamFilter } from "@/lib/streams/custom-filters";
import { FacetMenuRow } from "./facet-menu-row";
import { FilterBuilder } from "./filter-builder";

export function StremioLayout({
  streams,
  addons,
  pipelineDone,
  loadingAddonCount,
  failedStreams,
  preserveOrder,
  matchFor,
  onPlay,
  download = false,
  isAnime = false,
}: {
  streams: ScoredStream[];
  addons: Addon[] | null;
  pipelineDone: boolean;
  loadingAddonCount: number;
  failedStreams: Set<ScoredStream>;
  preserveOrder?: boolean;
  matchFor?: (s: ScoredStream) => "same" | "close" | null;
  onPlay: (stream: ScoredStream) => void;
  download?: boolean;
  isAnime?: boolean;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [facet, setFacet] = useState<FacetState>({});
  const { settings, update } = useSettings();
  const customFilters = settings.customStreamFilters;
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<CustomStreamFilter | null>(null);
  const activeFilter = customFilters.find((f) => f.id === activeFilterId) ?? null;
  const addonLogoMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const a of addons ?? []) {
      const logo = resolveAddonLogo(a.manifest.logo, a.transportUrl);
      if (a.transportUrl) m.set(a.transportUrl, logo);
      if (!m.has(a.manifest.id)) m.set(a.manifest.id, logo);
    }
    return m;
  }, [addons]);
  const addonRank = useMemo(() => {
    const m = new Map<string, number>();
    (addons ?? []).forEach((a, i) => {
      if (a.transportUrl) m.set(a.transportUrl, i);
    });
    return m;
  }, [addons]);
  const addonOptions = useMemo(() => buildAddonOptions(streams, addonRank), [streams, addonRank]);
  const addonFiltered = useMemo(
    () => (filter === "all" ? streams : streams.filter((s) => addonInstanceKey(s) === filter)),
    [streams, filter],
  );
  const customFiltered = useMemo(
    () =>
      activeFilter
        ? addonFiltered.filter((s) => matchesCustomFilter(s, activeFilter))
        : addonFiltered,
    [addonFiltered, activeFilter],
  );
  const facetData = useMemo(
    () =>
      FACET_DIMS.map((dim) => {
        const base = customFiltered.filter((s) => matchesFacets(s, facet, dim.key));
        return {
          dim,
          options: facetOptions(base, dim),
          total: base.length,
          value: facet[dim.key] ?? "all",
        };
      }),
    [customFiltered, facet],
  );
  useEffect(() => {
    for (const f of facetData) {
      if (f.value !== "all" && !f.options.some((o) => o.key === f.value)) {
        setFacet((prev) => ({ ...prev, [f.dim.key]: "all" }));
      }
    }
  }, [facetData]);
  useEffect(() => {
    if (activeFilterId && !customFilters.some((f) => f.id === activeFilterId))
      setActiveFilterId(null);
  }, [customFilters, activeFilterId]);
  const visibleStreams = useMemo(() => {
    const filtered = customFiltered.filter((s) => matchesFacets(s, facet));
    if (filter !== "all") return filtered;
    if (preserveOrder) return filtered;
    const downloadRx = /[⏳⌛⬇⏬🔽📥]|\bdownload(ing)?\b|\bqueued?\b|\bnot[\s_-]?cached\b/iu;
    const isDownload = (s: ScoredStream) => {
      const haystack = `${s.name ?? ""} ${s.title ?? ""} ${s.description ?? ""}`;
      return downloadRx.test(haystack);
    };
    return filtered.slice().sort((a, b) => {
      const aw = /watchhub/i.test(a.addonId) || /watchhub/i.test(a.addonName ?? "") ? 1 : 0;
      const bw = /watchhub/i.test(b.addonId) || /watchhub/i.test(b.addonName ?? "") ? 1 : 0;
      if (aw !== bw) return aw - bw;
      const ad = isDownload(a) ? 1 : 0;
      const bd = isDownload(b) ? 1 : 0;
      if (ad !== bd) return ad - bd;
      const ar = addonRank.get(a.addonUrl ?? "") ?? 9999;
      const br = addonRank.get(b.addonUrl ?? "") ?? 9999;
      if (ar !== br) return ar - br;
      const ai = isInstantText(a) ? 1 : 0;
      const bi = isInstantText(b) ? 1 : 0;
      if (ai !== bi) return bi - ai;
      return 0;
    });
  }, [customFiltered, facet, filter, addonRank, preserveOrder]);
  const filterLabel =
    filter === "all" ? "All" : (addonOptions.find((o) => o.id === filter)?.name ?? "All");
  const filterLogo = filter === "all" ? null : (addonLogoMap.get(filter) ?? null);
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <button
          onClick={() => setFilterOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl bg-elevated/60 px-4 py-3 text-start text-[15px] font-medium text-ink ring-1 ring-edge-soft transition-colors hover:bg-elevated"
        >
          <div className="flex min-w-0 items-center gap-3">
            <CircleLogo
              addonId={filter === "all" ? null : filter}
              addonName={filterLabel}
              logo={filterLogo}
            />
            <span className="truncate">{filterLabel}</span>
          </div>
          <ChevronDown
            size={18}
            strokeWidth={2.2}
            className={`shrink-0 text-ink-muted transition-transform duration-200 ${
              filterOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {filterOpen && (
          <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-80 overflow-y-auto rounded-2xl bg-elevated p-1.5 ring-1 ring-edge shadow-[0_18px_44px_-14px_rgba(0,0,0,0.7)]">
            <button
              onClick={() => {
                setFilter("all");
                setFilterOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[14px] transition-colors hover:bg-raised ${
                filter === "all" ? "text-ink font-semibold" : "text-ink-muted"
              }`}
            >
              <CircleLogo addonId={null} addonName="All" logo={null} />
              <span className="flex-1 truncate">All sources</span>
              <span className="text-[12px] text-ink-subtle">{streams.length}</span>
            </button>
            {addonOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setFilter(opt.id);
                  setFilterOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[14px] transition-colors hover:bg-raised ${
                  filter === opt.id ? "text-ink font-semibold" : "text-ink-muted"
                }`}
              >
                <CircleLogo
                  addonId={opt.id}
                  addonName={opt.name}
                  logo={addonLogoMap.get(opt.id) ?? null}
                />
                <span className="flex-1 truncate">{opt.name}</span>
                <span className="text-[12px] text-ink-subtle">{opt.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <FacetMenuRow
        facets={facetData}
        onFacet={(key, v) => setFacet((prev) => ({ ...prev, [key]: v }))}
        filters={customFilters}
        activeFilterId={activeFilterId}
        onSelectFilter={setActiveFilterId}
        onNewFilter={() => {
          setEditingFilter(null);
          setBuilderOpen(true);
        }}
        onEditFilter={(f) => {
          setEditingFilter(f);
          setBuilderOpen(true);
        }}
      />
      <div className="flex flex-col gap-2">
        {visibleStreams.map((s, i) => (
          <StremioRow
            key={`${s.url ?? s.infoHash ?? s.title}-${i}`}
            stream={s}
            failed={failedStreams.has(s)}
            addonLogo={addonLogoMap.get(s.addonUrl ?? "") ?? addonLogoMap.get(s.addonId) ?? null}
            match={matchFor ? matchFor(s) : null}
            onPlay={() => onPlay(s)}
            download={download}
            isAnime={isAnime}
          />
        ))}
      </div>
      {!pipelineDone && (
        <PendingAddonsPill addons={addons} streams={streams} fallbackCount={loadingAddonCount} />
      )}
      <FilterBuilder
        open={builderOpen}
        initial={editingFilter}
        onClose={() => setBuilderOpen(false)}
        onSave={(f) => {
          const exists = customFilters.some((x) => x.id === f.id);
          update({
            customStreamFilters: exists
              ? customFilters.map((x) => (x.id === f.id ? f : x))
              : [...customFilters, f],
          });
          setActiveFilterId(f.id);
          setBuilderOpen(false);
        }}
        onDelete={(id) => {
          update({ customStreamFilters: customFilters.filter((x) => x.id !== id) });
          if (activeFilterId === id) setActiveFilterId(null);
          setBuilderOpen(false);
        }}
      />
    </div>
  );
}

function PendingAddonsPill({
  addons,
  streams,
  fallbackCount,
}: {
  addons: Addon[] | null;
  streams: ScoredStream[];
  fallbackCount: number;
}) {
  const pending = useMemo(() => {
    if (!addons || addons.length === 0) return [] as Addon[];
    const returned = new Set(streams.map((s) => s.addonId));
    return addons.filter((a) => {
      const id = a.manifest?.id;
      if (!id) return false;
      const hasStream = (a.manifest?.resources ?? []).some((r) =>
        typeof r === "string" ? r === "stream" : r.name === "stream",
      );
      if (!hasStream) return false;
      return !returned.has(id);
    });
  }, [addons, streams]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (pending.length <= 1) return;
    const t = window.setInterval(() => setTick((v) => v + 1), 1800);
    return () => window.clearInterval(t);
  }, [pending.length]);
  if (pending.length === 0 && fallbackCount === 0) return null;
  const current = pending.length > 0 ? pending[tick % pending.length] : null;
  return (
    <div className="pointer-events-none sticky bottom-3 z-10 mt-3 flex justify-center">
      <div
        key={current?.manifest?.id ?? "fallback"}
        className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-edge-soft bg-elevated/95 px-3 py-1.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-200"
      >
        <Spinner />
        {current ? (
          <PendingChip addon={current} />
        ) : (
          <span className="text-[12px] text-ink-muted">
            {fallbackCount > 0
              ? `${fallbackCount} ${fallbackCount === 1 ? "addon" : "addons"} loading`
              : "Loading more sources"}
          </span>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="relative inline-block h-3 w-3">
      <span className="absolute inset-0 rounded-full border-[1.5px] border-edge" />
      <span className="absolute inset-0 animate-spin rounded-full border-[1.5px] border-transparent border-t-ink" />
    </span>
  );
}

function PendingChip({ addon }: { addon: Addon }) {
  const id = addon.manifest?.id ?? "";
  const name = addon.manifest?.name ?? id ?? "addon";
  const remoteLogo = resolveAddonLogo(addon.manifest?.logo, addon.transportUrl);
  const bundled = addonLogoSrc(id, name);
  const src = remoteLogo ?? bundled ?? null;
  return (
    <span className="flex items-center gap-2 text-[12px] text-ink">
      <span className="text-ink-subtle">Waiting for</span>
      <span className="flex items-center gap-1.5">
        {src ? (
          <img src={src} alt="" className="h-4 w-4 rounded-sm object-contain" />
        ) : (
          <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-raised text-[8.5px] font-semibold text-ink-muted">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="font-medium text-ink">{name}</span>
      </span>
    </span>
  );
}

function isInstantText(s: ScoredStream): boolean {
  const haystack = `${s.name ?? ""} ${s.title ?? ""} ${s.description ?? ""}`.toLowerCase();
  return /\binstant\b/.test(haystack) || haystack.includes("⚡");
}

function CircleLogo({
  addonId,
  addonName,
  logo,
}: {
  addonId: string | null;
  addonName: string;
  logo: string | null;
}) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  if (addonId === null) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elevated ring-1 ring-edge-soft">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="3"
            y="3"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink-muted"
          />
          <rect
            x="14"
            y="3"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink-muted"
          />
          <rect
            x="3"
            y="14"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink-muted"
          />
          <rect
            x="14"
            y="14"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink-muted"
          />
        </svg>
      </div>
    );
  }
  const bundled = addonLogoSrc(addonId, addonName);
  const src = !remoteFailed && logo ? logo : bundled;
  if (!src) {
    const initial = (addonName || "?").trim().charAt(0).toUpperCase();
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elevated text-[13px] font-bold text-ink-muted ring-1 ring-edge-soft">
        {initial}
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-canvas ring-1 ring-edge-soft">
      <img
        src={src}
        alt={addonName}
        title={addonName}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
        onError={() => {
          if (!remoteFailed && bundled) setRemoteFailed(true);
        }}
      />
    </div>
  );
}
