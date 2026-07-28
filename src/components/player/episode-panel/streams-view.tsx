import { ChevronLeft, X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { resolveAddonLogo } from "@/components/addon-logo";
import { HarborLoader } from "@/components/harbor-loader";
import { useAuth } from "@/lib/auth";
import type { Meta } from "@/lib/cinemeta";
import { useDebridClients } from "@/lib/debrid/registry";
import { useSettings } from "@/lib/settings";
import type { ScoredStream } from "@/lib/streams/types";
import { hasCachedMarker } from "@/lib/streams/cached";
import type { PlayEpisode } from "@/lib/view";
import { useAddons } from "@/views/play-picker/use-addons";
import { useAnimeAltTitles } from "@/views/play-picker/use-anime-alt-titles";
import { useImdbId } from "@/views/play-picker/use-imdb-id";
import { usePipelineResult } from "@/views/play-picker/use-pipeline-result";
import { useStreamIds } from "@/views/play-picker/use-stream-ids";
import { useT } from "@/lib/i18n";
import { AddonGroup } from "./addon-group";

export function StreamsView({
  meta,
  episode,
  onBack,
  onClose,
  onPick,
}: {
  meta: Meta;
  episode: PlayEpisode;
  onBack: () => void;
  onClose: () => void;
  onPick: (stream: ScoredStream) => void;
}) {
  const t = useT();
  const { authKey } = useAuth();
  const { settings } = useSettings();
  const debrids = useDebridClients();
  const { addons } = useAddons(authKey);
  const imdbId = useImdbId(meta, settings.tmdbKey).id;
  const streamIds = useStreamIds(meta, episode, imdbId);
  const animeTitles = useAnimeAltTitles(meta);
  const { result, loading, pipelineDone } = usePipelineResult({
    meta,
    episode,
    imdbId,
    streamIds,
    addons,
    debrids,
    settings,
    strictMode: settings.streamFilterLevel === "strict",
    filterDisabled: settings.streamFilterLevel === "off",
    animeTitles,
  });

  const isCached = useCallback(
    (s: ScoredStream) =>
      s.url != null ||
      debrids.some((d) => s.cached[d.slug] === true || s.inLibrary[d.slug] === true) ||
      hasCachedMarker(s),
    [debrids],
  );

  const groups = useMemo(() => {
    if (!result) return [];
    const byAddon = new Map<
      string,
      { addonId: string; addonName: string; addonLogo: string | null; streams: ScoredStream[] }
    >();
    for (const stream of result.picker.all) {
      const existing = byAddon.get(stream.addonId);
      if (existing) {
        existing.streams.push(stream);
        continue;
      }
      const addon = addons?.find((a) => a.manifest?.id === stream.addonId);
      byAddon.set(stream.addonId, {
        addonId: stream.addonId,
        addonName: stream.addonName ?? addon?.manifest?.name ?? stream.addonId,
        addonLogo: resolveAddonLogo(addon?.manifest?.logo, addon?.transportUrl),
        streams: [stream],
      });
    }
    const arr = [...byAddon.values()];
    arr.sort((a, b) => {
      const aCached = a.streams.filter(isCached).length;
      const bCached = b.streams.filter(isCached).length;
      if (aCached !== bCached) return bCached - aCached;
      return b.streams.length - a.streams.length;
    });
    return arr;
  }, [result, addons, isCached]);

  const totalStreams = result?.picker.all.length ?? 0;
  const epLabel = `S${episode.imdbSeason ?? episode.season} · E${String(episode.imdbEpisode ?? episode.episode).padStart(2, "0")}`;

  return (
    <>
      <header className="flex items-center gap-2 px-4 pb-4 pt-7">
        <button
          aria-label={t("Back")}
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elevated text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.32em] text-ink-subtle">
            {epLabel}
          </p>
          <h2 className="mt-0.5 truncate font-display text-[18px] font-semibold leading-tight text-ink">
            {episode.name ?? t("Episode {n}", { n: episode.episode })}
          </h2>
        </div>
        <button
          aria-label={t("Close")}
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elevated text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {loading && totalStreams === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <HarborLoader size="sm" />
            <p className="text-[12px] text-ink-subtle">{t("Searching sources…")}</p>
          </div>
        )}
        {!loading && totalStreams === 0 && pipelineDone && (
          <p className="px-2 py-10 text-center text-[13.5px] text-ink-muted">
            {t("No sources found for this episode.")}
          </p>
        )}
        {totalStreams > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between text-[11.5px] text-ink-subtle">
              <span>
                {totalStreams === 1
                  ? t("{n} source across {count} addons", { n: totalStreams, count: groups.length })
                  : t("{n} sources across {count} addons", { n: totalStreams, count: groups.length })}
              </span>
              {!pipelineDone && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  {t("loading more…")}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {groups.map((g, idx) => (
                <AddonGroup
                  key={g.addonId}
                  addonId={g.addonId}
                  addonName={g.addonName}
                  addonLogo={g.addonLogo}
                  streams={g.streams}
                  isCached={isCached}
                  defaultOpen={idx === 0}
                  onPick={onPick}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
