import { Check, Crosshair, Info, Languages, Sparkles } from "lucide-react";
import type { TrackInfo } from "@/lib/player/bridge";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useContextMenu, type ContextMenuTarget } from "@/lib/context-menu";
import { isImageSubTrack } from "@/lib/player/sub-format";
import { subtitleReleaseLabel } from "@/lib/subtitles/release-label";
import { subtitleTrackLanguageLabel, subtitleTrackTitle } from "@/lib/subtitles/track-label";
import { saveSubtitleToDisk } from "@/lib/subtitles/save-to-disk";
import { useImportedSubs } from "@/lib/player/imported-subs";
import { useT } from "@/lib/i18n";
import { parseRelease } from "@/lib/subtitles/release-match";
import { OverflowMarquee } from "./overflow-marquee";

function subExt(track: TrackInfo): string {
  const fromName = track.externalFilename?.match(/\.([a-z0-9]+)$/i)?.[1];
  if (fromName) return fromName;
  const c = track.codec?.toLowerCase() ?? "";
  if (c.includes("ass") || c.includes("ssa")) return "ass";
  if (c.includes("vtt") || c.includes("webvtt")) return "vtt";
  return "srt";
}

export function VariantRow({
  track,
  rank,
  compatibilityPercent,
  matchReasons,
  selected,
  onPick,
  isSecondary,
  onPickSecondary,
}: {
  track: TrackInfo;
  rank: number;
  compatibilityPercent?: number;
  matchReasons?: string[];
  selected: boolean;
  onPick: () => void;
  isSecondary?: boolean;
  onPickSecondary?: () => void;
}) {
  const tr = useT();
  const { openAt } = useContextMenu();
  const imported = useImportedSubs();
  const isImported = !!track.title && imported.has(track.title);
  const tags: { label: string; tone: "warn" | "info" | "default" }[] = [];
  if (track.forced) tags.push({ label: tr("Forced"), tone: "info" });
  if (track.hearingImpaired) tags.push({ label: tr("HI/SDH"), tone: "warn" });
  if (track.default) tags.push({ label: tr("Default"), tone: "default" });
  if (isImageSubTrack(track)) tags.push({ label: tr("Position and size only"), tone: "warn" });
  const sourceLabel = isImported
    ? tr("Imported")
    : track.external
      ? tr("External")
      : tr("Embedded");
  const codec = track.codec?.toUpperCase();
  const realRelease = track.release?.trim();
  const releaseLabel = subtitleReleaseLabel(realRelease);
  const titleText = releaseLabel || realRelease || subtitleTrackTitle(track);
  const provider = track.provider?.trim();
  const detailSource = provider && provider !== titleText ? provider : sourceLabel;
  const langName = subtitleTrackLanguageLabel(track);
  const isSynced = track.external === true && /^Synced \((?:SRT|VTT)\)/i.test(track.title ?? "");
  const isBestMatch =
    track.external === true &&
    (track.matchConfidence === "exact" ||
      track.matchConfidence === "high" ||
      (track.matchConfidence == null && (track.matchScore ?? 0) >= 120));
  const releaseTags = parseRelease(`${realRelease ?? ""} ${track.title ?? ""}`);
  const quality = [
    releaseTags.resolution,
    releaseTags.source?.toUpperCase(),
    ...releaseTags.hdr.map((tag) => tag.toUpperCase()),
  ]
    .filter(Boolean)
    .join(" · ");
  const flags = tags.map((tag) => tag.label);
  const contextTarget: ContextMenuTarget = {
    kind: "subtitle",
    label: titleText,
    details: {
      language: langName,
      source: sourceLabel,
      provider,
      format: subExt(track).toUpperCase(),
      fps: track.fps,
      quality: quality || undefined,
      release: realRelease,
      author: track.author,
      downloads: track.downloads,
      compatibilityPercent,
      matchReasons: matchReasons?.length ? matchReasons : track.matchReasons,
      flags,
    },
    download: track.url
      ? () =>
          saveSubtitleToDisk(track.url!, {
            title: track.title || titleText,
            lang: track.lang,
            format: subExt(track),
            label: tr("Subtitle"),
          })
      : undefined,
  };

  return (
    <div
      data-subtitle-row
      className={`group/row flex items-stretch rounded-lg transition-colors ${
        selected
          ? "bg-elevated ring-1 ring-edge"
          : isSecondary
            ? "bg-accent/[0.06] ring-1 ring-accent/25"
            : isImported
              ? "bg-accent/[0.07] ring-1 ring-accent/30 hover:bg-accent/10"
              : "hover:bg-canvas/55"
      }`}
    >
      <button
        type="button"
        onClick={onPick}
        className="flex min-w-0 flex-1 items-start gap-2.5 px-2.5 py-2 text-start"
      >
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
            selected ? "bg-accent text-canvas" : "bg-raised text-ink-subtle"
          }`}
          aria-hidden
        >
          {selected ? <Check size={9} strokeWidth={3} /> : null}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <OverflowMarquee
              text={titleText}
              title={realRelease && releaseLabel ? realRelease : undefined}
            />
            {isImported && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.12em] text-accent ring-1 ring-accent/30">
                <Sparkles size={9} strokeWidth={2.6} />
                {tr("Yours")}
              </span>
            )}
            {!isImported && (isSynced || isBestMatch) && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.12em] text-accent ring-1 ring-accent/30">
                <Crosshair size={9} strokeWidth={2.6} />
                {isSynced ? tr("Synced") : tr("Best match")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] text-ink-subtle">
            <span className="font-semibold uppercase tracking-[0.1em]">{langName}</span>
            <span aria-hidden>·</span>
            <span className={isImported ? "font-semibold text-accent" : ""}>{detailSource}</span>
            {codec && (
              <>
                <span aria-hidden>·</span>
                <span>{codec}</span>
              </>
            )}
            {tags.map((t) => (
              <span
                key={t.label}
                className={`rounded px-1 py-px text-[9.5px] font-bold uppercase tracking-[0.1em] ${
                  t.tone === "warn"
                    ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30"
                    : t.tone === "info"
                      ? "bg-sky-400/15 text-sky-200 ring-1 ring-sky-400/30"
                      : "bg-raised text-ink-muted ring-1 ring-edge-soft"
                }`}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </button>
      {onPickSecondary && !selected && (
        <HoverTooltip
          label={
            isSecondary ? tr("Stop showing as second subtitle") : tr("Show as second subtitle")
          }
          align="end"
        >
          <button
            type="button"
            onClick={onPickSecondary}
            aria-pressed={isSecondary}
            className={`my-1 me-1 flex shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-opacity ${
              isSecondary
                ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                : "text-ink-subtle opacity-0 hover:text-ink focus-visible:opacity-100 group-hover/row:opacity-100"
            }`}
          >
            <Languages size={11} strokeWidth={2.4} />
            {tr("2nd")}
          </button>
        </HoverTooltip>
      )}
      <button
        type="button"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          openAt({ x: rect.right, y: rect.bottom }, contextTarget);
        }}
        title={
          compatibilityPercent == null
            ? `${tr("Match estimate")}: ${tr("Unknown")}`
            : `${tr("Match estimate")}: ${compatibilityPercent}%`
        }
        aria-label={
          compatibilityPercent == null
            ? `${rank}, ${tr("Match estimate")} ${tr("Unknown")}`
            : `${rank}, ${tr("Match estimate")} ${compatibilityPercent}%`
        }
        className="flex w-20 shrink-0 items-center justify-end gap-1.5 rounded-e-lg pe-2 text-[10.5px] font-medium tabular-nums outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <span aria-hidden className={selected ? "text-accent" : "text-ink-muted"}>
          {rank}
        </span>
        {compatibilityPercent != null && (
          <span
            aria-hidden
            className={
              compatibilityPercent >= 90
                ? "text-accent"
                : compatibilityPercent >= 70
                  ? "text-ink"
                  : "text-ink-subtle"
            }
          >
            {compatibilityPercent}%
          </span>
        )}
        {compatibilityPercent == null && (
          <span aria-hidden className="text-ink-subtle">
            —
          </span>
        )}
        <Info
          aria-hidden
          size={11}
          className="text-ink-subtle opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100"
        />
      </button>
    </div>
  );
}
