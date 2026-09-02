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
import type { AddonProgress } from "@/lib/streams/addons";
import { runPipeline, type PipelineResult } from "@/lib/streams/pipeline";
import { buildEpisodePipelineInput } from "@/lib/streams/episode-pipeline-input";
import type { PlayEpisode } from "@/lib/view";
import {
  pickerErrorTransport,
  pipelineError,
  stampAddonOrder,
  type PickerError,
} from "./picker-utils";

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
  animeTitles,
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
  animeTitles: string[] | null;
}) {
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipelineDone, setPipelineDone] = useState(false);
  const [firstResultAt, setFirstResultAt] = useState<number | null>(null);
  const [autoSettleReady, setAutoSettleReady] = useState(false);
  const [pickerError, setResolveError] = useState<PickerError | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [addonQuorum, setAddonQuorum] = useState<AddonProgress>({
    settled: 0,
    total: 0,
    queriedAddonIds: [],
    settledAddonIds: [],
  });
  const [pipelineStartedAt, setPipelineStartedAt] = useState<number | null>(null);

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
      setAddonQuorum({
        settled: 1,
        total: 1,
        queriedAddonIds: [],
        settledAddonIds: [],
      });
      setPipelineStartedAt(performance.now());
      return () => ac.abort();
    }
    setLoading(true);
    setResult(null);
    setResolveError(null);
    setPipelineDone(false);
    setFirstResultAt(null);
    setAutoSettleReady(false);
    setAddonQuorum({
      settled: 0,
      total: 0,
      queriedAddonIds: [],
      settledAddonIds: [],
    });
    setPipelineStartedAt(performance.now());
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
        animeTitles,
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
      (progress) => {
        if (ac.signal.aborted) return;
        setAddonQuorum(progress);
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
        setResolveError(pipelineError(e instanceof Error ? e.message : undefined));
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
    (animeTitles ?? []).join("|"),
    refreshNonce,
  ]);

  const refresh = useCallback(() => {
    clearOnePickerCache(meta, episode);
    setRefreshNonce((n) => n + 1);
  }, [meta, episode]);
  const resolveError = pickerErrorTransport(pickerError);

  return {
    result,
    loading,
    pipelineDone,
    firstResultAt,
    autoSettleReady,
    addonQuorum,
    pipelineStartedAt,
    resolveError,
    pickerError,
    refresh,
    setResult,
    setLoading,
    setPipelineDone,
    setFirstResultAt,
    setAutoSettleReady,
    setResolveError,
  };
}
