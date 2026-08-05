import { Captions } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  formatSubtitleOffset,
  type SubtitleOffsetPosition,
  type SubtitleOffsetSize,
} from "@/lib/player/subtitle-offset";
import { useSettings } from "@/lib/settings";

const PLAYER_POSITION_CLASSES: Record<SubtitleOffsetPosition, string> = {
  "top-left": "left-8 top-24",
  top: "left-1/2 top-24 -translate-x-1/2",
  "top-right": "right-8 top-24",
  left: "left-8 top-1/2 -translate-y-1/2",
  center: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
  right: "right-8 top-1/2 -translate-y-1/2",
  "bottom-left": "bottom-32 left-8",
  bottom: "bottom-32 left-1/2 -translate-x-1/2",
  "bottom-right": "right-8 bottom-32",
};

const PREVIEW_POSITION_CLASSES: Record<SubtitleOffsetPosition, string> = {
  "top-left": "left-4 top-4",
  top: "left-1/2 top-4 -translate-x-1/2",
  "top-right": "right-4 top-4",
  left: "left-4 top-1/2 -translate-y-1/2",
  center: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
  right: "right-4 top-1/2 -translate-y-1/2",
  "bottom-left": "bottom-4 left-4",
  bottom: "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right": "right-4 bottom-4",
};

const SIZE_CLASSES: Record<
  SubtitleOffsetSize,
  { root: string; label: string; divider: string; value: string; icon: number }
> = {
  small: {
    root: "gap-2",
    label: "text-[11.5px]",
    divider: "h-3",
    value: "min-w-14 text-[11.5px]",
    icon: 14,
  },
  medium: {
    root: "gap-2.5",
    label: "text-[13px]",
    divider: "h-3.5",
    value: "min-w-16 text-[13px]",
    icon: 17,
  },
  large: {
    root: "gap-3",
    label: "text-[15px]",
    divider: "h-4",
    value: "min-w-20 text-[15px]",
    icon: 20,
  },
};

export function SubtitleOffsetIndicator({
  delaySec,
  preview = false,
}: {
  delaySec: number | null;
  preview?: boolean;
}) {
  const t = useT();
  const { settings } = useSettings();
  const enabled = preview || settings.subOffsetIndicatorEnabled;
  const visible = enabled && (preview || delaySec != null);
  const position = settings.subOffsetIndicatorPosition;
  const size = SIZE_CLASSES[settings.subOffsetIndicatorSize];

  return (
    <div
      role={preview ? undefined : "status"}
      aria-live={preview ? undefined : "polite"}
      aria-atomic={preview ? undefined : "true"}
      aria-hidden={!visible}
      className={`pointer-events-none absolute z-30 ${
        preview ? PREVIEW_POSITION_CLASSES[position] : PLAYER_POSITION_CLASSES[position]
      }`}
    >
      <div
        className={`flex items-center text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)] transition-[opacity,transform] motion-reduce:translate-y-0 motion-reduce:transition-none ${size.root} ${
          visible
            ? "translate-y-0 opacity-100 duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
            : "translate-y-2 opacity-0 duration-100 ease-out"
        }`}
      >
        <Captions
          size={size.icon}
          strokeWidth={1.75}
          className="text-white/80"
          aria-hidden="true"
        />
        <span className={`font-medium text-white/75 ${size.label}`}>{t("Subtitle sync")}</span>
        <span className={`w-px bg-white/35 ${size.divider}`} aria-hidden="true" />
        <span className={`text-center font-semibold tabular-nums text-white ${size.value}`}>
          {formatSubtitleOffset(delaySec ?? 0)}
        </span>
      </div>
    </div>
  );
}
