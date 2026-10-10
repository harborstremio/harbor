import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ListPlus, MoreHorizontal, Pause, Play, Repeat2, Volume2, VolumeX, X } from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { beginSnippetSession } from "@/lib/music/snippet-session";
import { loadSnippetGenres, SNIPPET_SECONDS } from "@/lib/music/snippets";
import { useSnippetFeed } from "@/lib/music/use-snippet-feed";
import { recordSnippetsSeen } from "@/lib/music/snippet-history";
import { readMusicPreference, writeMusicPreference } from "@/lib/music/preferences";
import { activeProfileId } from "@/lib/active-profile-id";
import { getMusicState, subscribeMusic, toggleMusicLiked, enqueueMusic } from "@/lib/music/player";
import { musicGenre } from "@/lib/music/genre-catalog";
import { requestMusicGenre, requestMusicExplore } from "@/lib/music/navigation";
import { useMusicTrackLiked } from "@/lib/music/use-track-liked";
import { MusicPlaylistCover } from "./music-playlist-cover";
import { MusicTrackLabels } from "./music-track-labels";
import { useMusicPlaylistPicker } from "./music-playlist-picker";
import { useMusicSourcePicker } from "./music-source-picker";
import { useMusicTrackContextMenu } from "./music-track-menu";
import { MusicQuickListenIcon } from "./music-quick-listen-icon";
import { MusicSnippetGlow } from "./music-snippet-glow";
import { MusicLikeButton } from "./music-like-button";
import type { MusicTrack } from "@/lib/music/types";
import "./music-quick-listen.css";

type PreviewState = "loading" | "playing" | "paused" | "ended";

