import { useEffect, useMemo, useState } from "react";
import type { Addon } from "@/lib/addons";
import {
  QUALITY_ORDER,
  qualityKey,
  type QualityKey,
} from "@/components/player/stream-switcher/quality";
import type { DebridStore } from "@/lib/debrid/types";
import { useSettings } from "@/lib/settings";
import { isAddonRanked } from "@/lib/streams/addon-detect";
import {
  isFilterEmpty,
  matchesCustomFilter,
  type CustomStreamFilter,
} from "@/lib/streams/custom-filters";
import { filterStreamsByMode } from "@/lib/streams/mode";
import type { PipelineResult } from "@/lib/streams/pipeline";
import type { ScoredStream } from "@/lib/streams/types";
import {
  addonInstanceKey,
  buildAddonOptions,
  isWatchHub,
  hasInstantMarker,
  needsDownload,
  normalizeLangCode,
  orderByAddonNative,
  streamMatchesLangs,
} from "@/views/play-picker/picker-utils";
import {
  FACET_DIMS,
  facetOptions,
  matchesFacets,
  type FacetState,
} from "@/views/play-picker/stream-facets";

// Resolution and availability are already spoken for by the quality chips and by
// the cached / stream-mode chips, so only the remaining desktop dimensions get
// their own control here.
const BP_FACET_DIMS = FACET_DIMS.filter((d) => d.key !== "resolution" && d.key !== "cached");

export type BpQualityChip = { key: QualityKey; count: number };
export type BpFacetOption = { key: string; count: number };
export type BpFacetChip = {
  key: string;
  label: string;
  value: string;
  total: number;
  options: BpFacetOption[];
};
export type BpAddonOption = { id: string; name: string; count: number; logo: string | null };
export type BpStreamMode = "both" | "addons" | "p2p";
export type BpStreamSort = "harbor" | "addon";

export type BpStreamFilters = {
  streams: ScoredStream[];
  total: number;
  quality: QualityKey;
  setQuality: (q: QualityKey) => void;
  qualityChips: BpQualityChip[];
  facets: BpFacetChip[];
  setFacet: (key: string, value: string) => void;
  addonFilter: string;
  setAddonFilter: (id: string) => void;
  addonOptions: BpAddonOption[];
  cachedOnly: boolean;
  setCachedOnly: (v: boolean) => void;
  cachedCount: number;
  uncachedHiddenCount: number;
  langFilter: boolean;
  setLangFilter: (v: boolean) => void;
  langHiddenCount: number;
  preferredLangs: string[];
  streamMode: BpStreamMode;
  setStreamMode: (m: BpStreamMode) => void;
  sort: BpStreamSort;
  setSort: (s: BpStreamSort) => void;
  sortForced: boolean;
  customFilters: CustomStreamFilter[];
  activeFilterId: string | null;
  setActiveFilterId: (id: string | null) => void;
  filterFellBack: boolean;
  filtered: boolean;
  clearFilters: () => void;
};

