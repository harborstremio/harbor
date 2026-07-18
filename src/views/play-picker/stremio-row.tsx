import { ArrowDownToLine, Play } from "lucide-react";
import { AddonLogo } from "@/components/addon-logo";
import { CopyLinkButton, resolveStreamLink } from "@/components/player/copy-link-button";
import { DubSubPill, streamDubSub } from "@/components/dub-sub-pill";
import { FormatBadge, streamBadges } from "@/components/format-badge";
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
  isAnime = false,
}: {
  stream: ScoredStream;
  failed: boolean;
  addonLogo: string | null;
  match?: "same" | "close" | null;
  onPlay: () => void;
  download?: boolean;
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
        <p className="whitespace-pre-line text-[16px] font-semibold leading-snug text-ink">
          {headline}
        </p>
        {description && (
          <p
            className={`whitespace-pre-line text-[14.5px] leading-snug text-ink-muted${full ? "" : " line-clamp-3"}`}
          >
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
            <EditionChip stream={stream} />
          </div>
        )}
        {failed && <p className="text-[13px] font-medium text-danger">Unavailable, try another.</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center">
        {link && <CopyLinkButton url={link} size={16} className="h-9 w-9" />}
        <button
          onClick={onPlay}
          aria-label={download ? "Download" : "Play"}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-canvas shadow-[0_2px_6px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.18)] transition-[transform,box-shadow] duration-150 ease-out hover:shadow-[0_5px_14px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.18)] active:scale-[0.96] active:duration-100"
        >
          {download ? (
            <ArrowDownToLine size={25} strokeWidth={2.4} />
          ) : (
            <Play size={26} fill="currentColor" className="ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function condenseDescription(text: string): string {
  if (!text) return "";
  const [first, ...rest] = text.split("\n");
  const head = first.length > 90 ? first.slice(0, 90).trimEnd() + "…" : first;
  return [head, ...rest].join("\n");
}
