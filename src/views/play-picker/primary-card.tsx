import { Check, Download, ExternalLink, Loader2, Zap } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { Flag } from "@/components/flag";
import { DubSubPill, streamDubSub } from "@/components/dub-sub-pill";
import { CopyLinkButton, resolveStreamLink } from "@/components/player/copy-link-button";
import { FormatBadge, RuleBadges, streamBadges } from "@/components/format-badge";
import { HostMatchChip } from "@/components/host-match-chip";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useDebridClients } from "@/lib/debrid/registry";
import { useSettings } from "@/lib/settings";
import type { ScoredStream } from "@/lib/streams/types";
import { directStreamAvailable } from "@/lib/torrent/stremio-stream";
import type { PlayEpisode } from "@/lib/view";
import { EditionChip } from "./edition-chip";
import {
  anyStreamCached,
  confirmationLabel,
  displayTitle,
  hasUncachedMarker,
  streamSummaryParts,
  torrentFilename,
} from "./picker-utils";
import { PlayProvenance } from "./play-provenance";

export function PrimaryCard({
  meta,
  episode,
  absoluteEpisode,
  stream,
  debrids,
  addonLogo,
  onPlay,
  onCache,
  resolving,
  queued,
  inSession,
  isPreviouslyPlayed = false,
  match = null,
}: {
  meta: Meta;
  episode?: PlayEpisode;
  absoluteEpisode?: number | null;
  stream: ScoredStream;
  debrids: ReturnType<typeof useDebridClients>;
  addonLogo: string | null;
  onPlay: () => void;
  onCache: () => void;
  resolving: boolean;
  queued: boolean;
  inSession: boolean;
  isPreviouslyPlayed?: boolean;
  match?: "same" | "close" | null;
}) {
  const t = useT();
  const { settings } = useSettings();
  const cachedDebrids = debrids.filter((d) => stream.cached[d.slug]);
  const libraryDebrids = debrids.filter((d) => stream.inLibrary[d.slug]);
  const cachedDebrid = cachedDebrids[0] ?? null;
  const externalOnly = !stream.url && !stream.infoHash && !!(stream.externalUrl || stream.ytId);
  const link = resolveStreamLink(stream);
  const addonCached = anyStreamCached(stream);
  const isCached =
    (stream.url != null && !stream.infoHash && !hasUncachedMarker(stream)) ||
    cachedDebrid != null ||
    addonCached ||
    isPreviouslyPlayed;
  const queueTarget = debrids.find((d) => d.queueCache);
  const canStream = !isCached && directStreamAvailable(stream);
  const summary = streamSummaryParts(stream).map((part) =>
    stream.seeders != null && part === `${stream.seeders} seeds`
      ? t("{n} seeds", { n: stream.seeders })
      : part,
  );
  const title = displayTitle(stream, meta.name, episode, absoluteEpisode);
  const fname = settings.pickerShowFilename ? torrentFilename(stream) : "";
  const badges = settings.showQualityBadge ? streamBadges(stream) : [];
  const knownLanguages = stream.audioLanguages.filter((l) => l && l.toLowerCase() !== "unknown");
  const rawTitleConfirmation = !episode ? confirmationLabel(meta, stream) : null;
  const titleConfirmation = rawTitleConfirmation
    ?.split(" · ")
    .map((part) => {
      switch (part) {
        case "In Theatres":
          return t("In Theatres");
        case "Theatrical Capture":
          return t("Theatrical Capture");
        case "Telecine Print":
          return t("Telecine Print");
        case "Screener Copy":
          return t("Screener Copy");
        case "Disc Source":
          return t("Disc Source");
        case "Web Release":
          return t("Web Release");
        default:
          return part;
      }
    })
    .join(" · ");
  const landscapeImage = episode?.still || meta.background || null;
  const heroImage = landscapeImage || meta.poster || meta.background || null;
  const isLandscape = Boolean(landscapeImage);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-canvas/70">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/12 to-transparent" />

      <div
        className={`grid gap-7 p-7 ${isLandscape ? "grid-cols-[320px_1fr] items-center" : "grid-cols-[224px_1fr]"}`}
      >
        <div
          className={`relative overflow-hidden rounded-[16px] bg-canvas/50 ring-1 ring-edge-soft/60 ${
            isLandscape ? "aspect-video self-center" : "aspect-[2/3]"
          }`}
        >
          {heroImage ? (
            <img src={heroImage} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-canvas to-elevated" />
          )}
          {isLandscape && meta.logo && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
              />
              <img
                src={meta.logo}
                alt={meta.name}
                className="pointer-events-none absolute bottom-3 start-3.5 max-h-[26%] max-w-[58%] object-contain opacity-70 drop-shadow-[0_4px_18px_rgba(0,0,0,0.7)]"
                draggable={false}
              />
            </>
          )}
          {badges.length > 0 && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/65 via-black/20 to-transparent"
              />
              <div className="absolute inset-y-2 end-2 flex flex-col items-end gap-0.5 overflow-hidden drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]">
                {badges.map((k) => (
                  <FormatBadge key={k} kind={k} size="xs" />
                ))}
                <RuleBadges stream={stream} size="xs" />
              </div>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-6">
          <div className="flex flex-col gap-4">
            {knownLanguages.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {knownLanguages.slice(0, 6).map((lang) => (
                  <Flag key={lang} language={lang} size="lg" />
                ))}
                {settings.showDubBadge &&
                  (() => {
                    const d = streamDubSub(
                      stream.audioLanguages,
                      /^(kitsu|mal|anilist|anidb|simkl):/.test(meta.id),
                    );
                    return d ? <DubSubPill kind={d} size="md" /> : null;
                  })()}
                {knownLanguages.length > 6 && (
                  <span className="text-[13px] font-semibold tracking-[0.04em] text-ink-subtle">
                    {t("+{n} more", { n: knownLanguages.length - 6 })}
                  </span>
                )}
              </div>
            ) : (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-edge-soft/70 bg-canvas/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                {t("Audio not labeled")}
              </span>
            )}
            {titleConfirmation && (
              <p className="text-[12px] font-bold uppercase tracking-[0.28em] text-ink-subtle">
                {titleConfirmation}
              </p>
            )}
            <HostMatchChip match={match} long />
            <p className="break-all font-mono text-[15.5px] leading-relaxed text-ink">{title}</p>
            {fname && fname !== title && (
              <p className="break-all font-mono text-[12.5px] leading-relaxed text-ink-subtle/80">
                {fname}
              </p>
            )}

            {summary.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                {summary.map((part, i) => (
                  <span key={`${part}-${i}`} className="flex items-center gap-3">
                    {i > 0 && (
                      <span aria-hidden className="h-1 w-1 rounded-full bg-ink-subtle/40" />
                    )}
                    <span>{part}</span>
                  </span>
                ))}
              </div>
            )}

            {(cachedDebrid ||
              addonCached ||
              queued ||
              (debrids.length > 0 && !stream.url) ||
              stream.remux ||
              stream.releaseGroupNormalized ||
              stream.edition) && (
              <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                {libraryDebrids.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold tracking-[0.04em] text-accent">
                    <Zap size={13} fill="currentColor" strokeWidth={0} />
                    {t("In your {providers} library", {
                      providers: libraryDebrids.map((d) => d.name).join(" + "),
                    })}
                  </span>
                ) : cachedDebrids.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold tracking-[0.04em] text-ink-muted">
                    <Zap size={13} fill="currentColor" strokeWidth={0} />
                    {t("Cached on {providers}", {
                      providers: cachedDebrids.map((d) => d.name).join(" + "),
                    })}
                  </span>
                ) : addonCached ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold tracking-[0.04em] text-ink-muted">
                    <Zap size={13} fill="currentColor" strokeWidth={0} />
                    {t("Cached")}
                  </span>
                ) : queued ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold tracking-[0.04em] text-emerald-300">
                    <Check size={13} strokeWidth={2.5} />
                    {t("Queued on {provider}", { provider: queueTarget?.name ?? t("debrid") })}
                  </span>
                ) : debrids.length > 0 && !stream.url ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium tracking-[0.04em] text-ink-subtle">
                    <Download size={12} strokeWidth={2.2} />
                    {t("Not cached yet")}
                  </span>
                ) : null}
                {stream.remux && (
                  <span className="inline-flex h-[26px] items-center rounded-full bg-canvas/95 px-2.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-ink ring-1 ring-edge">
                    REMUX
                  </span>
                )}
                {stream.releaseGroupNormalized && (
                  <span className="inline-flex h-[26px] items-center rounded-full bg-canvas/45 px-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted ring-1 ring-edge-soft">
                    {stream.releaseGroupNormalized}
                  </span>
                )}
                <EditionChip stream={stream} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-5">
            {externalOnly ? (
              <button
                onClick={onPlay}
                className="group flex h-14 items-center gap-3 rounded-full border border-ink/30 bg-ink/[0.04] px-7 text-[14.5px] font-semibold tracking-[0.04em] text-ink transition-[transform,background-color,opacity] duration-200 hover:scale-[1.02] hover:bg-ink/[0.08] active:scale-[0.98]"
              >
                <ExternalLink size={18} strokeWidth={2.2} />
                {t("Open in browser")}
              </button>
            ) : isCached ? (
              <button
                onClick={onPlay}
                disabled={resolving}
                className="group flex h-14 items-center gap-3 rounded-full bg-ink px-9 text-[15px] font-semibold tracking-[0.04em] text-canvas shadow-[0_12px_36px_rgba(0,0,0,0.45)] transition-[transform,opacity] duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              >
                {resolving ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Play
                    size={20}
                    fill="currentColor"
                    strokeWidth={0}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                )}
                {resolving ? t("Connecting") : inSession ? t("Play Together") : t("Play")}
              </button>
            ) : queued ? (
              <button
                disabled
                className="flex h-14 items-center gap-3 rounded-full bg-emerald-400/15 px-7 text-[14px] font-semibold tracking-[0.04em] text-emerald-300 ring-1 ring-emerald-400/40"
              >
                <Check size={18} strokeWidth={2.5} />
                {t("Queued on {provider}", { provider: queueTarget?.name ?? t("debrid") })}
              </button>
            ) : queueTarget ? (
              <button
                onClick={onCache}
                disabled={resolving}
                className="group flex h-14 items-center gap-3 rounded-full border border-accent/55 bg-accent/12 px-7 text-[14.5px] font-semibold tracking-[0.04em] text-accent transition-[transform,background-color,opacity] duration-200 hover:scale-[1.02] hover:bg-accent/20 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              >
                {resolving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} strokeWidth={2.4} />
                )}
                {resolving
                  ? t("Sending to {provider}", { provider: queueTarget.name })
                  : t("Cache on {provider}", { provider: queueTarget.name })}
              </button>
            ) : canStream ? (
              <button
                onClick={onPlay}
                disabled={resolving}
                className="group flex h-14 items-center gap-3 rounded-full bg-ink px-9 text-[15px] font-semibold tracking-[0.04em] text-canvas shadow-[0_12px_36px_rgba(0,0,0,0.45)] transition-[transform,opacity] duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              >
                {resolving ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Play
                    size={20}
                    fill="currentColor"
                    strokeWidth={0}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                )}
                {resolving ? t("Connecting") : inSession ? t("Stream Together") : t("Stream")}
              </button>
            ) : (
              <button
                disabled
                className="flex h-14 items-center gap-3 rounded-full bg-canvas/60 px-7 text-[14px] font-semibold tracking-[0.04em] text-ink-subtle ring-1 ring-edge-soft"
              >
                {t("Not cached")}
              </button>
            )}
            <PlayProvenance
              stream={stream}
              debrids={debrids}
              isCached={isCached}
              addonLogo={addonLogo}
            />
            {link && (
              <CopyLinkButton url={link} size={15} className="h-9 w-9 ring-1 ring-edge-soft/60" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