export function useBpStreamFilters(params: {
  result: PipelineResult | null;
  addons: Addon[] | null;
  debrids: DebridStore[];
  isCached: (s: ScoredStream) => boolean;
  isAnimeRequest: boolean;
  hostMatch: Map<ScoredStream, number> | null;
  pinned: ScoredStream | null;
  addonLogoFor: (key: string) => string | null;
}): BpStreamFilters {
  const { result, addons, debrids, isCached, isAnimeRequest, hostMatch, pinned, addonLogoFor } =
    params;
  const { settings, update } = useSettings();
  const baseLangs = settings.preferredLanguages ?? [];

  const preferredLangs = useMemo(() => {
    const codes = settings.preferredAudioLangs ?? [];
    const animeAdd = isAnimeRequest ? ["Japanese"] : [];
    const all = [...baseLangs, ...codes, ...animeAdd];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const lang of all) {
      const code = normalizeLangCode(lang);
      if (!isAnimeRequest && code === "ja") continue;
      if (seen.has(code)) continue;
      seen.add(code);
      out.push(lang);
    }
    return out;
  }, [baseLangs, settings.preferredAudioLangs, isAnimeRequest]);

  const [quality, setQuality] = useState<QualityKey>("all");
  const [facet, setFacetState] = useState<FacetState>({});
  const [addonFilter, setAddonFilter] = useState("all");
  const [cachedOnly, setCachedOnly] = useState(false);
  const [langFilter, setLangFilter] = useState(
    settings.requirePreferredLanguage === true && baseLangs.length > 0,
  );

  const activeStreamFilter = useMemo(() => {
    const f = settings.customStreamFilters.find((x) => x.id === settings.activeStreamFilterId);
    return f && !isFilterEmpty(f) ? f : null;
  }, [settings.customStreamFilters, settings.activeStreamFilterId]);

  const base = useMemo(() => {
    const candidatePool = result?.picker.all ?? [];
    let all = filterStreamsByMode(candidatePool, settings.streamMode);
    if (langFilter && preferredLangs.length > 0) {
      const langFiltered = all.filter((s) => streamMatchesLangs(s, preferredLangs));
      if (langFiltered.length > 0) all = langFiltered;
    }
    if (cachedOnly && debrids.length > 0) {
      const cached = all.filter(isCached);
      if (cached.length > 0) all = cached;
    }
    let fellBack = false;
    if (activeStreamFilter && !hostMatch) {
      const matched = all.filter((s) => matchesCustomFilter(s, activeStreamFilter));
      if (matched.length > 0) all = matched;
      else fellBack = true;
    }
    if (all.length === 0 && candidatePool.length > 0) {
      all = candidatePool;
      fellBack = true;
    }
    const cachedFirst = all.slice().sort((a, b) => (isCached(b) ? 1 : 0) - (isCached(a) ? 1 : 0));
    return { all: cachedFirst, fellBack };
  }, [
    result,
    settings.streamMode,
    langFilter,
    preferredLangs,
    cachedOnly,
    debrids.length,
    isCached,
    activeStreamFilter,
    hostMatch,
  ]);

  const anyAddonRanked = useMemo(() => (addons ?? []).some((a) => isAddonRanked(a)), [addons]);
  const addonOrderMode = settings.streamSort === "addon" || anyAddonRanked;

  const displayStreams = useMemo(() => {
    const ordered =
      addonOrderMode && result ? orderByAddonNative(base.all, result.raw.addon, addons) : base.all;
    if (hostMatch) {
      return ordered.slice().sort((a, b) => (hostMatch.get(b) ?? 0) - (hostMatch.get(a) ?? 0));
    }
    if (!pinned || !ordered.includes(pinned)) return ordered;
    return [pinned, ...ordered.filter((s) => s !== pinned)];
  }, [base.all, addonOrderMode, result, addons, hostMatch, pinned]);

  const addonRank = useMemo(() => {
    const m = new Map<string, number>();
    (addons ?? []).forEach((a, i) => {
      if (a.transportUrl) m.set(a.transportUrl, i);
    });
    return m;
  }, [addons]);

  const addonOptions = useMemo(
    () =>
      buildAddonOptions(displayStreams, addonRank).map((o) => ({ ...o, logo: addonLogoFor(o.id) })),
    [displayStreams, addonRank, addonLogoFor],
  );

  const addonFiltered = useMemo(
    () =>
      addonFilter === "all"
        ? displayStreams
        : displayStreams.filter((s) => addonInstanceKey(s) === addonFilter),
    [displayStreams, addonFilter],
  );

  const qualityChips = useMemo(() => {
    const pool = addonFiltered.filter((s) => matchesFacets(s, facet));
    const counts = new Map<QualityKey, number>();
    for (const s of pool) {
      const k = qualityKey(s);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const out: BpQualityChip[] = [{ key: "all", count: pool.length }];
    for (const k of QUALITY_ORDER) {
      const count = counts.get(k) ?? 0;
      if (count > 0) out.push({ key: k, count });
    }
    return out;
  }, [addonFiltered, facet]);

  const allFacets = useMemo(
    () =>
      BP_FACET_DIMS.map((dim) => {
        const pool = addonFiltered.filter(
          (s) =>
            (quality === "all" || qualityKey(s) === quality) && matchesFacets(s, facet, dim.key),
        );
        return {
          key: dim.key,
          label: dim.label,
          value: facet[dim.key] ?? "all",
          total: pool.length,
          options: facetOptions(pool, dim),
        };
      }),
    [addonFiltered, facet, quality],
  );

  useEffect(() => {
    for (const f of allFacets) {
      if (f.value !== "all" && !f.options.some((o) => o.key === f.value)) {
        setFacetState((prev) => ({ ...prev, [f.key]: "all" }));
      }
    }
  }, [allFacets]);

  useEffect(() => {
    if (quality !== "all" && !qualityChips.some((c) => c.key === quality)) setQuality("all");
  }, [quality, qualityChips]);

  useEffect(() => {
    if (addonFilter !== "all" && addonFiltered.length === 0 && displayStreams.length > 0) {
      setAddonFilter("all");
    }
  }, [addonFilter, addonFiltered.length, displayStreams.length]);

  // A dimension where every stream lands on the same value cannot narrow
  // anything, and on a controller each dead chip is an extra press.
  const facets = useMemo(
    () => allFacets.filter((f) => f.options.length >= 2 || f.value !== "all"),
    [allFacets],
  );

  const streams = useMemo(() => {
    const visible = addonFiltered.filter(
      (s) => (quality === "all" || qualityKey(s) === quality) && matchesFacets(s, facet),
    );
    if (addonFilter !== "all") return visible;
    if (addonOrderMode || hostMatch) return visible;
    const sorted = visible.slice().sort((a, b) => {
      const aw = isWatchHub(a) ? 1 : 0;
      const bw = isWatchHub(b) ? 1 : 0;
      if (aw !== bw) return aw - bw;
      const ad = needsDownload(a) ? 1 : 0;
      const bd = needsDownload(b) ? 1 : 0;
      if (ad !== bd) return ad - bd;
      const ar = addonRank.get(a.addonUrl ?? "") ?? 9999;
      const br = addonRank.get(b.addonUrl ?? "") ?? 9999;
      if (ar !== br) return ar - br;
      const ai = hasInstantMarker(a) ? 1 : 0;
      const bi = hasInstantMarker(b) ? 1 : 0;
      if (ai !== bi) return bi - ai;
      return 0;
    });
    if (!pinned || !sorted.includes(pinned)) return sorted;
    return [pinned, ...sorted.filter((s) => s !== pinned)];
  }, [addonFiltered, quality, facet, addonFilter, addonOrderMode, addonRank, hostMatch, pinned]);

  const pickerAll = result?.picker.all ?? [];
  const langHiddenCount = useMemo(() => {
    if (preferredLangs.length === 0) return 0;
    return pickerAll.filter((s) => !streamMatchesLangs(s, preferredLangs)).length;
  }, [pickerAll, preferredLangs]);
  const uncachedHiddenCount = useMemo(() => {
    if (debrids.length === 0) return 0;
    return pickerAll.filter((s) => !isCached(s)).length;
  }, [pickerAll, debrids.length, isCached]);

  const filtered =
    quality !== "all" ||
    addonFilter !== "all" ||
    cachedOnly ||
    langFilter ||
    Object.values(facet).some((v) => v && v !== "all");

  return {
    streams,
    total: displayStreams.length,
    quality,
    setQuality,
    qualityChips,
    facets,
    setFacet: (key, value) => setFacetState((prev) => ({ ...prev, [key]: value })),
    addonFilter,
    setAddonFilter,
    addonOptions,
    cachedOnly,
    setCachedOnly,
    cachedCount: pickerAll.length - uncachedHiddenCount,
    uncachedHiddenCount,
    langFilter,
    setLangFilter,
    langHiddenCount,
    preferredLangs,
    streamMode: settings.streamMode,
    setStreamMode: (m) => update({ streamMode: m }),
    sort: settings.streamSort,
    setSort: (s) => update({ streamSort: s }),
    sortForced: anyAddonRanked,
    customFilters: settings.customStreamFilters,
    activeFilterId: settings.activeStreamFilterId,
    setActiveFilterId: (id) => update({ activeStreamFilterId: id }),
    filterFellBack: base.fellBack,
    filtered,
    clearFilters: () => {
      setQuality("all");
      setFacetState({});
      setAddonFilter("all");
      setCachedOnly(false);
      setLangFilter(false);
    },
  };
}
