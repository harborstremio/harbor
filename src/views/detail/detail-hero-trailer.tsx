import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { fetchTrailer, resolveTrailerQuality, trailerSrc, type TrailerInfo } from "@/lib/trailer";
import { useSettings } from "@/lib/settings";
import { usePageVisible } from "@/lib/visibility";
import { useT } from "@/lib/i18n";

export function DetailHeroTrailer({
  candidateId,
  paused = false,
}: {
  candidateId: string | null;
  paused?: boolean;
}) {
  const t = useT();
  const { settings } = useSettings();
  const [info, setInfo] = useState<TrailerInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(!settings.detailTrailerAudio);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pageVisible = usePageVisible();
  const wantsPlayback = !!info && !paused && pageVisible;

  useEffect(() => {
    setInfo(null);
    setReady(false);
    setMuted(!settings.detailTrailerAudio);
    if (!candidateId) return;
    let cancelled = false;
    fetchTrailer(candidateId, resolveTrailerQuality(settings.trailerQuality)).then((i) => {
      if (!cancelled) setInfo(i);
    });
    return () => {
      cancelled = true;
    };
  }, [candidateId, settings.trailerQuality]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (wantsPlayback) {
      v.play().catch(() => {
        if (!v.muted) {
          v.muted = true;
          setMuted(true);
          v.play().catch(() => {});
        }
      });
    } else {
      v.pause();
    }
  }, [wantsPlayback]);

  useEffect(() => {
    if (!info) return;
    const v = videoRef.current;
    return () => {
      if (!v) return;
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {
        void 0;
      }
    };
  }, [info]);

  if (!info) return null;

  return (
    <>
      <video
        ref={videoRef}
        src={trailerSrc(info)}
        muted={muted}
        loop
        playsInline
        preload="none"
        onCanPlay={() => setReady(true)}
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
        style={{ opacity: wantsPlayback && ready ? 1 : 0 }}
      />
      {wantsPlayback && ready && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? t("Unmute trailer") : t("Mute trailer")}
          title={muted ? t("Unmute trailer") : t("Mute trailer")}
          className="absolute bottom-8 end-8 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/75"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      )}
    </>
  );
}
