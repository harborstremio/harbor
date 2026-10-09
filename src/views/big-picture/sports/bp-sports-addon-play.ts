import { useCallback, useEffect, useRef, useState } from "react";
import { isAddonEnabled } from "@/lib/addon-store";
import type { Meta } from "@/lib/cinemeta";
import { loadSportsAddonStreams } from "@/lib/sports/addon-sources";
import type { SportsAddonListing } from "@/lib/sports/addon-sources-model";
import { parseStream } from "@/lib/streams/parser";
import { resolveStream } from "@/lib/streams/resolve";
import { registerStreamProxy, unregisterStreamProxy } from "@/lib/stream-proxy";
import type { Stream } from "@/lib/streams/types";
import { useView } from "@/lib/view";
import { openUrl } from "@/lib/window";
import type { BpSportsAddonSources } from "./bp-sports-addon-sources";

const HTTP = /^https?:\/\//i;
const CATALOGUE = /^(movie|series)$/i;

export type BpSportsAddonFault = "" | "stream" | "listing";

export type BpSportsAddonPick = {
  picked: SportsAddonListing | null;
  streams: Stream[];
  pending: boolean;
  playing: number | null;
  error: BpSportsAddonFault;
  handoff: Meta | null;
  choose: (row: SportsAddonListing) => void;
  back: () => void;
  play: (stream: Stream, index: number) => void;
  closeHandoff: () => void;
};

export function useBpSportsAddonPick(sources: BpSportsAddonSources): BpSportsAddonPick {
  const { openPlayer } = useView();
  const [picked, setPicked] = useState<SportsAddonListing | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [pending, setPending] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const [error, setError] = useState<BpSportsAddonFault>("");
  const [handoff, setHandoff] = useState<Meta | null>(null);
  const run = useRef<AbortController | null>(null);
  const { reload, enabledProviders } = sources;

  useEffect(
    () => () => {
      run.current?.abort();
    },
    [],
  );

  const choose = useCallback(
    (row: SportsAddonListing) => {
      if (!isAddonEnabled(row.addon.transportUrl)) {
        reload();
        return;
      }
      run.current?.abort();
      const controller = new AbortController();
      run.current = controller;
      setPicked(row);
      setStreams([]);
      setPending(true);
      setPlaying(null);
      setError("");
      void (async () => {
        try {
          const found = await loadSportsAddonStreams(row, controller.signal, enabledProviders());
          if (!controller.signal.aborted) setStreams(found);
        } catch {
          if (!controller.signal.aborted) setError("listing");
        } finally {
          if (!controller.signal.aborted) setPending(false);
        }
      })();
    },
    [reload, enabledProviders],
  );

  const back = useCallback(() => {
    run.current?.abort();
    setPicked(null);
    setStreams([]);
    setPending(false);
    setPlaying(null);
    setError("");
  }, []);

  const start = useCallback(
    async (row: SportsAddonListing, stream: Stream, index: number) => {
      run.current?.abort();
      const controller = new AbortController();
      run.current = controller;
      setPlaying(index);
      setError("");
      let session: string | undefined;
      let transferred = false;
      try {
        const result = await resolveStream(
          parseStream(stream),
          [],
          controller.signal,
          true,
          false,
          undefined,
          false,
          false,
        );
        if (controller.signal.aborted) return;
        if (!result.ok) throw new Error("bp-addon-source-resolution");
        let url = result.data.url;
        if (result.data.headers && Object.keys(result.data.headers).length > 0) {
          const proxy = await registerStreamProxy(url, result.data.headers);
          url = proxy.url;
          session = proxy.sessionId;
        }
        if (controller.signal.aborted) return;
        openPlayer({
          meta: row.meta,
          url,
          title: row.meta.name,
          subtitle: row.addon.manifest.name,
          isLive: true,
          notWebReady: result.data.notWebReady ?? true,
          subtitles: result.data.subtitles,
          historyUrl: result.data.url,
          proxySessionId: session,
        });
        transferred = true;
      } catch {
        if (!controller.signal.aborted) setError("stream");
      } finally {
        if (session && !transferred) void unregisterStreamProxy(session).catch(() => {});
        if (!controller.signal.aborted) setPlaying(null);
      }
    },
    [openPlayer],
  );

  const play = useCallback(
    (stream: Stream, index: number) => {
      const row = picked;
      if (!row) return;
      if (
        !isAddonEnabled(row.addon.transportUrl) ||
        (stream.addonUrl && !isAddonEnabled(stream.addonUrl))
      ) {
        run.current?.abort();
        setPicked(null);
        setStreams([]);
        setPending(false);
        setPlaying(null);
        setError("");
        reload();
        return;
      }
      if (!stream.url && (stream.externalUrl || stream.ytId)) {
        const url =
          stream.externalUrl ||
          `https://www.youtube.com/watch?v=${encodeURIComponent(stream.ytId ?? "")}`;
        if (HTTP.test(url)) void openUrl(url);
        else setError("stream");
        return;
      }
      if (
        stream.infoHash ||
        !stream.url ||
        !HTTP.test(stream.url) ||
        (CATALOGUE.test(row.meta.type) && row.match !== "event")
      ) {
        run.current?.abort();
        setPlaying(null);
        setHandoff(row.meta);
        return;
      }
      void start(row, stream, index);
    },
    [picked, reload, start],
  );

  const closeHandoff = useCallback(() => setHandoff(null), []);

  return {
    picked,
    streams,
    pending,
    playing,
    error,
    handoff,
    choose,
    back,
    play,
    closeHandoff,
  };
}
