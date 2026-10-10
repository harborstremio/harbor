import { Check, Gauge, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlayerSrc } from "@/lib/view";
import { switchMediaServerQuality } from "@/lib/media-server/playback";
import { MEDIA_SERVER_QUALITIES } from "@/lib/media-server/quality";
import type { MediaServerQuality } from "@/lib/media-server/types";
import { Tooltip } from "@/components/player/transport/tooltip";

export function HomeServerQualityControl({
  src,
  positionMs,
  playing,
  theme,
  replace,
}: {
  src: PlayerSrc;
  positionMs: number;
  playing: boolean;
  theme: "default" | "stremio";
  replace: (next: PlayerSrc) => void;
}) {
  const context = src.homeServer;
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  if (!context) return null;

  const switchQuality = async (quality: MediaServerQuality) => {
    if (quality === context.quality || switching) return;
    setSwitching(true);
    setError("");
    try {
      replace(await switchMediaServerQuality({ src, quality, positionMs, playing }));
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : String(cause)} Original quality remains available.`,
      );
    } finally {
      setSwitching(false);
    }
  };

  const label =
    MEDIA_SERVER_QUALITIES.find((quality) => quality.id === context.quality)?.label ?? "Original";
  return (
    <div
      ref={wrap}
      className="pointer-events-auto relative z-[190] flex flex-col items-center"
      onClick={(event) => event.stopPropagation()}
    >
      {open && (
        <div className="absolute bottom-[calc(100%+12px)] left-1/2 w-56 max-w-[calc(100vw-32px)] -translate-x-1/2 animate-menu-pop overflow-hidden rounded-md bg-elevated p-1.5 text-ink shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
          <div className="px-3 pb-2 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Home server quality
          </div>
          {MEDIA_SERVER_QUALITIES.map((quality) => {
            const active = quality.id === context.quality;
            return (
              <button
                key={quality.id}
                type="button"
                disabled={switching}
                onClick={() => {
                  setOpen(false);
                  void switchQuality(quality.id);
                }}
                className={`flex h-9 w-full items-center justify-between rounded px-3 text-start text-[12.5px] transition-colors ${active ? "bg-accent text-white" : "text-ink-muted hover:bg-white/10 hover:text-ink"}`}
              >
                <span>{quality.label}</span>
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
      <Tooltip label={`Home server quality · ${label}`}>
        <button
          type="button"
          aria-label={`Home server quality: ${label}`}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={switching}
          onClick={() => {
            setError("");
            setOpen((value) => !value);
          }}
          className={`${theme === "default" ? "h-11 min-w-11" : "h-10 min-w-10"} flex items-center justify-center rounded-full px-2 transition-[background-color,color] ${open ? "bg-white/22 text-white hover:bg-white/30" : "text-white/85 hover:bg-white/10 hover:text-white"}`}
        >
          {switching ? (
            <LoaderCircle className="animate-spin" size={22} />
          ) : (
            <Gauge size={22} strokeWidth={1.9} />
          )}
        </button>
      </Tooltip>
      {error && (
        <p
          role="alert"
          className="absolute bottom-12 end-0 w-72 rounded-xl bg-red-950/95 px-3 py-2 text-[11px] leading-4 text-red-100 shadow-xl ring-1 ring-red-400/20"
        >
          {error}
        </p>
      )}
    </div>
  );
}