export function MusicQuickListen({ seeds, onClose }: { seeds: MusicTrack[]; onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  const artFrame = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(0);
  const { items, building, reject } = useSnippetFeed(seeds, index);
  const tracks = items.map(item => item.track);
  const snippet = items[index];
  const [genres, setGenres] = useState<number[]>([]);
  const [status, setStatus] = useState<PreviewState>("loading");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const profile = useRef(activeProfileId());
  const [loop, setLoop] = useState(() => readMusicPreference(`harbor.music.previewLoop.${profile.current}`) !== "false");
  const loopEnabled = useRef(loop);
  loopEnabled.current = loop;
  const [volume, setVolume] = useState(() => {
    const saved = readMusicPreference(`harbor.music.previewVolume.${activeProfileId()}`);
    const value = saved === null ? Math.min(.25, getMusicState().volume) : Number(saved);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .25;
  });
  const audio = useRef<HTMLAudioElement | null>(null);
  const session = useRef<ReturnType<typeof beginSnippetSession> | null>(null);
  const preservePlayback = useRef(true);
  const track = tracks[index];
  const display = track;
  const failed = useRef(() => {});
  failed.current = () => { if (snippet) { reject(snippet); setIndex(value => Math.max(0, Math.min(value, items.length - 2))); } };
  const saved = useMusicTrackLiked(display);
  const { openPlaylistPicker } = useMusicPlaylistPicker();
  const { openSourcePicker } = useMusicSourcePicker();
  const stopAudio = () => { const player = audio.current; if (player) { player.pause(); player.removeAttribute("src"); player.load(); } };
  const close = useCallback(() => { stopAudio(); onClose(); }, [onClose]);
  const attachVolumeWheel = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const adjust = (event: WheelEvent) => {
      if (event.ctrlKey || !(event.deltaY || event.deltaX)) return;
      event.preventDefault();
      event.stopPropagation();
      const change = Math.sign(event.deltaY || event.deltaX) * 5;
      setVolume(value => Math.max(0, Math.min(100, Math.round(value * 100) - change)) / 100);
      setMuted(false);
    };
    node.addEventListener("wheel", adjust, { passive: false });
    return () => node.removeEventListener("wheel", adjust);
  }, []);

  useEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const player = new Audio();
    player.preload = "auto";
    player.volume = volume;
    audio.current = player;
    const borrowed = beginSnippetSession();
    session.current = borrowed;
    closeButton.current?.focus({ preventScroll: true });
    const finish = () => {
      if (loopEnabled.current && !document.hidden && getMusicState().phase !== "playing" && getMusicState().phase !== "resolving") {
        player.currentTime = 0; setElapsed(0);
        if (player.paused) void player.play().catch(() => setStatus("paused"));
      } else { player.pause(); setStatus("ended"); }
    };
    const onTime = () => {
      setElapsed(Math.min(SNIPPET_SECONDS, player.currentTime));
      if (player.currentTime >= SNIPPET_SECONDS) finish();
    };
    player.ontimeupdate = onTime;
    player.onplaying = () => setStatus("playing");
    player.onpause = () => setStatus(current => current === "playing" ? "paused" : current);
    player.onended = finish;
    player.onerror = () => failed.current();
    const unsubscribe = subscribeMusic(() => { if (getMusicState().phase === "playing") player.pause(); });
    const hidden = () => { if (document.hidden) player.pause(); };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      unsubscribe(); document.removeEventListener("visibilitychange", hidden);
      player.ontimeupdate = player.onplaying = player.onpause = player.onended = player.onerror = null;
      player.pause(); player.removeAttribute("src"); player.load();
      borrowed.close(preservePlayback.current);
      if (origin?.isConnected) origin.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!track || !snippet) return;
    recordSnippetsSeen([track], profile.current);
    const controller = new AbortController();
    const player = audio.current!;
    player.pause(); player.removeAttribute("src"); player.load();
    setStatus("loading"); setElapsed(0); setGenres([]);
    if (snippet.artist) void loadSnippetGenres(snippet.artist, controller.signal).then(value => { if (!controller.signal.aborted) setGenres(value); }).catch(() => {});
    void session.current!.ready.then(async ready => {
      if (controller.signal.aborted) return;
      player.src = snippet.url;
      if (!ready || document.hidden || getMusicState().phase === "playing") { setStatus("paused"); return; }
      await player.play().catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "NotAllowedError") setStatus("paused");
        else failed.current();
      });
    }).catch(() => { if (!controller.signal.aborted) failed.current(); });
    return () => { controller.abort(); player.pause(); };
  }, [track?.id, track?.connectorId]);

  useEffect(() => {
    if (audio.current) { audio.current.muted = muted; audio.current.volume = volume; }
    writeMusicPreference(`harbor.music.previewVolume.${profile.current}`, String(volume));
  }, [muted, volume]);

  useEffect(() => { writeMusicPreference(`harbor.music.previewLoop.${profile.current}`, String(loop)); }, [loop]);

  useEffect(() => {
    // Scrolling can make a focused card inert. Keep keyboard controls in this dialog.
    if (document.activeElement === document.body) root.current?.focus({ preventScroll: true });
  }, [index]);

  const step = (delta: number) => {
    const node = rail.current;
    if (!node) return;
    const target = Math.max(0, Math.min(tracks.length - 1, index + delta));
    node.scrollTo({ top: target * node.clientHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const scrollIndex = (node: HTMLDivElement) => {
    if (!node.clientHeight) return;
    const next = Math.max(0, Math.min(tracks.length - 1, Math.round(node.scrollTop / node.clientHeight)));
    if (next === index) return;
    // A fast wheel/trackpad gesture can cross several cards between React renders.
    recordSnippetsSeen(tracks.slice(Math.min(index, next), Math.max(index, next) + 1), profile.current);
    setIndex(next);
  };
  const togglePreview = () => {
    const player = audio.current;
    if (!player || !snippet?.url) return;
    if (!player.paused) player.pause();
    else {
      if (getMusicState().phase === "playing" || getMusicState().phase === "resolving") return;
      if (status === "ended") player.currentTime = 0;
      void player.play().catch(() => failed.current());
    }
  };
  const playFull = () => {
    if (!display) return;
    preservePlayback.current = false;
    stopAudio(); close();
    openSourcePicker(display, [display]);
  };
  const menu = useMusicTrackContextMenu(display, {
    onPlay: playFull,
    onAddToQueue: display ? () => enqueueMusic(display) : undefined,
    onAddToPlaylist: display ? () => openPlaylistPicker(display) : undefined,
    onMoreLikeThis: display ? () => { close(); requestMusicExplore({ kind: "similar", track: display }); } : undefined,
    onGoToAlbum: display ? () => { close(); requestMusicExplore({ kind: "album", track: display }); } : undefined,
    onGoToArtist: display ? () => { close(); requestMusicExplore({ kind: "artist", track: display }); } : undefined,
  });
  const labels = useMemo(() => genres.map(musicGenre).filter(genre => !!genre), [genres]);
  const previewLabel = t(status === "playing" ? "music.pause" : status === "ended" ? "music.quickListen.replay" : "music.quickListen.previewPlay");
  const iconButton = (label: string, icon: React.ReactNode, action: () => void, props: { pressed?: boolean; disabled?: boolean } = {}) => <HoverTooltip label={label} align="center"><button type="button" className="music-snippet-action" onClick={action} aria-label={label} aria-pressed={props.pressed} disabled={props.disabled}>{icon}</button></HoverTooltip>;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.target instanceof Element && event.target.closest('[role="menu"], input, textarea'))) return;
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (root.current?.closest('[role="dialog"]') !== dialogs[dialogs.length - 1]) return;
      if (event.key === "ArrowDown" || event.key === "PageDown") { event.preventDefault(); event.stopPropagation(); step(1); }
      else if (event.key === "ArrowUp" || event.key === "PageUp") { event.preventDefault(); event.stopPropagation(); step(-1); }
      else if (event.key.toLowerCase() === "m") { event.preventDefault(); setMuted(value => !value); }
      else if (event.key === "Tab") {
        const buttons = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')].filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden" && !node.closest('[inert]'));
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }

    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [index, tracks.length]);

  return <ModalShell closing={false} onDismiss={close} width={1200} labelledBy={titleId} backdropClassName="music-snippet-backdrop" dismissOnBackdrop={false}>
    <div ref={root} tabIndex={-1} className="music-snippet-listen" data-playing={status === "playing" || undefined}>
      {display && <MusicSnippetGlow artwork={display.artwork} audio={audio} energy={snippet?.energy} frame={artFrame} host={root} />}
      <header className="music-snippet-header">
        <div><MusicQuickListenIcon size={22} /><h2 id={titleId}>{t("music.quickListen.title")}</h2></div>
        <div>{iconButton(t("music.quickListen.loop"), <Repeat2 size={20} />, () => setLoop(value => !value), { pressed: loop })}<div ref={attachVolumeWheel} className="music-snippet-volume">
          <button type="button" className="music-snippet-action" aria-label={t(muted ? "music.quickListen.unmute" : "music.quickListen.mute")} aria-pressed={muted} onClick={() => setMuted(!muted)}>{muted || volume === 0 ? <VolumeX size={21} /> : <Volume2 size={21} />}</button>
          <div className="music-snippet-volume-panel">
            <input type="range" min="0" max="100" step="1" value={Math.round(volume * 100)} aria-label={t("music.volume")} onChange={event => { setVolume(Number(event.target.value) / 100); setMuted(false); }} />
            <output>{Math.round(volume * 100)}%</output>
          </div>
        </div>
          <HoverTooltip label={t("common.close")} align="center"><button ref={closeButton} type="button" className="music-snippet-action" onClick={close} aria-label={t("common.close")}><X size={22} /></button></HoverTooltip></div>
      </header>
      {tracks.length ? <div className="music-snippet-rail" ref={rail} onScroll={event => scrollIndex(event.currentTarget)}>
        {tracks.map((candidate, at) => {
          if (Math.abs(at - index) > 1) return <div key={`${candidate.connectorId}:${candidate.id}`} className="music-snippet-card" aria-hidden="true" />;
          const active = at === index;
          const song = active ? display! : candidate;
          return <article key={`${candidate.connectorId}:${candidate.id}`} className="music-snippet-card" aria-hidden={!active || undefined} inert={!active}>
            <div className="music-snippet-copy">
              <span className="music-snippet-eyebrow">{t("music.quickListen.preview")}</span>
              <h3>{song.title}</h3>
              <div className="music-snippet-credit"><MusicTrackLabels track={song} /><span>{song.artist}</span></div>
              {song.album && <p className="music-snippet-album">{song.album}</p>}
              <div className="music-snippet-progress" role="progressbar" aria-label={t("music.quickListen.preview")} aria-valuenow={active ? Math.round(elapsed) : 0} aria-valuemin={0} aria-valuemax={SNIPPET_SECONDS}><span style={{ width: `${active ? elapsed / SNIPPET_SECONDS * 100 : 0}%` }} /></div>
              <div className="music-snippet-status" role={active ? "status" : undefined}>{active && (status === "loading" ? t("music.quickListen.loading") : `${Math.floor(elapsed)} / ${SNIPPET_SECONDS} · ${t("music.quickListen.provider")}`)}</div>
              <div className="music-snippet-actions">
                <HoverTooltip label={t("music.quickListen.fullSong")} align="center"><button type="button" className="music-snippet-full" aria-label={t("music.quickListen.fullSong")} onClick={playFull}><Play size={21} fill="currentColor" /></button></HoverTooltip>
                <HoverTooltip label={t(saved ? "music.unsaveTrack" : "music.saveTrack")} align="center">
                  <MusicLikeButton key={`${active}:${song.connectorId}:${song.id}`} className="music-snippet-action" size={25} liked={saved} onToggle={() => toggleMusicLiked(song)} />
                </HoverTooltip>
                {iconButton(t("music.card.addToPlaylist"), <ListPlus size={25} />, () => openPlaylistPicker(song))}
                <HoverTooltip label={t("music.quickListen.more")} align="center"><button type="button" className="music-snippet-action" aria-label={t("music.quickListen.more")} onClick={menu.onContextMenu}><MoreHorizontal size={25} /></button></HoverTooltip>
              </div>
            </div>
            <div className="music-snippet-art-stage" data-playing={active && status === "playing" || undefined}>
              <div ref={active ? artFrame : undefined} className="music-snippet-art-frame">
              <button type="button" className="music-snippet-art" aria-label={previewLabel} onClick={togglePreview} disabled={!active || !snippet?.url}>
                <MusicPlaylistCover artwork={[song.artwork]} seed={song.id} glyphSize={64} />
                {active && snippet?.url && <span className="music-snippet-art-control">{status === "playing" ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}</span>}
              </button>
              </div>
            </div>
          </article>;
        })}
      </div> : <div className="music-snippet-empty" role="status"><MusicQuickListenIcon size={64} /><p>{t("music.quickListen.finding")}</p></div>}
      <footer className="music-snippet-footer"><span className="music-snippet-count" aria-busy={building}>{tracks.length ? `${index + 1} / ${tracks.length}` : ""}</span>
        <button type="button" className="music-snippet-scroll-cue" aria-label={t("music.next")} data-ended={status === "ended" || undefined} disabled={index >= tracks.length - 1} onClick={() => step(1)}><svg width="28" height="14" viewBox="0 0 28 14" fill="none" aria-hidden="true"><path d="M3 4 L14 9.5 L25 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <div className="music-snippet-footer-controls">
          <div className="music-snippet-genres">{labels.map(genre => <button type="button" key={genre.id} onClick={() => { close(); requestMusicGenre(genre.name); }}>{genre.name}</button>)}</div>
          <div className="music-snippet-navigation">{iconButton(t("music.previous"), <ArrowUp size={21} />, () => step(-1), { disabled: index === 0 })}{iconButton(t("music.next"), <ArrowDown size={21} />, () => step(1), { disabled: index >= tracks.length - 1 })}</div>
        </div>
      </footer>
      {menu.menu}
    </div>
  </ModalShell>;
}
