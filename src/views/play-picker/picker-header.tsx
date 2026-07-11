import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import type { PlayEpisode } from "@/lib/view";
import { ChevronDown, ChevronLeft, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function PickerHeader({
  meta,
  episode,
  onBack,
  onRefresh,
  refreshing = false,
}: {
  meta: Meta;
  episode?: PlayEpisode;
  onBack: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const t = useT();
  return (
    <header className="flex flex-col gap-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="group/back -ms-1 flex w-fit items-center gap-3 rounded-full py-1.5 pe-6 ps-1.5 text-[17px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated/70 ring-1 ring-edge-soft transition-colors group-hover/back:bg-elevated">
            <ChevronLeft size={26} strokeWidth={2.4} className="dir-icon" />
          </span>
          Back
        </button>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title={t("Refresh sources")}
            aria-label={t("Refresh sources")}
            className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-edge-soft bg-elevated/70 ps-4 pe-5 text-[14px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={17} strokeWidth={2.4} className={refreshing ? "animate-spin" : ""} />
            {t("Refresh")}
          </button>
        )}
      </div>
      {episode ? (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-subtle">
            {meta.name} · Season {episode.imdbSeason ?? episode.season} · Episode{" "}
            {String(episode.imdbEpisode ?? episode.episode).padStart(2, "0")}
          </p>
          <h1 className="font-display text-[64px] font-medium leading-[0.96] tracking-tight text-ink">
            {episode.name || `Episode ${episode.episode}`}
          </h1>
          {episode.overview && <CollapsibleOverview text={episode.overview} />}
        </>
      ) : (
        <>
          {meta.releaseInfo && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-subtle">
              {meta.releaseInfo}
              {meta.genres?.length ? ` · ${meta.genres.slice(0, 2).join(" · ")}` : ""}
            </p>
          )}
          <h1 className="font-display text-[68px] font-medium leading-[0.96] tracking-tight text-ink">{meta.name}</h1>
        </>
      )}
    </header>
  );
}

function CollapsibleOverview({ text }: { text: string }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const check = () => setTruncated(el.scrollHeight - el.clientHeight > 2);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text, expanded]);
  return (
    <div className="mt-2 max-w-2xl">
      <p ref={ref} className={`text-[14.5px] leading-relaxed text-ink-muted ${expanded ? "" : "line-clamp-2"}`}>
        {text}
      </p>
      {(truncated || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-subtle transition-colors hover:text-ink"
        >
          {expanded ? t("Show less") : t("View more")}
          <ChevronDown
            size={14}
            strokeWidth={2.4}
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}
