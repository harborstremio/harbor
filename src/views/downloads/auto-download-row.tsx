import { RotateCw, X } from "lucide-react";
import { Poster, usePosterChain } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { removeAutoDownload, updateAutoDownload, type AutoDlSeries } from "@/lib/auto-download";
import { useIsChecking, useNextRunAt } from "@/lib/auto-download/runner";
import {
  InlineChoice,
  P2P_OPTIONS,
  QUALITY_OPTIONS,
  STOP_OPTIONS,
  airText,
  nextCheckText,
  p2pLabel,
  qualityLabel,
  stopEquals,
  stopLabel,
  useNow,
} from "./auto-download-controls";

export function AutoDownloadRow({ series }: { series: AutoDlSeries }) {
  const { settings } = useSettings();
  const now = useNow();
  const checking = useIsChecking(series.id);
  const nextRunAt = useNextRunAt();
  const poster = usePosterChain(settings.rpdbKey, series.id, series.poster ?? undefined, "series");
  const grabbed = series.grabbedCount > 0;
  const limitReached =
    series.stop.kind === "count" &&
    series.grabbedCount - (series.stop.from ?? series.grabbedCount) >= series.stop.value;
  const statusText = grabbed
    ? `${series.grabbedCount} grabbed`
    : series.lastCheckedAt == null
      ? "first check pending"
      : "up to date";
  const air = limitReached ? null : airText(series.nextAirDate, now);
  const tailText = limitReached ? "limit reached" : nextCheckText(nextRunAt, now);

  return (
    <li className="flex gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-3.5">
      <div className="h-[68px] w-[46px] shrink-0 overflow-hidden rounded-lg">
        <Poster src={poster.src} onError={poster.onError} seed={series.id} ratio="portrait" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[14.5px] font-semibold text-ink">{series.title}</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] tabular-nums">
              <span className={grabbed ? "font-medium text-accent" : "text-ink-subtle"}>
                {statusText}
              </span>
              {grabbed && series.lastGrabbed && (
                <span className="text-ink-muted">· last {series.lastGrabbed}</span>
              )}
              {air && <span className="text-ink-muted">· {air}</span>}
              {checking ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                  <span className="text-ink-subtle">·</span>
                  <RotateCw size={11} strokeWidth={2.2} className="animate-spin" />
                  checking now
                </span>
              ) : (
                <span className="text-ink-subtle">· {tailText}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeAutoDownload(series.id)}
            aria-label={`Stop auto-downloading ${series.title}`}
            title="Stop auto-downloading"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-ink/10 hover:text-ink"
          >
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-muted">
          Grab{" "}
          <InlineChoice
            label={qualityLabel(series.maxHeight)}
            options={QUALITY_OPTIONS}
            isActive={(v) => v === series.maxHeight}
            onSelect={(v) => updateAutoDownload(series.id, { maxHeight: v })}
          />{" "}
          episodes,{" "}
          <InlineChoice
            label={p2pLabel(series.allowP2p)}
            options={P2P_OPTIONS}
            isActive={(v) => v === series.allowP2p}
            onSelect={(v) => updateAutoDownload(series.id, { allowP2p: v })}
          />
          ,{" "}
          <InlineChoice
            label={stopLabel(series.stop)}
            options={STOP_OPTIONS}
            isActive={(v) => stopEquals(v, series.stop)}
            onSelect={(v) => updateAutoDownload(series.id, { stop: v })}
          />
          .
        </p>
      </div>
    </li>
  );
}
