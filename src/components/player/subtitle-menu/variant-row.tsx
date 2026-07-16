import { Check, Sparkles } from "lucide-react";
import type { TrackInfo } from "@/lib/player/bridge";
import { useContextMenu } from "@/lib/context-menu";
import { isImageSubTrack } from "@/lib/player/sub-format";
import { subtitleTrackLanguageLabel, subtitleTrackTitle } from "@/lib/subtitles/track-label";
import { saveSubtitleToDisk } from "@/lib/subtitles/save-to-disk";
import { useImportedSubs } from "@/lib/player/imported-subs";
import { useT } from "@/lib/i18n";

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
  selected,
  onPick,
}: {
  track: TrackInfo;
  selected: boolean;
  onPick: () => void;
}) {
  const tr = useT();
  const { open } = useContextMenu();
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
  const release = pickReleaseHint(track);
  const titleText = subtitleTrackTitle(track);
  const langName = subtitleTrackLanguageLabel(track);

  return (
    <button
      onClick={onPick}
      onContextMenu={(e) =>
        open(e, {
          kind: "subtitle",
          label: titleText,
          download: track.url
            ? () =>
                saveSubtitleToDisk(track.url!, {
                  title: track.title || titleText,
                  lang: track.lang,
                  format: subExt(track),
                  label: tr("Subtitle"),
                })
            : undefined,
        })
      }
      className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors ${
        selected
          ? "bg-elevated ring-1 ring-edge"
          : isImported
            ? "bg-accent/[0.07] ring-1 ring-accent/30 hover:bg-accent/10"
            : "hover:bg-canvas/55"
      }`}
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
          <p className="truncate text-[12.5px] font-medium leading-snug text-ink">{titleText}</p>
          {isImported && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.12em] text-accent ring-1 ring-accent/30">
              <Sparkles size={9} strokeWidth={2.6} />
              {tr("Yours")}
            </span>
          )}
        </div>
        {release && (
          <p className="truncate font-mono text-[10.5px] leading-snug text-ink-muted">{release}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] text-ink-subtle">
          <span className="font-semibold uppercase tracking-[0.1em]">{langName}</span>
          <span aria-hidden>·</span>
          <span className={isImported ? "font-semibold text-accent" : ""}>{sourceLabel}</span>
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
  );
}

function pickReleaseHint(track: TrackInfo): string | null {
  const t = track.title;
  if (!t) return null;
  const trimmed = t.trim();
  if (!trimmed) return null;
  if (/\.(srt|vtt|ass|ssa|sub)$/i.test(trimmed)) return trimmed;
  if (/[-.][A-Z0-9]{2,}/.test(trimmed)) return trimmed;
  if (trimmed.length > 24) return trimmed;
  return null;
}
