import { AddonLogo } from "@/components/addon-logo";
import { FlagStack } from "@/components/flag";
import { FormatBadge, streamBadges } from "@/components/format-badge";
import { CopyLinkButton, resolveStreamLink } from "@/components/player/copy-link-button";
import { useT } from "@/lib/i18n";
import type { ScoredStream } from "@/lib/streams/types";
import { Loader2, Zap } from "lucide-react";

export function streamKey(s: ScoredStream): string {
  return s.infoHash ?? s.url ?? `${s.addonId}:${s.title ?? ""}`;
}

export function isCurrentStream(
  s: ScoredStream,
  currentUrl: string,
  currentInfoHash?: string | null,
  currentFileIdx?: number | null,
): boolean {
  if (currentInfoHash && s.infoHash && s.infoHash.toLowerCase() === currentInfoHash.toLowerCase()) {
    if (s.fileIdx != null && currentFileIdx != null) return s.fileIdx === currentFileIdx;
    return true;
  }
  return s.url != null && s.url === currentUrl;
}

const FLAG_EMOJI_RX = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
function stripFlagEmoji(s: string): string {
  return s
    .replace(FLAG_EMOJI_RX, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function SwitcherRow({
  stream,
  addonLogo,
  onPick,
  resolving,
  divider,
  isCurrent,
  match,
}: {
  stream: ScoredStream;
  addonLogo: string | null;
  onPick: () => void;
  resolving: boolean;
  divider: boolean;
  isCurrent: boolean;
  match?: "same" | "close" | null;
}) {
  const t = useT();
  const addonName = stream.addonName ?? t("Source");
  const headline = stripFlagEmoji(stream.name?.trim() || addonName) || addonName;
  const description = stripFlagEmoji(stream.title?.trim() || stream.description?.trim() || "");
  const cornerBadges = streamBadges(stream);
  const langs = stream.audioLanguages ?? [];
  const link = resolveStreamLink(stream);
  const filterReason = stream.reasons?.find((r) => r.signal.startsWith("filtered:"))?.signal.slice(9);

  return (
    <li className={divider ? "border-t border-edge-soft/60" : ""}>
      <button
        onClick={onPick}
        disabled={resolving || isCurrent}
        className={`group flex w-full items-center gap-3.5 px-5 py-3 text-start transition-colors ${
          isCurrent ? "cursor-default bg-canvas/40" : "hover:bg-canvas/55 disabled:cursor-wait disabled:opacity-60"
        }`}
      >
        <AddonLogo addonId={stream.addonId} addonName={addonName} manifestLogo={addonLogo} size="xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="whitespace-pre-line text-[14px] font-semibold leading-snug text-ink">{headline}</p>
          {description && (
            <p className="whitespace-pre-line text-[12.5px] leading-snug text-ink-muted">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {filterReason && (
            <span
              title={t("Hidden by filter: {reason}", { reason: filterReason })}
              className="rounded-md bg-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-danger ring-1 ring-danger/30"
            >
              {t("Filtered")}
            </span>
          )}
          {match && !isCurrent && (
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ring-1 ${
                match === "same" ? "bg-accent/15 text-accent ring-accent/30" : "bg-raised text-ink-muted ring-edge-soft"
              }`}
            >
              {match === "same" ? t("Same file") : t("Close match")}
            </span>
          )}
          {langs.length > 0 && !isCurrent && <FlagStack languages={langs} size="sm" max={3} />}
          {cornerBadges.length > 0 && !isCurrent && (
            <span className="flex items-center gap-1">
              {cornerBadges.map((b) => (
                <FormatBadge key={b} kind={b} size="sm" />
              ))}
            </span>
          )}
          {isCurrent && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink ring-1 ring-edge">
              <Zap size={9} fill="currentColor" strokeWidth={0} />
              {t("Now Playing")}
            </span>
          )}
          {link && !resolving && <CopyLinkButton url={link} />}
          {resolving && <Loader2 size={13} className="animate-spin text-ink-muted" />}
        </div>
      </button>
    </li>
  );
}
