import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { fetchTrailer, resolveTrailerQuality, trailerSrc, type TrailerInfo } from "@/lib/trailer";
import { useTrailerVideo } from "@/lib/use-trailer-video";
import { useSettings } from "@/lib/settings";
import { usePageVisible } from "@/lib/visibility";
import { useT } from "@/lib/i18n";

const VIDEO_CLASS = "absolute inset-0 h-full w-full object-cover";

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
  const [muted, setMuted] = useState(!settings.detailTrailerAudio);
  const pageVisible = usePageVisible();
  const wantsPlayback = !!info && !paused && pageVisible;
  const { slot, video, ready } = useTrailerVideo({
    src: info ? trailerSrc(info) : null,
    active: !!info && pageVisible,
    className: VIDEO_CLASS,
    loop: true,
  });

  useEffect(() => {
    setInfo(null);
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
    const v = video.current;
    if (v) v.muted = muted;
  }, [muted, ready, video]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (wantsPlayback && ready) {
      v.play().catch(() => {
        if (!v.muted) {
          v.muted = true;
          setMuted(true);
          v.play().catch(() => {});
        }
      });
    } else if (!wantsPlayback) {
      v.pause();
    }
  }, [wantsPlayback, ready, video]);

  return (
    <>
      <div
        ref={slot}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-700"
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
