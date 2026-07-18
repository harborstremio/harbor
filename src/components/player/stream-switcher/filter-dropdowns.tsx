import { Boxes, ChevronDown, Disc3, Gauge } from "lucide-react";
import { AddonLogo } from "@/components/addon-logo";
import { FormatBadge, type BadgeKind } from "@/components/format-badge";
import { useT } from "@/lib/i18n";
import { QUALITY_BADGE, QUALITY_LABEL, type QualityKey } from "./quality";

export function AddonFilterMenu({
  addonFilter,
  setAddonFilter,
  open,
  setOpen,
  addonOptions,
  addonLogos,
  totalCount,
  activeAddonName,
}: {
  addonFilter: string;
  setAddonFilter: (id: string) => void;
  open: boolean;
  setOpen: (fn: (v: boolean) => boolean) => void;
  addonOptions: Array<{ id: string; name: string; count: number }>;
  addonLogos: Map<string, string | null>;
  totalCount: number;
  activeAddonName: string;
}) {
  const t = useT();
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-2 rounded-md px-3.5 text-[11.5px] font-semibold tracking-[0.04em] transition-colors ${
          addonFilter !== "all"
            ? "bg-elevated text-ink ring-1 ring-edge hover:bg-raised"
            : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Boxes size={13} strokeWidth={2.2} />
        <span className="max-w-[140px] truncate">{activeAddonName}</span>
        <ChevronDown
          size={12}
          strokeWidth={2.4}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-20 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-md border border-edge bg-elevated p-1.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.7)]">
          <button
            onClick={() => {
              setAddonFilter("all");
              setOpen(() => false);
            }}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-[12.5px] transition-colors hover:bg-raised ${
              addonFilter === "all" ? "text-ink font-semibold" : "text-ink-muted"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-raised text-ink-subtle">
              <Boxes size={14} strokeWidth={2.2} />
            </span>
            <span className="flex-1 truncate">{t("All addons")}</span>
            <span className="text-[11px] tabular-nums text-ink-subtle">{totalCount}</span>
          </button>
          {addonOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setAddonFilter(opt.id);
                setOpen(() => false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-[12.5px] transition-colors hover:bg-raised ${
                addonFilter === opt.id ? "text-ink font-semibold" : "text-ink-muted"
              }`}
            >
              <span className="shrink-0">
                <AddonLogo
                  addonId={opt.id}
                  addonName={opt.name}
                  manifestLogo={addonLogos.get(opt.id) ?? null}
                  size="md"
                />
              </span>
              <span className="flex-1 truncate">{opt.name}</span>
              <span className="text-[11px] tabular-nums text-ink-subtle">{opt.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SOURCE_BADGE: Record<string, BadgeKind> = {
  Remux: "remux",
  BluRay: "bluray",
  "WEB-DL": "webdl",
  WEBRip: "webrip",
  HDTV: "hdtv",
  CAM: "cam",
};

export function SourceFilterMenu({
  sourceFilter,
  setSourceFilter,
  open,
  setOpen,
  sourceOptions,
  totalCount,
}: {
  sourceFilter: string;
  setSourceFilter: (s: string) => void;
  open: boolean;
  setOpen: (fn: (v: boolean) => boolean) => void;
  sourceOptions: Array<{ id: string; name: string; count: number }>;
  totalCount: number;
}) {
  const t = useT();
  const activeName = sourceFilter === "all" ? t("Any source") : sourceFilter;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-2 rounded-md px-3.5 text-[11.5px] font-semibold tracking-[0.04em] transition-colors ${
          sourceFilter !== "all"
            ? "bg-elevated text-ink ring-1 ring-edge hover:bg-raised"
            : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {sourceFilter !== "all" && SOURCE_BADGE[sourceFilter] ? (
          <FormatBadge kind={SOURCE_BADGE[sourceFilter]} size="sm" />
        ) : (
          <Disc3 size={13} strokeWidth={2.2} />
        )}
        <span className="max-w-[120px] truncate">{activeName}</span>
        <ChevronDown
          size={12}
          strokeWidth={2.4}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-20 mt-1.5 w-52 overflow-y-auto rounded-md border border-edge bg-elevated p-1.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.7)]">
          <button
            onClick={() => {
              setSourceFilter("all");
              setOpen(() => false);
            }}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-[12.5px] transition-colors hover:bg-raised ${
              sourceFilter === "all" ? "text-ink font-semibold" : "text-ink-muted"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-raised text-ink-subtle">
              <Disc3 size={14} strokeWidth={2.2} />
            </span>
            <span className="flex-1 truncate">{t("Any source")}</span>
            <span className="text-[11px] tabular-nums text-ink-subtle">{totalCount}</span>
          </button>
          {sourceOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setSourceFilter(opt.id);
                setOpen(() => false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-[12.5px] transition-colors hover:bg-raised ${
                sourceFilter === opt.id ? "text-ink font-semibold" : "text-ink-muted"
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                {SOURCE_BADGE[opt.id] ? (
                  <FormatBadge kind={SOURCE_BADGE[opt.id]} size="sm" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-raised text-[10px] font-bold uppercase text-ink-subtle">
                    {opt.name.slice(0, 2)}
                  </span>
                )}
              </span>
              <span className="flex-1 truncate">{opt.name}</span>
              <span className="text-[11px] tabular-nums text-ink-subtle">{opt.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function QualityFilterMenu({
  qualityFilter,
  setQualityFilter,
  open,
  setOpen,
  qualityOptions,
  totalCount,
}: {
  qualityFilter: QualityKey;
  setQualityFilter: (q: QualityKey) => void;
  open: boolean;
  setOpen: (fn: (v: boolean) => boolean) => void;
  qualityOptions: Array<{
    id: Exclude<QualityKey, "all">;
    name: string;
    count: number;
    badge: BadgeKind;
  }>;
  totalCount: number;
}) {
  const t = useT();
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-2 rounded-md px-3.5 text-[11.5px] font-semibold tracking-[0.04em] transition-colors ${
          qualityFilter !== "all"
            ? "bg-elevated text-ink ring-1 ring-edge hover:bg-raised"
            : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {qualityFilter === "all" ? (
          <Gauge size={13} strokeWidth={2.2} />
        ) : (
          <FormatBadge
            kind={QUALITY_BADGE[qualityFilter as Exclude<QualityKey, "all">]}
            size="sm"
          />
        )}
        <span className="max-w-[120px] truncate">
          {qualityFilter === "all"
            ? t("Any quality")
            : QUALITY_LABEL[qualityFilter as Exclude<QualityKey, "all">]}
        </span>
        <ChevronDown
          size={12}
          strokeWidth={2.4}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-20 mt-1.5 w-56 overflow-y-auto rounded-md border border-edge bg-elevated p-1.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.7)]">
          <button
            onClick={() => {
              setQualityFilter("all");
              setOpen(() => false);
            }}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-[12.5px] transition-colors hover:bg-raised ${
              qualityFilter === "all" ? "text-ink font-semibold" : "text-ink-muted"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-raised text-ink-subtle">
              <Gauge size={14} strokeWidth={2.2} />
            </span>
            <span className="flex-1 truncate">{t("Any quality")}</span>
            <span className="text-[11px] tabular-nums text-ink-subtle">{totalCount}</span>
          </button>
          {qualityOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setQualityFilter(opt.id);
                setOpen(() => false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-[12.5px] transition-colors hover:bg-raised ${
                qualityFilter === opt.id ? "text-ink font-semibold" : "text-ink-muted"
              }`}
            >
              <span className="flex h-7 shrink-0 items-center justify-center">
                <FormatBadge kind={opt.badge} size="sm" />
              </span>
              <span className="flex-1 truncate">{opt.name}</span>
              <span className="text-[11px] tabular-nums text-ink-subtle">{opt.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
