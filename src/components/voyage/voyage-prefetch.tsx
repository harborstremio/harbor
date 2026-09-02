import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth";
import type { Meta } from "@/lib/cinemeta";
import { prepareCachedDebridStreams } from "@/lib/debrid/playback-preparation";
import { useDebridClients } from "@/lib/debrid/registry";
import { buildPickerConfigHash, getPickerCache, setPickerCache } from "@/lib/picker-cache";
import { useSettings } from "@/lib/settings";
import { buildEpisodePipelineInput } from "@/lib/streams/episode-pipeline-input";
import { runPipeline } from "@/lib/streams/pipeline";
import { useAddons } from "@/views/play-picker/use-addons";
import { useAnimeAltTitles } from "@/views/play-picker/use-anime-alt-titles";
import { useImdbId } from "@/views/play-picker/use-imdb-id";
import { useStreamIds } from "@/views/play-picker/use-stream-ids";
import { stampAddonOrder } from "@/views/play-picker/picker-utils";

export function VoyagePrefetch({ meta }: { meta: Meta }) {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const debrids = useDebridClients();
  const imdb = useImdbId(meta, settings.tmdbKey);
  const streamIds = useStreamIds(meta, undefined, imdb.id);
  const { addons } = useAddons(authKey, settings);
  const animeTitles = useAnimeAltTitles(meta);
  const startedRef = useRef<string | null>(null);

  const strictMode = settings.streamFilterLevel === "strict";
  const filterDisabled = settings.streamFilterLevel === "off";

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
    if (meta.type !== "movie") return;
    if (!streamIds || addons === null) return;
    const stamp = `${meta.id}|${configHash}`;
    if (startedRef.current === stamp) return;
    if (getPickerCache(meta, undefined, configHash)?.complete) return;
    startedRef.current = stamp;
    const forever = new AbortController();

    void runPipeline(
      buildEpisodePipelineInput({
        meta,
        episode: undefined,
        imdbId: imdb.id,
        streamIds,
        addons,
        debrids,
        settings,
        strictMode,
        filterDisabled,
        animeTitles,
      }),
      forever.signal,
      (partial) => {
        if (partial.picker.all.length === 0) return;
        stampAddonOrder(partial.picker.all, partial.raw.addon);
        setPickerCache(meta, undefined, partial, configHash, false);
      },
    )
      .then((r) => {
        stampAddonOrder(r.picker.all, r.raw.addon);
        setPickerCache(meta, undefined, r, configHash);
        if (settings.instantPlaybackPreparation && r.picker.all.length > 0) {
          void prepareCachedDebridStreams(r.picker.all, debrids, undefined, forever.signal).catch(
            () => {},
          );
        }
      })
      .catch(() => {
        startedRef.current = null;
      });
  }, [
    meta,
    streamIds,
    addons,
    debrids,
    settings,
    strictMode,
    filterDisabled,
    animeTitles,
    imdb.id,
    configHash,
  ]);

  return null;
}
