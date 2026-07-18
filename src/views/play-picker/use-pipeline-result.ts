import { useCallback, useEffect, useMemo, useState } from "react";
import type { Addon } from "@/lib/addons";
import type { Meta } from "@/lib/cinemeta";
import { useDebridClients } from "@/lib/debrid/registry";
import {
  buildPickerConfigHash,
  clearOnePickerCache,
  getPickerCache,
  setPickerCache,
} from "@/lib/picker-cache";
import { useSettings } from "@/lib/settings";
import { runPipeline, type PipelineResult } from "@/lib/streams/pipeline";
import { buildEpisodePipelineInput } from "@/lib/streams/episode-pipeline-input";
import type { PlayEpisode } from "@/lib/view";
import { stampAddonOrder } from "./picker-utils";

type Settings = ReturnType<typeof useSettings>["settings"];

export function usePipelineResult({
  meta,
  episode,
  imdbId,
  streamIds,
  addons,
  debrids,
  settings,
  strictMode,
  filterDisabled,
}: {
  meta: Meta;
  episode: PlayEpisode | undefined;
  imdbId: string | null;
  streamIds: string[] | null;
  addons: Addon[] | null;
  debrids: ReturnType<typeof useDebridClients>;
  settings: Settings;
  strictMode: boolean;
  filterDisabled: boolean;
}) {
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipelineDone, setPipelineDone] = useState(false);
  const [firstResultAt, setFirstResultAt] = useState<number | null>(null);
  const [autoSettleReady, setAutoSettleReady] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const configHash = useMemo(
    () =>
      buildPickerConfigHash({
        addonTransportUrls: (addons ?? []).map((a) => a.transportUrl),
        debridSlugs: debrids.map((d) => d.slug),
        scraperKeys: [],
        filterMode: filterDisabled ? "off" : strictMode ? "strict" : "balanced",
      }),
    [addons, debrids, filterDisabled, strictMode],
  );

  useEffect(() => {
    if (!streamIds || addons === null) return;
    const ac = new AbortController();
    const cached = getPickerCache(meta, episode, configHash);
    if (cached && cached.complete) {
      setResult({ ...cached.result, raw: { addon: [], library: [] } });
      setLoading(false);
      setPipelineDone(true);
      setFirstResultAt(performance.now());
      setAutoSettleReady(true);
      setResolveError(null);
      return () => ac.abort();
    }
    setLoading(true);
    setResult(null);
    setResolveError(null);
    setPipelineDone(false);
    setFirstResultAt(null);
    setAutoSettleReady(false);
    runPipeline(
      buildEpisodePipelineInput({
        meta,
        episode,
        imdbId,
        streamIds,
        addons,
        debrids,
        settings,
        strictMode,
        filterDisabled,
      }),
      ac.signal,
      (partial) => {
        if (ac.signal.aborted) return;
        if (partial.picker.all.length === 0) return;
        stampAddonOrder(partial.picker.all, partial.raw.addon);
        setResult(partial);
        setLoading(false);
        setFirstResultAt((prev) => prev ?? performance.now());
        setPickerCache(meta, episode, partial, configHash, false);
      },
    )
      .then((r) => {
        if (ac.signal.aborted) return;
        stampAddonOrder(r.picker.all, r.raw.addon);
        setResult(r);
        setLoading(false);
        setPipelineDone(true);
        setAutoSettleReady(true);
        setPickerCache(meta, episode, r, configHash);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setResolveError(
          e instanceof Error
            ? e.message
            : "Couldn't load streams. Check your addons and connection.",
        );
        setLoading(false);
        setPipelineDone(true);
        setAutoSettleReady(true);
      });
    return () => ac.abort();
  }, [
    streamIds,
    imdbId,
    addons,
    debrids,
    meta.id,
    meta.name,
    meta.type,
    meta.releaseInfo,
    episode?.season,
    episode?.episode,
    episode?.videoId,
    settings.preferredLanguages,
    settings.requirePreferredLanguage,
    strictMode,
    filterDisabled,
    refreshNonce,
  ]);

  const refresh = useCallback(() => {
    clearOnePickerCache(meta, episode);
    setRefreshNonce((n) => n + 1);
  }, [meta, episode]);

  return {
    result,
    loading,
    pipelineDone,
    firstResultAt,
    autoSettleReady,
    resolveError,
    refresh,
    setResult,
    setLoading,
    setPipelineDone,
    setFirstResultAt,
    setAutoSettleReady,
    setResolveError,
  };
}
