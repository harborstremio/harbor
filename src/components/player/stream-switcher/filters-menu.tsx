import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddonLogo } from "@/components/addon-logo";
import { FormatBadge, type BadgeKind } from "@/components/format-badge";
import { useT } from "@/lib/i18n";
import type { StreamMode } from "@/components/stream-mode-toggle";
import { abbreviateLanguages } from "./lang-utils";
import { QUALITY_LABEL, type QualityKey } from "./quality";

const SOURCE_BADGE: Record<string, BadgeKind> = {
  Remux: "remux",
  BluRay: "bluray",
  "WEB-DL": "webdl",
  WEBRip: "webrip",
  HDTV: "hdtv",
  CAM: "cam",
};

type Opt = { id: string; name: string; count: number };
type QualOpt = { id: Exclude<QualityKey, "all">; name: string; count: number; badge: BadgeKind };

export type SwitcherFilters = {
  mode: StreamMode;
  setMode: (m: StreamMode) => void;
  quality: QualityKey;
  setQuality: (q: QualityKey) => void;
  qualityOptions: QualOpt[];
  source: string;
  setSource: (s: string) => void;
  sourceOptions: Opt[];
  addon: string;
  setAddon: (a: string) => void;
  addonOptions: Opt[];
  addonLogos: Map<string, string | null>;
  total: number;
  hasDebrid: boolean;
  cachedOnly: boolean;
  setCachedOnly: (v: boolean) => void;
  uncachedHidden: number;
  preferredLangs: string[];
  filterToPreferred: boolean;
  setFilterToPreferred: (v: boolean) => void;
  langHidden: number;
  rejectedCount: number;
  showFlagged: boolean;
  setShowFlagged: (v: boolean) => void;
};

function activeCountOf(f: SwitcherFilters): number {
  return (
    (f.mode !== "both" ? 1 : 0) +
    (f.quality !== "all" ? 1 : 0) +
    (f.source !== "all" ? 1 : 0) +
    (f.addon !== "all" ? 1 : 0) +
    (f.cachedOnly ? 1 : 0) +
    (f.filterToPreferred ? 1 : 0) +
    (f.showFlagged ? 1 : 0)
  );
}

