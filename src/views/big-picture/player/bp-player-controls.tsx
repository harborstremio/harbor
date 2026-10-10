import { Pause, Play, Rewind, FastForward } from "lucide-react";
import { SkipBackIcon, SkipIcon } from "@/components/icons/harbor-glyphs";
import { useSettings } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import { useBpT } from "../bp-i18n";
import type { BpPlayback } from "./use-bp-playback";

const ROUND =
  "flex shrink-0 items-center justify-center rounded-full outline-none transition-colors duration-[var(--bp-dur-fast)]";
// Darkened, never blurred, and this is the one surface where that is not a
// preference. The chrome shows four of these plus three rail chips composited
// over a live decode, and backdrop-filter on this GPU measured p50 65ms at 131
// chips against 22ms at zero, with the cost saturating around eight: seven is
// full price with no headroom left to buy back. --bp-glass is ink at 7 percent
// and reads as nothing over bright video without a blur behind it, so the fill
// has to carry the contrast itself. Depth here comes from darkening.
const SECONDARY =
  "h-[clamp(48px,5.6vh,68px)] w-[clamp(48px,5.6vh,68px)] border border-[var(--bp-edge-2)] bg-[var(--bp-void)]/70 text-ink";
const PRIMARY =
  "h-[clamp(56px,6.6vh,82px)] w-[clamp(56px,6.6vh,82px)] bg-[var(--bp-on)] text-ink";

function BpControl({
  label,
  restoreKey,
  primary,
  autofocus,
  disabled,
  onPress,
  children,
}: {
  label: string;
  restoreKey: string;
  primary?: boolean;
  autofocus?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-bp-focusable
      data-bp-chip
      data-bp-restore-key={restoreKey}
      data-bp-autofocus={autofocus ? "true" : undefined}
      data-bp-disabled={disabled ? "true" : undefined}
      disabled={disabled}
      onClick={() => {
        SFX.click();
        onPress();
      }}
      className={`${ROUND} ${primary ? PRIMARY : SECONDARY} ${disabled ? "opacity-35" : ""}`}
    >
      {children}
    </button>
  );
}

/**
 * The transport the shell falls back to when nothing fills the transport slot.
 * It is deliberately only transport: panels belong on the rail, and a shell
 * that renders no focusable at all is a stuck screen with no way out.
 */
export function BpPlayerControls({ playback }: { playback: BpPlayback }) {
  const t = useBpT();
  const { settings } = useSettings();
  const back = settings.seekBackStepSec || 10;
  const forward = settings.seekForwardStepSec || 10;
  const series = playback.hasPrevEpisode || playback.hasNextEpisode;

  return (
    <div className="flex items-center gap-[clamp(10px,1vw,20px)]">
      {series && (
        <BpControl
          label={t("Previous episode")}
          restoreKey="control:prev"
          disabled={!playback.hasPrevEpisode}
          onPress={playback.prevEpisode}
        >
          <SkipBackIcon size={22} />
        </BpControl>
      )}
      {!playback.live && (
        <BpControl
          label={t("Back {n}s", { n: back })}
          restoreKey="control:back"
          onPress={() => playback.seekBy(-back)}
        >
          <Rewind size={22} strokeWidth={2.2} />
        </BpControl>
      )}
      <BpControl
        label={playback.playing ? t("Pause") : t("Play")}
        restoreKey="control:play"
        primary
        autofocus
        onPress={playback.playPause}
      >
        {playback.playing ? (
          <Pause size={28} className="fill-current" strokeWidth={0} />
        ) : (
          <Play size={28} className="ms-[3px] fill-current" strokeWidth={0} />
        )}
      </BpControl>
      {!playback.live && (
        <BpControl
          label={t("Forward {n}s", { n: forward })}
          restoreKey="control:forward"
          onPress={() => playback.seekBy(forward)}
        >
          <FastForward size={22} strokeWidth={2.2} />
        </BpControl>
      )}
      {series && (
        <BpControl
          label={t("Next episode")}
          restoreKey="control:next"
          disabled={!playback.hasNextEpisode}
          onPress={playback.nextEpisode}
        >
          <SkipIcon size={22} />
        </BpControl>
      )}
    </div>
  );
}
