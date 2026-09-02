import { ChevronDown, Download, ExternalLink, Loader2, Zap } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useEffect, useMemo, useState } from "react";
import { AddonLogo, AddonLogoStack } from "@/components/addon-logo";
import { CopyLinkButton, resolveStreamLink } from "@/components/player/copy-link-button";
import { FlagStack } from "@/components/flag";
import { FormatBadge, RuleBadges } from "@/components/format-badge";
import { HostMatchChip } from "@/components/host-match-chip";
import { useT } from "@/lib/i18n";
import { useDebridClients } from "@/lib/debrid/registry";
import { useSettings } from "@/lib/settings";
import type { ScoredStream } from "@/lib/streams/types";
import type { PlayEpisode } from "@/lib/view";
import { EditionChip } from "./edition-chip";
import {
  addonInstanceKey,
  anyStreamCached,
  buildAddonOptions,
  displayTitle,
  streamSummaryParts,
  tierChipBadges,
  torrentFilename,
} from "./picker-utils";

export function SourceDrawer({
  open,
  onToggle,
  count,
  addonCount,
  usedAddons,
  streams,
  debrids,
  getAddonLogo,
  matchFor,
  onPlay,
  resolvingId,
  showName,
  episode,
  absoluteEpisode,
}: {
  open: boolean;
  onToggle: () => void;
  count: number;
  addonCount: number;
  usedAddons: Array<{ id: string; name: string; logo: string | null }>;
  streams: ScoredStream[];
  debrids: ReturnType<typeof useDebridClients>;
  getAddonLogo: (addonId: string) => string | null;
  matchFor?: (s: ScoredStream) => "same" | "close" | null;
  onPlay: (s: ScoredStream) => void;
  resolvingId: string | null;
  showName: string;
  episode?: PlayEpisode;
  absoluteEpisode?: number | null;
}) {
  const t = useT();
  const [addonFilter, setAddonFilter] = useState("all");
  const addonOptions = useMemo(() => buildAddonOptions(streams), [streams]);
  const shown = useMemo(
    () =>
      addonFilter === "all" ? streams : streams.filter((s) => addonInstanceKey(s) === addonFilter),
    [streams, addonFilter],
  );
  useEffect(() => {
    if (addonFilter !== "all" && !addonOptions.some((o) => o.id === addonFilter))
      setAddonFilter("all");
  }, [addonOptions, addonFilter]);
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="group flex w-fit items-center gap-3 rounded-full border border-edge-soft/70 bg-canvas/70 px-4 py-2 text-[11.5px] font-semibold uppercase tracking-[0.22em] text-ink-muted transition-all hover:border-edge hover:bg-canvas/90 hover:text-ink"
      >
        <ChevronDown
          size={14}
          className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
        <span>{open ? t("Hide all sources") : t("All sources")}</span>
        <span className="text-ink-subtle/80">{count}</span>
        {usedAddons.length > 0 && (
          <span className="flex items-center gap-2">
            <AddonLogoStack addons={usedAddons} size="sm" max={5} />
            <span className="text-ink-subtle/80">
              {addonCount === 1 ? t("1 addon") : t("{n} addons", { n: addonCount })}
            </span>
          </span>
        )}
      </button>
      {open && addonOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <AddonPill
            active={addonFilter === "all"}
            onClick={() => setAddonFilter("all")}
            label={t("All")}
            count={streams.length}
          />
          {addonOptions.map((o) => (
            <AddonPill
              key={o.id}
              active={addonFilter === o.id}
              onClick={() => setAddonFilter(o.id)}
              label={o.name}
              count={o.count}
            />
          ))}
        </div>
      )}
      {open && (
        <ul className="overflow-hidden rounded-2xl border border-edge-soft/60 bg-canvas/80">
          {shown.slice(0, 80).map((s, i) => (
            <SourceRow
              key={`${s.addonId}-${s.infoHash ?? s.url ?? i}`}
              stream={s}
              debrids={debrids}
              addonLogo={getAddonLogo(s.addonId)}
              match={matchFor ? matchFor(s) : null}
              onPlay={() => onPlay(s)}
              resolving={resolvingId !== null && s.infoHash === resolvingId}
              divider={i > 0}
              showName={showName}
              episode={episode}
              absoluteEpisode={absoluteEpisode}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddonPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        active
          ? "bg-ink text-canvas"
          : "bg-elevated/50 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-elevated hover:text-ink"
      }`}
    >
      <span className="max-w-[180px] truncate">{label}</span>
      <span className={active ? "text-canvas/70" : "text-ink-subtle/80"}>{count}</span>
    </button>
  );
}

function SourceRow({
  stream,
  debrids,
  addonLogo,
  match,
  onPlay,
  resolving,
  divider,
  showName,
  episode,
  absoluteEpisode,
}: {
  stream: ScoredStream;
  debrids: ReturnType<typeof useDebridClients>;
  addonLogo: string | null;
  match: "same" | "close" | null;
  onPlay: () => void;
  resolving: boolean;
  divider: boolean;
  showName: string;
  episode?: PlayEpisode;
  absoluteEpisode?: number | null;
}) {
  const t = useT();
  const { settings } = useSettings();
  const cachedDebrids = debrids.filter((d) => stream.cached[d.slug]);
  const libraryDebrids = debrids.filter((d) => stream.inLibrary[d.slug]);
  const addonCached = anyStreamCached(stream);
  const summary = streamSummaryParts(stream).map((part) =>
    stream.seeders != null && part === `${stream.seeders} seeds`
      ? t("{n} seeds", { n: stream.seeders })
      : part,
  );
  const link = resolveStreamLink(stream);
  const title = displayTitle(stream, showName, episode, absoluteEpisode);
  const fname = settings.pickerShowFilename ? torrentFilename(stream) : "";
  const contributor =
    !stream.contributors || stream.contributors.length <= 1
      ? stream.addonName
      : stream.contributors.length === 2
        ? `${stream.contributors[0].name} + ${stream.contributors[1].name}`
        : t("{name} + {n} more", {
            name: stream.contributors[0].name,
            n: stream.contributors.length - 1,
          });

  return (
    <li className={divider ? "border-t border-edge-soft/30" : ""}>
      <button
        onClick={onPlay}
        disabled={resolving}
        className="group flex w-full items-start gap-4 px-5 py-4 text-start transition-colors hover:bg-ink/5 disabled:cursor-wait disabled:opacity-60"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate font-mono text-[14px] text-ink">{title}</p>
            <EditionChip stream={stream} />
          </div>
          {fname && fname !== title && (
            <p className="min-w-0 break-all font-mono text-[11px] leading-snug text-ink-subtle/75 line-clamp-2">
              {fname}
            </p>
          )}
          <p className="flex items-center gap-2 truncate text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            <AddonLogo
              addonId={stream.addonId}
              addonName={stream.addonName}
              manifestLogo={addonLogo}
              size="sm"
            />
            <span className="truncate">
              {contributor}
              {summary.length > 0 && (
                <span className="text-ink-subtle/60"> · {summary.join(" · ")}</span>
              )}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
          <div className="flex items-center gap-3">
            {link && <CopyLinkButton url={link} />}
            <HostMatchChip match={match} />
            {stream.audioLanguages.filter((l) => l.toLowerCase() !== "unknown").length > 0 && (
              <FlagStack
                languages={stream.audioLanguages.filter((l) => l.toLowerCase() !== "unknown")}
                size="md"
                max={4}
              />
            )}
            {libraryDebrids.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
                <Zap size={12} fill="currentColor" strokeWidth={0} />
                {t("In {providers}", {
                  providers: libraryDebrids.map((d) => d.name).join(" + "),
                })}
              </span>
            ) : cachedDebrids.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                <Zap size={11} strokeWidth={2} />
                {t("Cached on {providers}", {
                  providers: cachedDebrids.map((d) => d.name).join(" + "),
                })}
              </span>
            ) : addonCached ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                <Zap size={11} strokeWidth={2} />
                {t("Cached")}
              </span>
            ) : !stream.url && !stream.infoHash && (stream.externalUrl || stream.ytId) ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                <ExternalLink size={11} strokeWidth={2.2} />
                {t("External")}
              </span>
            ) : !stream.url ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                <Download size={11} strokeWidth={2.2} />
                {debrids.length === 0 && stream.infoHash ? t("Stream") : t("Cache")}
              </span>
            ) : null}
            {resolving ? (
              <Loader2 size={16} className="animate-spin text-ink-muted" />
            ) : !stream.url && !stream.infoHash && (stream.externalUrl || stream.ytId) ? (
              <ExternalLink
                size={14}
                strokeWidth={2.2}
                className="text-ink-muted/50 transition-all group-hover:text-ink"
              />
            ) : (
              <Play
                size={15}
                fill="currentColor"
                strokeWidth={0}
                className="text-ink-muted/50 transition-all group-hover:translate-x-0.5 group-hover:text-ink"
              />
            )}
          </div>
          {tierChipBadges(stream).length > 0 && (
            <div className="flex max-w-[320px] flex-wrap items-center justify-end gap-1.5">
              {tierChipBadges(stream).map((k) => (
                <FormatBadge key={k} kind={k} size="sm" />
              ))}
              <RuleBadges stream={stream} size="sm" />
            </div>
          )}
        </div>
      </button>
    </li>
  );
}