export function FiltersMenu({ filters }: { filters: SwitcherFilters }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = activeCountOf(filters);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const reset = () => {
    filters.setMode("both");
    filters.setQuality("all");
    filters.setSource("all");
    filters.setAddon("all");
    filters.setCachedOnly(false);
    filters.setFilterToPreferred(false);
    filters.setShowFlagged(false);
  };

  const showLangs = filters.preferredLangs.length > 0 && filters.langHidden > 0;
  const showCached = filters.hasDebrid && filters.uncachedHidden > 0;
  const showFlagged = filters.rejectedCount > 0;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-2 rounded-md px-3.5 text-[11.5px] font-semibold tracking-[0.04em] transition-colors ${
          active > 0
            ? "bg-elevated text-ink ring-1 ring-edge hover:bg-raised"
            : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SlidersHorizontal size={13} strokeWidth={2.2} />
        {t("Filters")}
        {active > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold tabular-nums text-canvas">
            {active}
          </span>
        )}
        <ChevronDown
          size={12}
          strokeWidth={2.4}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute end-0 top-full z-30 mt-2 max-h-[68vh] w-[288px] overflow-y-auto rounded-md bg-elevated p-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
          <Section label={t("Sources")}>
            <div className="flex gap-1.5">
              {(
                [
                  ["both", t("Both")],
                  ["addons", t("Direct/debrid")],
                  ["p2p", t("P2P")],
                ] as Array<[StreamMode, string]>
              ).map(([v, label]) => (
                <Chip key={v} active={filters.mode === v} onClick={() => filters.setMode(v)} grow>
                  {label}
                </Chip>
              ))}
            </div>
          </Section>

          {filters.qualityOptions.length > 0 && (
            <Section label={t("Quality")}>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={filters.quality === "all"} onClick={() => filters.setQuality("all")}>
                  {t("Any")}
                </Chip>
                {filters.qualityOptions.map((o) => (
                  <Chip
                    key={o.id}
                    active={filters.quality === o.id}
                    onClick={() => filters.setQuality(o.id)}
                  >
                    <FormatBadge kind={o.badge} size="sm" />
                    {QUALITY_LABEL[o.id]}
                    <Count n={o.count} />
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {filters.sourceOptions.length > 0 && (
            <Section label={t("Format")}>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={filters.source === "all"} onClick={() => filters.setSource("all")}>
                  {t("Any")}
                </Chip>
                {filters.sourceOptions.map((o) => (
                  <Chip
                    key={o.id}
                    active={filters.source === o.id}
                    onClick={() => filters.setSource(o.id)}
                  >
                    {SOURCE_BADGE[o.id] && <FormatBadge kind={SOURCE_BADGE[o.id]} size="sm" />}
                    {o.name}
                    <Count n={o.count} />
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {filters.addonOptions.length > 1 && (
            <Section label={t("Addon")}>
              <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
                <AddonRow
                  active={filters.addon === "all"}
                  onClick={() => filters.setAddon("all")}
                  name={t("All addons")}
                  count={filters.total}
                />
                {filters.addonOptions.map((o) => (
                  <AddonRow
                    key={o.id}
                    active={filters.addon === o.id}
                    onClick={() => filters.setAddon(o.id)}
                    name={o.name}
                    count={o.count}
                    logo={
                      <AddonLogo
                        addonId={o.id}
                        addonName={o.name}
                        manifestLogo={filters.addonLogos.get(o.id) ?? null}
                        size="sm"
                      />
                    }
                  />
                ))}
              </div>
            </Section>
          )}

          {(showCached || showLangs || showFlagged) && (
            <div className="mt-3 flex flex-col gap-0.5 border-t border-edge-soft pt-2">
              {showCached && (
                <ToggleRow
                  label={t("Cached only")}
                  hint={t("{n} uncached hidden", { n: filters.uncachedHidden })}
                  on={filters.cachedOnly}
                  onClick={() => filters.setCachedOnly(!filters.cachedOnly)}
                />
              )}
              {showLangs && (
                <ToggleRow
                  label={t("{langs} only", { langs: abbreviateLanguages(filters.preferredLangs) })}
                  hint={t("{n} hidden", { n: filters.langHidden })}
                  on={filters.filterToPreferred}
                  onClick={() => filters.setFilterToPreferred(!filters.filterToPreferred)}
                />
              )}
              {showFlagged && (
                <ToggleRow
                  label={t("Show flagged")}
                  hint={t("{n} hidden by trust filter", { n: filters.rejectedCount })}
                  on={filters.showFlagged}
                  onClick={() => filters.setShowFlagged(!filters.showFlagged)}
                />
              )}
            </div>
          )}

          {active > 0 && (
            <button
              onClick={reset}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-raised py-2 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <RotateCcw size={12} strokeWidth={2.4} />
              {t("Reset filters")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  grow,
  children,
}: {
  active: boolean;
  onClick: () => void;
  grow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        grow ? "flex-1 justify-center" : ""
      } ${active ? "bg-ink text-canvas" : "bg-raised text-ink-muted hover:bg-surface hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="text-[10.5px] tabular-nums opacity-60">{n}</span>;
}

function AddonRow({
  active,
  onClick,
  name,
  count,
  logo,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  count: number;
  logo?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start text-[12.5px] transition-colors hover:bg-raised ${
        active ? "font-semibold text-ink" : "text-ink-muted"
      }`}
    >
      <span className="shrink-0">{logo}</span>
      <span className="flex-1 truncate">{name}</span>
      <span className="text-[11px] tabular-nums text-ink-subtle">{count}</span>
    </button>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  onClick,
}: {
  label: string;
  hint: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-raised"
    >
      <span className="flex min-w-0 flex-col">
        <span className={`text-[12.5px] ${on ? "font-semibold text-ink" : "text-ink-muted"}`}>
          {label}
        </span>
        <span className="truncate text-[10.5px] text-ink-subtle">{hint}</span>
      </span>
      <span
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-edge"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? "start-3.5" : "start-0.5"}`}
        />
      </span>
    </button>
  );
}
