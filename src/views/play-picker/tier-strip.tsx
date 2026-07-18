import { Info, Zap } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FormatBadge } from "@/components/format-badge";
import { useDebridClients } from "@/lib/debrid/registry";
import type { ScoredStream, Tier } from "@/lib/streams/types";
import {
  formatSize,
  hasCachedMarker,
  hasUncachedMarker,
  streamLeadBadge,
  streamLeadLabel,
} from "./picker-utils";

export function TierStrip({
  tiers,
  selected,
  onSelect,
  byTier,
  debrids,
  langFilterSlot,
}: {
  tiers: Tier[];
  selected: Tier | null;
  onSelect: (t: Tier) => void;
  byTier: Partial<Record<Tier, ScoredStream>>;
  debrids: ReturnType<typeof useDebridClients>;
  langFilterSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="text-[12px] font-bold uppercase tracking-[0.32em] text-ink-subtle">
          Switch quality
        </p>
        <QualityDisclaimer />
        {langFilterSlot}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {tiers.map((t) => {
          const stream = byTier[t]!;
          const isActive = selected === t;
          const cachedHere = debrids.some((d) => stream.cached[d.slug]) || hasCachedMarker(stream);
          const trulyInstantHere =
            (stream.url != null && !stream.infoHash && !hasUncachedMarker(stream)) ||
            debrids.some((d) => stream.inLibrary[d.slug]);
          const sizeStr = stream.size != null ? formatSize(stream.size) : null;
          const badgeKind = streamLeadBadge(stream, t);
          const accent = streamLeadLabel(stream, t);
          const statusLabel = trulyInstantHere ? "Instant" : cachedHere ? "Cached" : "Cache";
          return (
            <button
              key={t}
              onClick={() => onSelect(t)}
              className={`group flex min-h-[56px] items-center gap-3 rounded-[14px] border px-4 py-2.5 text-start transition-[border-color,background-color,opacity] duration-200 ${
                isActive
                  ? "border-ink/35 bg-ink/[0.05]"
                  : "border-edge-soft hover:border-edge hover:bg-canvas/60"
              } ${cachedHere ? "" : "opacity-65 hover:opacity-90"}`}
            >
              <FormatBadge kind={badgeKind} size="lg" />
              <div className="flex flex-col items-start gap-0.5">
                <span
                  className={`flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.16em] ${
                    isActive ? "text-ink" : "text-ink-muted group-hover:text-ink"
                  }`}
                >
                  {accent}
                </span>
                <span className="flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.04em] text-ink-subtle">
                  {trulyInstantHere ? (
                    <Zap size={10} fill="currentColor" strokeWidth={0} className="text-accent/80" />
                  ) : cachedHere ? (
                    <Zap size={10} strokeWidth={2} className="text-ink-muted/70" />
                  ) : null}
                  {statusLabel} · {sizeStr ?? "size unknown"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QualityDisclaimer() {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; place: "above" | "below" } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const desiredHeight = 168;
    const place: "above" | "below" = rect.top - desiredHeight - 10 > 12 ? "above" : "below";
    const width = 320;
    const top = place === "above" ? rect.top - 10 - desiredHeight : rect.bottom + 10;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, vw - width - 12));
    setPos({ top, left, place });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  return (
    <span
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      className="inline-flex shrink-0 items-center text-ink-subtle/70 transition-colors hover:text-ink-muted cursor-help outline-none"
    >
      <Info size={13} strokeWidth={2.2} />
      {open &&
        pos &&
        createPortal(
          <div
            style={{ top: pos.top, left: pos.left, width: 320 }}
            className="pointer-events-none fixed z-[145] flex flex-col gap-2 rounded-xl border border-edge bg-elevated/97 px-4 py-3.5 text-start shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
          >
            <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Info size={11} strokeWidth={2.4} />
              Quality labels come from addons
            </span>
            <p className="text-[12.5px] leading-snug text-ink-muted">
              Each row's resolution badge is whatever the addon claimed. Some addons mislabel files:
              a 1080p or 4K tag on a brand-new theatrical release is often a CAM or TS rebadged.
              Harbor pushes obvious mismatches down the ranking, but if a top result looks
              suspicious, scroll the source list or pick the Theater Capture tier instead.
            </p>
          </div>,
          document.body,
        )}
    </span>
  );
}
