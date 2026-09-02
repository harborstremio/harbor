import { CastMenu } from "@/components/player/cast-menu";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import { useT } from "@/lib/i18n";
import type { PlayerSrc } from "@/lib/view";
import { CastErrorModal } from "./cast-error-modal";
import { CastSessionBar } from "./cast-session-bar";
import { CastingOverlay } from "./casting-overlay";
import type { PlayerCastController } from "./hooks/use-player-cast";

export function CastLayer({
  cast,
  src,
  durationSec,
  hasActiveSub,
  onPickAnother,
}: {
  cast: PlayerCastController;
  src: PlayerSrc;
  durationSec: number;
  hasActiveSub: boolean;
  onPickAnother: () => void;
}) {
  const t = useT();
  return (
    <>
      <CastMenu
        open={cast.castMenuOpen}
        anchor={cast.castMenuAnchor}
        onClose={cast.closeCastMenu}
        onPick={cast.onPickDevice}
        hasActiveSub={hasActiveSub}
        burnSubsOnTv={cast.burnSubsOnTv}
        setBurnSubsOnTv={cast.setBurnSubsOnTv}
      />
      {cast.pendingCastDevice && !cast.castDevice && (
        <CastingOverlay
          device={cast.pendingCastDevice}
          title={src.title}
          poster={src.meta.poster}
          playing={false}
          connecting
        />
      )}
      {cast.castDevice && (
        <>
          <CastingOverlay
            device={cast.castDevice}
            title={src.title}
            poster={src.meta.poster}
            playing={cast.castPlaying}
          />
          <CastSessionBar
            device={cast.castDevice}
            playing={cast.castPlaying}
            positionSec={cast.castPositionSec || getPlaybackPosition()}
            durationSec={durationSec}
            onTogglePlay={cast.togglePlayCast}
            onStop={() => {
              cast.setCastTranscoding(false);
              return cast.stopCast();
            }}
            onSeek={cast.seekCast}
            transcoding={cast.castTranscoding}
          />
        </>
      )}
      {cast.castError && (
        <div className="pointer-events-none absolute end-6 top-20 z-20 rounded-xl border border-rose-300/40 bg-rose-400/15 px-4 py-2 text-[12.5px] text-rose-100">
          {cast.castError}
        </div>
      )}
      <CastErrorModal error={cast.castErrorInfo} onDismiss={cast.dismissCastErrorInfo} />
      {cast.castIncompatError && (
        <div className="pointer-events-auto absolute left-1/2 top-20 z-30 flex max-w-[520px] -translate-x-1/2 items-start gap-3 rounded-2xl border border-amber-300/40 bg-amber-400/15 px-4 py-3 text-[12.5px] leading-relaxed text-amber-50 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)] backdrop-blur-md">
          <span className="flex-1">{cast.castIncompatError}</span>
          <button
            type="button"
            onClick={() => {
              cast.setCastIncompatError(null);
              onPickAnother();
            }}
            className="shrink-0 rounded-full bg-amber-300/30 px-3 py-1 text-[11.5px] font-semibold text-amber-50 hover:bg-amber-300/50"
          >
            {t("Pick another")}
          </button>
          <button
            type="button"
            onClick={() => cast.setCastIncompatError(null)}
            className="shrink-0 rounded-full px-2 py-1 text-[11.5px] font-medium text-amber-50/80 hover:text-amber-50"
          >
            {t("Dismiss")}
          </button>
        </div>
      )}
    </>
  );
}
