import { useCallback, useEffect, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { Loader2, MicVocal, X } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMusicPlayer, seekMusic } from "@/lib/music/player";
import { lyricIndexAt, loadTrackLyrics, type LyricLine } from "@/lib/music/lyrics";
import { getLyricOffset, shiftedLyricTime } from "@/lib/music/lyric-offset";
import {
  karaokeLineState,
  karaokeScrollMotion,
  karaokeScrollTop,
} from "@/lib/music/karaoke-scroll";
import "./music-karaoke.css";

const WAIT_MS = 14_000;
const REST = "· · ·";

type KaraokeStatus = "idle" | "loading" | "ready" | "missing";

function sung(lines: LyricLine[]): boolean {
  return lines.some((line) => line.text.trim().length > 0);
}

function scrollHost(from: HTMLElement | null): HTMLElement | null {
  for (let node = from?.parentElement ?? null; node; node = node.parentElement) {
    const flow = window.getComputedStyle(node).overflowY;
    if (flow === "auto" || flow === "scroll") return node;
  }
  return null;
}

export function MusicKaraoke({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const t = useT();
  const player = useMusicPlayer();
  const reduced = useReducedMotion();
  const track = player.current;
  const shell = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLOListElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const previous = useRef(-1);
  const seen = useRef("");
  const dismiss = useRef(onClose);
  const [lines, setLines] = useState<LyricLine[] | null>(null);
  const [status, setStatus] = useState<KaraokeStatus>("idle");
  const key = track ? `${track.connectorId ?? ""}:${track.id ?? ""}:${track.title ?? ""}` : "";
  const offset = getLyricOffset(player.current);
  const active =
    status === "ready" && lines
      ? lyricIndexAt(lines, shiftedLyricTime(player.currentTime, offset))
      : -1;

  useEffect(() => {
    dismiss.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !track) {
      setLines(null);
      setStatus("idle");
      return;
    }
    let live = true;
    setLines(null);
    setStatus("loading");
    const bail = window.setTimeout(() => {
      if (!live) return;
      live = false;
      setStatus("missing");
    }, WAIT_MS);
    void loadTrackLyrics(track)
      .then((found) => {
        if (!live) return;
        if (found && found.length > 0 && sung(found)) {
          setLines(found);
          setStatus("ready");
          return;
        }
        setStatus("missing");
      })
      .catch(() => {
        if (live) setStatus("missing");
      })
      .finally(() => window.clearTimeout(bail));
    return () => {
      live = false;
      window.clearTimeout(bail);
    };
  }, [open, key]);

  useEffect(() => {
    if (!open) {
      previous.current = -1;
      seen.current = "";
      return;
    }
    const view = scroller.current;
    const list = column.current;
    if (!view || !list) return;
    const node = active >= 0 ? (list.children.item(active) as HTMLElement | null) : null;
    const from = previous.current;
    const changed = seen.current !== key;
    previous.current = active;
    seen.current = key;
    const behavior = karaokeScrollMotion({
      from,
      to: active,
      trackChanged: changed,
      reducedMotion: reduced,
    });
    const top = node
      ? karaokeScrollTop({
          lineTop: node.offsetTop,
          lineHeight: node.offsetHeight,
          viewHeight: view.clientHeight,
          maxScroll: view.scrollHeight - view.clientHeight,
        })
      : 0;
    view.scrollTo({ top, behavior });
  }, [open, status, active, key, reduced]);

  useEffect(() => {
    if (!open) return;
    const host = scrollHost(shell.current);
    if (!host) return;
    const pin = () => {
      const node = shell.current;
      if (node) node.style.transform = host.scrollTop > 0 ? `translateY(${host.scrollTop}px)` : "";
    };
    pin();
    host.addEventListener("scroll", pin, { passive: true });
    return () => host.removeEventListener("scroll", pin);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => closer.current?.focus());
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismiss.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey, true);
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, [open]);

  const trap = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const stops = shell.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
    if (!stops || stops.length === 0) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  if (!open) return null;

  const title = track?.title ?? "";
  const artist = track?.artist ?? "";
  return (
    <div
      ref={shell}
      className="music-karaoke"
      role="dialog"
      aria-modal="true"
      aria-label={t("Lyrics")}
      data-state={status}
      onKeyDown={trap}
    >
      <div className="music-karaoke-head">
        <div className="music-karaoke-track">
          <MicVocal size={18} aria-hidden="true" />
          <div>
            <strong>{title}</strong>
            {artist ? <span>{artist}</span> : null}
          </div>
        </div>
        <button
          ref={closer}
          type="button"
          className="music-karaoke-close"
          aria-label={t("common.close")}
          title={t("common.close")}
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="music-karaoke-scroll" ref={scroller}>
        {status === "ready" && lines ? (
          <ol className="music-karaoke-lines" ref={column}>
            {lines.map((line, index) => (
              <li key={`${line.at}-${index}`}>
                <button
                  type="button"
                  className="music-karaoke-line"
                  data-line={karaokeLineState(index, active)}
                  aria-current={index === active ? "true" : undefined}
                  onClick={() => seekMusic(line.at)}
                >
                  {line.text.trim() || REST}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="music-karaoke-note" role="status">
            {status === "loading" ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                {t("Finding lyrics")}
              </>
            ) : (
              t("No lyrics for this track")
            )}
          </p>
        )}
      </div>
    </div>
  );
}
