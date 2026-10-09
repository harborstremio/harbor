import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchTrailer, resolveTrailerQuality, trailerSrc } from "@/lib/trailer";
import { useSettings } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";
import { pushBpBack } from "./bp-back";

const SEEK_S = 10;

export function BpTrailer({
  ytId,
  title,
  onClose,
}: {
  ytId: string;
  title: string;
  onClose: () => void;
}) {
  const { settings } = useSettings();
  const t = useBpT();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(
    () =>
      pushBpBack(() => {
        onClose();
        return true;
      }),
    [onClose],
  );

  useEffect(() => {
    let alive = true;
    fetchTrailer(ytId, resolveTrailerQuality(settings.trailerQuality))
      .then((info) => {
        if (!alive) return;
        if (info) setSrc(trailerSrc(info));
        else setFailed(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [ytId, settings.trailerQuality]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        e.stopImmediatePropagation();
        SFX.close();
        onClose();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) void v.play();
        else v.pause();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Math.max(0, v.currentTime + (e.key === "ArrowRight" ? SEEK_S : -SEEK_S));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    // Overlay, not dialog: playback owns every key here, and there is no cell for
    // the engine to move between.
    <div
      data-bp-overlay
      className="fixed inset-0 z-[960] flex items-center justify-center bg-black [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
      onClick={onClose}
    >
      {src ? (
        <video
          ref={videoRef}
          src={src}
          autoPlay
          controls
          onEnded={onClose}
          className="max-h-full max-w-full"
        />
      ) : (
        <p className="text-[clamp(13.5px,1.95vh,22px)] font-semibold text-ink-subtle">
          {failed ? t("No trailer available for {name}", { name: title }) : t("Loading trailer...")}
        </p>
      )}
    </div>,
    document.body,
  );
}
