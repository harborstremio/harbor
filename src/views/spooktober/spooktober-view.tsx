import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { useSectionBack } from "@/lib/section-back";
import { openExternalUrlStrict } from "@/lib/window";
import { SPOOKTOBER_PLAYLISTS } from "@/lib/spooktober-navigation";
import type { SpooktoberPlaylistRequest } from "@/lib/spooktober-navigation";
import { SpooktoberLoadingScene } from "./spooktober-loading";
import { SpooktoberMusicProvider, SpooktoberPlaylist, useSpooktoberMusicPlayback } from "./spooktober-playlist";
import { spooktoberSongToTrack, spooktoberVideoToTrack } from "./spooktober-music";
import { SpooktoberPlaylistIndicator } from "./spooktober-playlist-indicator";
import nativeTheme from "../../../scripts/spooktober-native/theme.css?raw";
import playingMarkStyles from "@/components/music/music-now-playing-mark.css?raw";
import "./spooktober-view.css";

const NATIVE_ENTRY = "/spooktober/native-entry.js?v=20261003-anime-mask-mal";
type Item = Record<string, unknown>;
type Intent = { intent: string; item?: Item; id?: string; url?: string };
type Runtime = { setActive: (active: boolean) => void; forget: () => void; back: () => boolean; dispose: () => void };
type NativeModule = { mountSpooktober: (options: { root: ShadowRoot; scroller: HTMLElement; onIntent: (message: Intent) => void }) => Promise<Runtime> };
type SpooktoberViewProps = { active: boolean; onBack: () => void; playlistRequest?: SpooktoberPlaylistRequest | null; entryToken?: number };
const text = (item: Item, key: string) => typeof item[key] === "string" ? item[key] as string : "";

export function SpooktoberView(props: SpooktoberViewProps) {
  return <SpooktoberMusicProvider active={props.active}><SpooktoberContent {...props} /></SpooktoberMusicProvider>;
}

function SpooktoberContent({ active, onBack, playlistRequest, entryToken }: SpooktoberViewProps) {
  const t = useT();
  const { openMeta } = useView();
  const { settings } = useSettings();
  const { play, playVideo } = useSpooktoberMusicPlayback();
  const host = useRef<HTMLDivElement>(null);
  const playlistReturnFocus = useRef<HTMLElement | null>(null);
  const runtime = useRef<Runtime | null>(null);
  const [playlist, setPlaylist] = useState<string | null>(playlistRequest?.id ?? null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const isVisible = active && !playlist;
  const visibility = useRef(isVisible);
  visibility.current = isVisible;
  useEffect(() => { if (playlistRequest) setPlaylist(playlistRequest.id); }, [playlistRequest]);
  const back = useCallback(() => {
    if (playlist) {
      const origin = playlistReturnFocus.current;
      setPlaylist(null);
      requestAnimationFrame(() => (origin?.isConnected ? origin : host.current)?.focus({ preventScroll: true }));
    }
    else if (!runtime.current?.back()) onBack();
  }, [playlist, onBack]);
  useSectionBack(back, active && !playlist);

  const onIntent = useRef<(message: Intent) => void>(() => {});
  onIntent.current = (message) => {
    if (!visibility.current) return;
    if (message.intent === "back") { onBack(); return; }
    if (message.intent === "reload") { setAttempt(value => value + 1); return; }
    if (message.intent === "playlist" && message.id && SPOOKTOBER_PLAYLISTS.has(message.id)) {
      const focused = host.current?.shadowRoot?.activeElement;
      playlistReturnFocus.current = focused instanceof HTMLElement ? focused : null;
      setPlaylist(message.id);
      return;
    }
    if (message.intent === "external" && typeof message.url === "string" && /^https?:\/\//i.test(message.url)) {
      void openExternalUrlStrict(message.url).catch(() => setLinkFailed(true));
      return;
    }
    const item = message.item;
    if (!item || typeof item !== "object") return;
    const title = text(item, "title");
    if (!title) return;
    if (message.intent === "meta") {
      const id = text(item, "imdbId");
      if (!/^tt\d{5,12}$/.test(id)) return;
      openMeta({ id, name: title, type: item.type === "Series" ? "series" : "movie", poster: text(item, "poster"), description: text(item, "description"), releaseInfo: String(item.year ?? ""), genres: Array.isArray(item.genres) ? item.genres.filter((value): value is string => typeof value === "string") : undefined });
    } else if (message.intent === "video" && /^[\w-]{11}$/.test(text(item, "id"))) {
      playVideo(spooktoberVideoToTrack({ id: text(item, "id"), title, artist: text(item, "artist"), image: text(item, "image") }));
    } else if (message.intent === "track" && text(item, "id") && text(item, "creator")) {
      play(spooktoberSongToTrack({ id: text(item, "id"), title, creator: text(item, "creator"), album: text(item, "album"), poster: text(item, "poster"), duration: Number(item.duration) || 0, explicit: item.explicit === true }));
    }
  };

  useEffect(() => {
    const scroller = host.current;
    if (!scroller) return;
    const root = scroller.shadowRoot ?? scroller.attachShadow({ mode: "open" });
    let cancelled = false;
    let mounted: Runtime | null = null;
    setReady(false);
    setFailed(false);
    void (async () => {
      try {
        const entryUrl = new URL(NATIVE_ENTRY, window.location.href).href;
        const module = await import(/* @vite-ignore */ entryUrl) as NativeModule;
        if (cancelled) return;
        mounted = await module.mountSpooktober({ root, scroller, onIntent: (message) => onIntent.current(message) });
        if (cancelled) { mounted.dispose(); return; }
        runtime.current = mounted;
        mounted.setActive(visibility.current);
        setReady(true);
      } catch (error) {
        console.error("Spooktober could not load", error);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      mounted?.dispose();
      if (runtime.current === mounted) runtime.current = null;
    };
  }, [attempt, NATIVE_ENTRY]);
  useEffect(() => { if (entryToken) runtime.current?.forget(); }, [entryToken, ready]);
  useEffect(() => { runtime.current?.setActive(isVisible); }, [isVisible, ready]);
  useEffect(() => {
    const root = host.current?.shadowRoot;
    if (!ready || !root) return;
    const style = document.createElement("style");
    style.dataset.harborTheme = "";
    style.textContent = playingMarkStyles + nativeTheme;
    root.append(style);
    return () => style.remove();
  }, [ready, nativeTheme, playingMarkStyles]);

  return <div className="spooktober-native-view">
    <div ref={host} className="spooktober-world harbor-scroll" hidden={!!playlist} tabIndex={-1} aria-label="Spooktober" data-local-keyboard data-show-imdb={settings.showImdbBadge} />
    {ready && host.current?.shadowRoot && <SpooktoberPlaylistIndicator root={host.current.shadowRoot} active={isVisible} />}
    {playlist && <SpooktoberPlaylist playlistId={playlist} onBack={back} active={active} focusTrackId={playlistRequest?.id === playlist ? playlistRequest.trackId : undefined} />}
    {!playlist && (!ready || failed) && <div className="spooktober-runtime-status" role="status" aria-label={t(failed ? "spooktober.error" : "spooktober.loading")}>
      {failed ? <><p>{t("spooktober.error")}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>{t("spooktober.retry")}</button></> : <SpooktoberLoadingScene />}
    </div>}
    {linkFailed && <div className="spooktober-notice" role="alert">{t("spooktober.linkError")}<button type="button" onClick={() => setLinkFailed(false)}>{t("common.close")}</button></div>}
  </div>;
}
