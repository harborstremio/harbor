import { ArrowLeft, Captions, CaptionsOff, Volume2, VolumeX } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { runBpBack } from "../bp-back";
import { useBpT } from "../bp-i18n";
import type { BpPlayerSlotEntry } from "./bp-player-slots";
import type { BpPlayback } from "./use-bp-playback";

// No backdrop-blur, for the reason bp-player-controls.tsx:9-16 measures: these
// chips and the transport rounds share one frame over a live decode, and this
// GPU only stops paying for backdrop-filter once nothing on screen uses it.
const CHIP =
  "flex h-[clamp(48px,5.6vh,68px)] shrink-0 items-center gap-[clamp(7px,0.7vw,13px)] rounded-full border border-[var(--bp-edge-2)] bg-[var(--bp-void)]/70 px-[clamp(16px,1.4vw,28px)] text-[clamp(14px,1.95vh,23px)] font-bold text-ink outline-none transition-colors duration-[var(--bp-dur-fast)]";

function BpRailChip({
  label,
  restoreKey,
  icon,
  active,
  onPress,
}: {
  label: string;
  restoreKey: string;
  icon?: React.ReactNode;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-chip
      data-bp-restore-key={restoreKey}
      aria-pressed={active}
      onClick={() => {
        SFX.click();
        onPress();
      }}
      className={`${CHIP} ${active ? "border-transparent bg-[var(--bp-on)] text-ink" : ""}`}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * One chip per declared panel, plus the toggles that have nowhere else to live.
 * Panels name themselves through the slot's label, so a builder adds a surface
 * and its way in with one declaration instead of editing the shell.
 */
export function BpPlayerRail({
  panels,
  panel,
  playback,
  onOpenPanel,
}: {
  panels: BpPlayerSlotEntry[];
  panel: string | null;
  playback: BpPlayback;
  onOpenPanel: (id: string) => void;
}) {
  const t = useBpT();
  const hasSubtitlePanel = panels.some((p) => p.id === "subtitles");
  const quickSubtitles = playback.canToggleSubtitles && !hasSubtitlePanel;

  return (
    <div
      data-bp-scroll-x
      className="flex gap-[clamp(9px,0.9vw,16px)] overflow-x-auto px-[var(--bp-gutter)] py-[clamp(6px,0.8vh,12px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <BpRailChip
        label={t("Back")}
        restoreKey="panel:back"
        icon={<ArrowLeft size={21} strokeWidth={2.2} className="rtl:rotate-180" />}
        onPress={() => runBpBack()}
      />
      {panels.map((p) => (
        <BpRailChip
          key={p.key}
          label={p.label ?? p.id ?? ""}
          restoreKey={`panel:${p.id ?? p.key}`}
          icon={p.icon}
          active={panel !== null && panel === p.id}
          onPress={() => onOpenPanel(p.id ?? "")}
        />
      ))}
      {quickSubtitles && (
        <BpRailChip
          label={playback.subtitlesOn ? t("Subtitles on") : t("Subtitles off")}
          restoreKey="panel:subtitle-toggle"
          icon={
            playback.subtitlesOn ? (
              <Captions size={21} strokeWidth={2.2} />
            ) : (
              <CaptionsOff size={21} strokeWidth={2.2} />
            )
          }
          active={playback.subtitlesOn}
          onPress={playback.toggleSubtitles}
        />
      )}
      <BpRailChip
        label={playback.muted ? t("Muted") : t("Sound on")}
        restoreKey="panel:mute-toggle"
        icon={
          playback.muted ? (
            <VolumeX size={21} strokeWidth={2.2} />
          ) : (
            <Volume2 size={21} strokeWidth={2.2} />
          )
        }
        active={playback.muted}
        onPress={() => playback.setMuted(!playback.muted)}
      />
    </div>
  );
}
