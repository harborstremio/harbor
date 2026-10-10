import { MousePointerClick, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { addonLogoMap } from "@/components/addon-logo";
import { HostSourceBanner } from "@/components/host-source-banner";
import { HoverTooltip } from "@/components/hover-tooltip";
import { fetchInstalledAddons } from "@/lib/addon-store";
import { userAddons, type Addon } from "@/lib/addons";
import { useAuth } from "@/lib/auth";
import { peekPickerCache, subscribePickerCache } from "@/lib/picker-cache";
import { useSettings } from "@/lib/settings";
import type { ScoredStream } from "@/lib/streams/types";
import { hasCachedMarker } from "@/lib/streams/cached";
import { filterStreamsByMode } from "@/lib/streams/mode";
import type { SourceDescriptor } from "@/lib/together/protocol";
import { buildMatchScores, matchBadge } from "@/lib/together/source-match";
import { addonInstanceKey, buildAddonOptions } from "@/views/play-picker/picker-utils";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode, PlayerStreamRef } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { useActiveKid } from "@/lib/profiles";
import { FiltersMenu, type SwitcherFilters } from "./stream-switcher/filters-menu";
import { sourceGroup } from "@/views/play-picker/quality-filter";
import { KidsStreamSwitcher } from "./stream-switcher/kids-switcher";
import { normalizeLangCode, streamMatchesLangs } from "./stream-switcher/lang-utils";
import {
  QUALITY_BADGE,
  QUALITY_LABEL,
  QUALITY_ORDER,
  qualityKey,
  type QualityKey,
} from "./stream-switcher/quality";
import { isCurrentStream, streamKey, SwitcherRow } from "./stream-switcher/switcher-row";
import { useSwitcherRefresh } from "./stream-switcher/use-switcher-refresh";

function isHiddenAddon(addonId: string, addonName?: string): boolean {
  const id = (addonId || "").toLowerCase();
  const name = (addonName || "").toLowerCase();
  return id.includes("watchhub") || name.includes("watchhub");
}

