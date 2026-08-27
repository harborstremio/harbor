import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDebridClients } from "@/lib/debrid/registry";
import { useSettings } from "@/lib/settings";
import { buildStreamIdsWithIdentity } from "@/lib/streams/anime-identity";
import { buildEpisodePipelineInput } from "@/lib/streams/episode-pipeline-input";
import { runPipeline } from "@/lib/streams/pipeline";
import { buildPickerConfigHash, peekPickerCache, setPickerCache } from "@/lib/picker-cache";
import { useAddons } from "@/views/play-picker/use-addons";
import { stampAddonOrder } from "@/views/play-picker/picker-utils";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";

export function useSwitcherRefresh(params: {
  meta: Meta;
  episode: PlayEpisode | undefined;
  imdbId: string | null;
  active: boolean;
}) {
  const { meta, episode, imdbId, active } = params;
  const { authKey } = useAuth();
  const { settings } = useSettings();
  const debrids = useDebridClients();
  const { addons } = useAddons(authKey, settings);
  const [refreshing, setRefreshing] = useState(false);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => () => acRef.current?.abort(), []);

  const refresh = useCallback(async () => {
    if (!addons) return;
    const streamIds = await buildStreamIdsWithIdentity(
      meta.id,
      episode,
      imdbId,
      meta.behaviorHints?.defaultVideoId,
    );
    if (streamIds.length === 0) return;
    const strictMode = settings.streamFilterLevel === "strict";
    const filterDisabled = settings.streamFilterLevel === "off";
    const configHash = buildPickerConfigHash({
      addonTransportUrls: addons.map((a) => a.transportUrl),
      debridSlugs: debrids.map((d) => d.slug),
      scraperKeys: [],
      filterMode: filterDisabled ? "off" : strictMode ? "strict" : "balanced",
    });
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    setRefreshing(true);
    try {
      const input = buildEpisodePipelineInput({
        meta,
        episode,
        imdbId,
        streamIds,
        addons,
        debrids,
        settings,
        strictMode,
        filterDisabled,
      });
      const result = await runPipeline(input, ac.signal, (partial) => {
        if (ac.signal.aborted || partial.picker.all.length === 0) return;
        stampAddonOrder(partial.picker.all, partial.raw.addon);
        setPickerCache(meta, episode, partial, configHash, false);
      });
      if (ac.signal.aborted) return;
      stampAddonOrder(result.picker.all, result.raw.addon);
      setPickerCache(meta, episode, result, configHash);
    } catch {
      // keep the existing cache on failure
    } finally {
      if (!ac.signal.aborted) setRefreshing(false);
    }
  }, [addons, debrids, meta, episode, imdbId, settings]);

  const autoFilledRef = useRef(false);
  useEffect(() => {
    if (!active) {
      autoFilledRef.current = false;
      return;
    }
    if (autoFilledRef.current || !addons) return;
    if (peekPickerCache(meta, episode)?.complete) return;
    autoFilledRef.current = true;
    void refresh();
  }, [active, addons, meta, episode, refresh]);

  return { refreshing, refresh };
}
