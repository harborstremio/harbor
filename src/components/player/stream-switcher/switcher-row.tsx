import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { AddonLogo } from "@/components/addon-logo";
import { CopyLinkButton, resolveStreamLink } from "@/components/player/copy-link-button";
import { FlagStack } from "@/components/flag";
import { FormatBadge, RuleBadges, streamBadges } from "@/components/format-badge";
import type { ScoredStream } from "@/lib/streams/types";
import { useT } from "@/lib/i18n";

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
  return s.replace(FLAG_EMOJI_RX, "").replace(/\s{2,}/g, " ").trim();
}

function Equalizer() {
  const bars = ["h-1.5", "h-2.5", "h-2"];
  return (
    <span className="flex items-center gap-[2px]" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-[2.5px] rounded-full bg-accent motion-safe:animate-pulse ${h}`}
          style={{ animationDelay: `${i * 160}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  );
}

export function SwitcherRow({
  stream,
  addonLogo,
  onPick,
  resolving,
  isCurrent,
  match,
}: {
  stream: ScoredStream;
  addonLogo: string | null;
  onPick: () => void;
  resolving: boolean;
  isCurrent: boolean;
  match?: "same" | "close" | null;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  const addonName = stream.addonName ?? t("Source");
  const headline = stripFlagEmoji(stream.name?.trim() || addonName) || addonName;
  const description = stripFlagEmoji(stream.title?.trim() || stream.description?.trim() || "");
  const badges = streamBadges(stream);
  const anchor = badges[0];
  const secondary = badges.slice(1);
  const langs = stream.audioLanguages ?? [];
  const link = resolveStreamLink(stream);
  const filterReason = stream.reasons?.find((r) => r.signal.startsWith("filtered:"))?.signal.slice(9);
  const interactive = !isCurrent && !resolving;

  useLayoutEffect(() => {
    if (expanded) return;
    const el = descRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [description, expanded]);

  return (
    <li>
      <div
        role="button"
        tabIndex={interactive ? 0 : -1}
        onClick={interactive ? onPick : undefined}
        onKeyDown={(e) => {
          if (!interactive) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPick();
          }
        }}
        className={`group relative flex w-full items-start gap-3.5 px-5 py-3.5 text-start transition-colors focus-visible:outline-none ${
          isCurrent
            ? "cursor-default bg-accent-soft/40"
            : resolving
              ? "cursor-wait opacity-60"
              : "cursor-pointer hover:bg-canvas/50 focus-visible:bg-canvas/50"
        }`}
      >
        {isCurrent && <span className="absolute inset-y-2 start-0 w-[3px] rounded-e-full bg-accent" />}
        <AddonLogo addonId={stream.addonId} addonName={addonName} manifestLogo={addonLogo} size="xl" />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-[14px] font-semibold leading-snug text-ink">{headline}</p>
          {description && (
            <p
              ref={descRef}
              className={`whitespace-pre-line text-[12.5px] leading-snug text-ink-muted ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {description}
            </p>
          )}
          {overflows && description && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="mt-0.5 inline-flex w-fit items-center gap-1 text-[11.5px] font-semibold text-ink-subtle transition-colors hover:text-ink"
            >
              {expanded ? t("Show less") : t("Show more")}
              <ChevronDown
                size={12}
                strokeWidth={2.4}
                className={`transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
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
                match === "same" ? "bg-accent-soft text-accent ring-accent/30" : "bg-raised text-ink-muted ring-edge-soft"
              }`}
            >
              {match === "same" ? t("Same file") : t("Close match")}
            </span>
          )}
          {!isCurrent && langs.length > 0 && <FlagStack languages={langs} size="sm" max={3} />}
          {!isCurrent && anchor && (
            <span className="flex items-center gap-1.5">
              <FormatBadge kind={anchor} size="sm" />
              <RuleBadges stream={stream} size="sm" />
              {secondary.length > 0 && (
                <span className="flex items-center gap-1 opacity-65 grayscale transition-[filter,opacity] duration-200 group-hover:opacity-100 group-hover:grayscale-0 motion-reduce:transition-none">
                  {secondary.map((b) => (
                    <FormatBadge key={b} kind={b} size="xs" />
                  ))}
                </span>
              )}
            </span>
          )}
          {isCurrent && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
              <Equalizer />
              {t("Now Playing")}
            </span>
          )}
          {resolving ? (
            <Loader2 size={13} className="animate-spin text-ink-muted" />
          ) : (
            link && (
              <span onClick={(e) => e.stopPropagation()}>
                <CopyLinkButton url={link} />
              </span>
            )
          )}
        </div>
      </div>
    </li>
  );
}
