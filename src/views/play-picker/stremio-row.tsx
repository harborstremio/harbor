import { Check, Download, Play } from "lucide-react";
import { AddonLogo } from "@/components/addon-logo";
import { CopyLinkButton, resolveStreamLink } from "@/components/player/copy-link-button";
import { DubSubPill, streamDubSub } from "@/components/dub-sub-pill";
import { FormatBadge, RuleBadges, streamBadges } from "@/components/format-badge";
import { HostMatchChip } from "@/components/host-match-chip";
import { useSettings } from "@/lib/settings";
import type { ScoredStream } from "@/lib/streams/types";
import { EditionChip } from "./edition-chip";

export function StremioRow({
  stream,
  failed,
  addonLogo,
  match = null,
  onPlay,
  download = false,
  downloadState = "idle",
  isAnime = false,
}: {
  stream: ScoredStream;
  failed: boolean;
  addonLogo: string | null;
  match?: "same" | "close" | null;
  onPlay: () => void;
  download?: boolean;
  downloadState?: "idle" | "preparing" | "queued";
  isAnime?: boolean;
}) {
  const { settings } = useSettings();
  const full = settings.fullStreamDescription;
  const addonName = stream.addonName ?? "Source";
  const headline = stream.name?.trim() || addonName;
  const rawDescription = stream.title?.trim() || stream.description?.trim() || "";
  const description = full ? rawDescription : condenseDescription(rawDescription);
  const badges = settings.showQualityBadge ? streamBadges(stream) : [];
  const dubSub = settings.showDubBadge ? streamDubSub(stream.audioLanguages, isAnime) : null;
  const link = resolveStreamLink(stream);
  const preparing = download && downloadState === "preparing";
  const queued = download && downloadState === "queued";
  const downloadLabel = preparing
    ? "Preparing download"
    : queued
      ? "Added to downloads"
      : "Download";
  return (
    <div
      className={`flex items-stretch gap-5 rounded-2xl bg-elevated/40 p-5 ring-1 transition-colors ${
        failed ? "ring-danger/40 bg-danger/5" : "ring-edge-soft/50"
      }`}
    >
      <div className="flex w-[68px] shrink-0 flex-col items-center justify-center">
        <AddonLogo
          addonId={stream.addonId}
          addonName={addonName}
          manifestLogo={addonLogo}
          size="tile"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <p className="whitespace-pre-line text-[16px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
          {headline}
        </p>
        {description && (
          <p className="whitespace-pre-line text-[14px] leading-snug text-ink-muted [overflow-wrap:anywhere]">
            {description}
          </p>
        )}
        {(badges.length > 0 || match || stream.edition || dubSub) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <HostMatchChip match={match} />
            {dubSub && <DubSubPill kind={dubSub} size="sm" />}
            {badges.map((k) => (
              <FormatBadge key={k} kind={k} size="sm" />
            ))}
            <RuleBadges stream={stream} size="sm" />
            <EditionChip stream={stream} />
          </div>
        )}
        {failed && <p className="text-[13px] font-medium text-danger">Unavailable, try another.</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center">
        {link && <CopyLinkButton url={link} size={16} className="h-9 w-9" />}
        <button
          type="button"
          onClick={() => {
            if (!preparing && !queued) onPlay();
          }}
          aria-disabled={preparing || queued}
          aria-label={download ? downloadLabel : "Play"}
          className={
            download
              ? `source-download-button flex h-9 min-w-[116px] shrink-0 items-center justify-center gap-2.5 rounded-full border px-5 text-[13px] font-medium tracking-tight transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.96] active:duration-100 aria-disabled:cursor-default aria-disabled:active:scale-100 motion-reduce:transition-none ${
                  queued
                    ? "border-accent/25 bg-accent-soft text-accent"
                    : "border-ink/[0.06] bg-ink/[0.04] text-ink hover:scale-[1.02] hover:bg-ink/[0.07] aria-disabled:hover:scale-100"
                }`
              : "flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-canvas shadow-[0_2px_6px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.18)] transition-[transform,box-shadow,background-color,color] duration-150 ease-out hover:shadow-[0_5px_14px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.18)] active:scale-[0.96] active:duration-100"
          }
        >
          {preparing ? (
            <>
              <TrailingDots />
              <span>Preparing</span>
            </>
          ) : queued ? (
            <>
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
              <span>Added</span>
            </>
          ) : download ? (
            <>
              <span className="relative h-4 w-4 shrink-0" aria-hidden="true">
                <Download
                  size={16}
                  strokeWidth={2.2}
                  className="source-download-morph-icon source-download-morph-icon-default absolute inset-0"
                />
                <Check
                  size={16}
                  strokeWidth={2.5}
                  className="source-download-morph-icon source-download-morph-icon-check absolute inset-0"
                />
              </span>
              <span>Download</span>
            </>
          ) : (
            <Play size={26} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        {download && (
          <span className="sr-only" aria-live="polite">
            {downloadState === "idle" ? "" : downloadLabel}
          </span>
        )}
      </div>
    </div>
  );
}

const TRAILING_DOTS = [0, 1, 2, 3, 4] as const;

function TrailingDots() {
  return (
    <span className="relative h-5 w-5 shrink-0" aria-hidden="true">
      {TRAILING_DOTS.map((i) => (
        <span
          key={i}
          className="source-download-trailing-dot absolute inset-0"
          style={{
            animationDelay: `${i * -0.1}s`,
            transform: `rotate(${i * 72}deg)`,
          }}
        >
          <span
            className="absolute left-1/2 top-0 h-1.5 w-1.5 -ml-[3px] rounded-full bg-current"
            style={{ opacity: 1 - i * 0.16 }}
          />
        </span>
      ))}
    </span>
  );
}

function condenseDescription(text: string): string {
  if (!text) return "";
  const [first, ...rest] = text.split("\n");
  const head = first.length > 90 ? first.slice(0, 90).trimEnd() + "…" : first;
  return [head, ...rest].join("\n");
}