export function StreamSwitcher({
  open,
  onClose,
  onPick,
  resolvingKey,
  currentUrl,
  currentInfoHash,
  currentFileIdx,
  currentRef,
  debridSlugs,
  meta,
  episode,
  imdbId,
  hostSource,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (stream: ScoredStream) => void;
  resolvingKey: string | null;
  currentUrl: string;
  currentInfoHash?: string | null;
  currentFileIdx?: number | null;
  currentRef?: PlayerStreamRef | null;
  debridSlugs: string[];
  meta: Meta;
  episode?: PlayEpisode;
  imdbId?: string | null;
  hostSource?: SourceDescriptor | null;
}) {
  const t = useT();
  const kid = useActiveKid();
  const { authKey } = useAuth();
  const { settings, update } = useSettings();
  const baseLangs = settings.preferredLanguages ?? [];
  const isAnimeRequest =
    typeof meta.id === "string" && (meta.id.startsWith("kitsu:") || meta.id.startsWith("mal:"));
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
  const [cache, setCache] = useState(() => peekPickerCache(meta, episode));
  const [addonLogos, setAddonLogos] = useState<Map<string, string | null>>(new Map());
  const [filterToPreferred, setFilterToPreferred] = useState(
    settings.requirePreferredLanguage === true && preferredLangs.length > 0,
  );

  useEffect(
    () => subscribePickerCache(() => setCache(peekPickerCache(meta, episode))),
    [meta, episode],
  );

  const { refreshing, refresh } = useSwitcherRefresh({
    meta,
    episode,
    imdbId: imdbId ?? null,
    active: open,
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const installed = await fetchInstalledAddons().catch(() => [] as Addon[]);
      const stremio = authKey ? await userAddons(authKey).catch(() => [] as Addon[]) : [];
      if (cancelled) return;
      setAddonLogos(addonLogoMap([...installed, ...stremio]));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, authKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const keptStreams = useMemo<ScoredStream[]>(() => {
    const all = cache?.result.picker.all ?? [];
    return filterStreamsByMode(all, settings.streamMode);
  }, [cache, settings.streamMode]);
  const rejectedStreams = useMemo<ScoredStream[]>(
    () =>
      (cache?.result.rejected ?? []).map((r) => ({
        ...r.stream,
        score: 0,
        reasons: [{ signal: `filtered:${r.reason}`, delta: 0 }],
        tier: "ROUGH" as const,
      })),
    [cache],
  );
  const [showFiltered, setShowFiltered] = useState(false);
  const allStreams = useMemo<ScoredStream[]>(
    () => (showFiltered ? [...keptStreams, ...rejectedStreams] : keptStreams),
    [keptStreams, rejectedStreams, showFiltered],
  );
  const cachedStreams = useMemo(
    () =>
      allStreams.filter(
        (s) =>
          s.url != null ||
          debridSlugs.some(
            (slug) =>
              s.cached[slug as keyof typeof s.cached] ||
              s.inLibrary[slug as keyof typeof s.inLibrary],
          ) ||
          hasCachedMarker(s),
      ),
    [allStreams, debridSlugs],
  );
  const [cachedOnly, setCachedOnly] = useState(false);
  const baseList =
    cachedOnly && debridSlugs.length > 0 && cachedStreams.length > 0 ? cachedStreams : allStreams;
  const [addonFilter, setAddonFilter] = useState<string>("all");
  const [qualityFilter, setQualityFilter] = useState<QualityKey>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const qualityOptions = useMemo(() => {
    const counts = new Map<Exclude<QualityKey, "all">, number>();
    for (const s of allStreams) {
      const k = qualityKey(s);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return QUALITY_ORDER.filter((q) => (counts.get(q) ?? 0) > 0).map((q) => ({
      id: q,
      name: QUALITY_LABEL[q],
      count: counts.get(q) ?? 0,
      badge: QUALITY_BADGE[q],
    }));
  }, [allStreams]);
  useEffect(() => {
    if (qualityFilter !== "all" && !qualityOptions.some((o) => o.id === qualityFilter)) {
      setQualityFilter("all");
    }
  }, [qualityOptions, qualityFilter]);
  const sourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of allStreams) {
      const g = sourceGroup(s);
      if (g == null) continue;
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    const order = ["Remux", "BluRay", "WEB-DL", "WEBRip", "HDTV", "CAM"];
    return order
      .filter((g) => (counts.get(g) ?? 0) > 0)
      .map((g) => ({ id: g, name: g, count: counts.get(g) ?? 0 }));
  }, [allStreams]);
  useEffect(() => {
    if (sourceFilter !== "all" && !sourceOptions.some((o) => o.id === sourceFilter)) {
      setSourceFilter("all");
    }
  }, [sourceOptions, sourceFilter]);
  const addonOptions = useMemo(() => buildAddonOptions(allStreams), [allStreams]);
  useEffect(() => {
    if (addonFilter !== "all" && !addonOptions.some((o) => o.id === addonFilter)) {
      setAddonFilter("all");
    }
  }, [addonOptions, addonFilter]);
  const matchScores = useMemo(
    () => (hostSource ? buildMatchScores(allStreams, hostSource) : null),
    [allStreams, hostSource],
  );
  const addonFilteredList = useMemo(() => {
    let list: ScoredStream[];
    if (addonFilter !== "all") {
      list = baseList.filter((s) => addonInstanceKey(s) === addonFilter);
    } else {
      list = baseList.filter((s) => !isHiddenAddon(s.addonId, s.addonName));
    }
    if (qualityFilter !== "all") {
      list = list.filter((s) => qualityKey(s) === qualityFilter);
    }
    if (sourceFilter !== "all") {
      list = list.filter((s) => sourceGroup(s) === sourceFilter);
    }
    if (addonFilter === "all" && matchScores) {
      list = list.slice().sort((a, b) => (matchScores.get(b) ?? 0) - (matchScores.get(a) ?? 0));
    }
    return list;
  }, [baseList, addonFilter, qualityFilter, sourceFilter, matchScores]);
  const matchedStreams = useMemo(
    () =>
      preferredLangs.length === 0
        ? addonFilteredList
        : addonFilteredList.filter((s) => streamMatchesLangs(s, preferredLangs)),
    [addonFilteredList, preferredLangs],
  );
  const filteredList =
    filterToPreferred && preferredLangs.length > 0 ? matchedStreams : addonFilteredList;
  const matchCurrent = useMemo(() => {
    const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();
    return (s: ScoredStream): boolean => {
      if (isCurrentStream(s, currentUrl, currentInfoHash, currentFileIdx)) return true;
      if (!currentRef) return false;
      const ref = currentRef;
      if (ref.infoHash) return false;
      const titleMatch = !!norm(ref.parsedTitle) && norm(ref.parsedTitle) === norm(s.parsedTitle);
      if (!titleMatch) return false;
      const addonMatch = !ref.addonId || ref.addonId === s.addonId;
      const resMatch = !ref.resolution || norm(ref.resolution) === norm(s.resolution);
      const sizeMatch = ref.size == null || s.size == null || ref.size === s.size;
      return addonMatch && resMatch && sizeMatch;
    };
  }, [currentUrl, currentInfoHash, currentFileIdx, currentRef]);
  const currentStream = useMemo(
    () => allStreams.find((s) => matchCurrent(s)) ?? null,
    [allStreams, matchCurrent],
  );
  const list = useMemo(() => {
    if (!currentStream) return filteredList;
    const curKey = streamKey(currentStream);
    return [currentStream, ...filteredList.filter((s) => streamKey(s) !== curKey)];
  }, [filteredList, currentStream]);
  const [showCount, setShowCount] = useState(80);
  useEffect(() => {
    setShowCount(80);
  }, [addonFilter, qualityFilter, sourceFilter, filterToPreferred, cachedOnly, list.length]);
  const hiddenCount = addonFilteredList.length - matchedStreams.length;
  const uncachedHidden = allStreams.length - cachedStreams.length;
  const filters: SwitcherFilters = {
    mode: settings.streamMode,
    setMode: (m) => update({ streamMode: m }),
    quality: qualityFilter,
    setQuality: setQualityFilter,
    qualityOptions,
    source: sourceFilter,
    setSource: setSourceFilter,
    sourceOptions,
    addon: addonFilter,
    setAddon: setAddonFilter,
    addonOptions,
    addonLogos,
    total: allStreams.length,
    hasDebrid: debridSlugs.length > 0,
    cachedOnly,
    setCachedOnly,
    uncachedHidden,
    preferredLangs,
    filterToPreferred,
    setFilterToPreferred,
    langHidden: hiddenCount,
    rejectedCount: rejectedStreams.length,
    showFlagged: showFiltered,
    setShowFlagged: setShowFiltered,
  };
  void cache?.meta.name;
  void cache?.episode;

  if (!open) return null;

  if (kid) {
    return (
      <KidsStreamSwitcher
        list={list}
        onPick={onPick}
        onClose={onClose}
        resolvingKey={resolvingKey}
        currentUrl={currentUrl}
        currentInfoHash={currentInfoHash}
        currentFileIdx={currentFileIdx}
      />
    );
  }

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full max-h-[82vh] w-full max-w-[880px] flex-col overflow-hidden rounded-xl bg-elevated shadow-[0_28px_72px_-20px_rgba(0,0,0,0.85)] ring-1 ring-edge animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-xl">
        <header className="flex items-center justify-between gap-4 border-b border-edge-soft px-6 py-4">
          <div className="flex items-center gap-2.5">
            <HoverTooltip
              label={t("Refresh sources")}
              side="bottom"
              align="center"
              disabled={refreshing}
            >
              <button
                onClick={() => refresh()}
                disabled={refreshing}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-raised text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:cursor-default disabled:opacity-70"
                aria-label={t("Refresh sources")}
              >
                <RefreshCw
                  size={15}
                  strokeWidth={2.2}
                  className={refreshing ? "animate-spin" : ""}
                />
              </button>
            </HoverTooltip>
            <span className="text-[13px] font-semibold tracking-[0.01em] text-ink-muted whitespace-nowrap">
              {refreshing
                ? t("Refreshing…")
                : cache
                  ? t("{n} sources", { n: list.length })
                  : t("No sources")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiltersMenu filters={filters} />
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-raised text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
              aria-label={t("Close")}
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        {hostSource && <HostSourceBanner source={hostSource} compact />}

        {!cache || list.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-12 text-center">
            <p className="text-[13.5px] text-ink-muted">
              {refreshing ? t("Looking for sources…") : t("No sources loaded for this title yet.")}
            </p>
            <button
              onClick={() => refresh()}
              disabled={refreshing}
              className="flex h-10 items-center gap-2 rounded-md bg-raised px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-elevated disabled:opacity-70"
            >
              <RefreshCw size={14} strokeWidth={2.2} className={refreshing ? "animate-spin" : ""} />
              {t("Refresh sources")}
            </button>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-none [&::-webkit-scrollbar-thumb]:border-4 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-ink/25 [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-ink/40">
            {list.slice(0, showCount).map((s, i) => (
              <SwitcherRow
                key={`${s.addonId}-${s.infoHash ?? s.url ?? i}`}
                stream={s}
                addonLogo={addonLogos.get(s.addonId) ?? null}
                onPick={() => onPick(s)}
                resolving={resolvingKey === streamKey(s)}
                isCurrent={matchCurrent(s)}
                match={matchBadge(matchScores?.get(s))}
              />
            ))}
            {list.length > showCount && (
              <li className="px-4 pb-3 pt-1.5">
                <button
                  onClick={() => setShowCount((n) => n + 80)}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-raised px-4 py-2.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                >
                  {t("Load more")}
                  <span className="text-[11px] tabular-nums text-ink-subtle">
                    {t("{n} hidden", { n: list.length - showCount })}
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}

        <footer className="flex items-center justify-between gap-4 border-t border-edge-soft px-6 py-2.5">
          <span className="flex items-center gap-2 text-[12px] text-ink-subtle">
            <MousePointerClick size={13} strokeWidth={2.2} />
            {t("Click any source to swap in place")}
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-ink-subtle">
            <kbd className="inline-flex h-[18px] items-center justify-center rounded-[5px] border border-edge bg-raised px-1.5 font-sans text-[10.5px] font-semibold tracking-normal text-ink-muted">
              Esc
            </kbd>
            {t("to close")}
          </span>
        </footer>
      </div>
    </div>
  );
}
