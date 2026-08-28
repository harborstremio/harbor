import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { TrackInfo } from "@/lib/player/bridge";
import {
  getMpvSubtitleFpsGeneration,
  readMpvSubtitleFps,
  readMpvVideoFps,
  writeMpvSubtitleFps,
} from "@/lib/player/mpv-properties";
import { isTextSubTrack } from "@/lib/player/sub-format";
import {
  SUBTITLE_FPS_PRESETS,
  formatSubtitleFps,
  matchingSubtitleFpsPreset,
  subtitleFpsMatchesVideo,
  subtitleFpsAvailability,
  validateSubtitleFps,
  type SubtitleFpsChoice,
  type SubtitleFpsUnavailableReason,
} from "@/lib/player/subtitle-fps";

type Props = {
  engine: "html5" | "mpv";
  track: TrackInfo | null;
  hasSecondary: boolean;
  autoSyncActive: boolean;
  onBeforeApply?: () => void;
  onBack: () => void;
};

export function SubtitleFpsPanel({
  engine,
  track,
  hasSecondary,
  autoSyncActive,
  onBeforeApply,
  onBack,
}: Props) {
  const tr = useT();
  const [videoFps, setVideoFps] = useState<number | null>(null);
  const [subtitleFps, setSubtitleFps] = useState<number | null>(null);
  const [nativeSupported, setNativeSupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("25");
  const [customOpen, setCustomOpen] = useState(false);
  const [automatic, setAutomatic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const applyRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    applyRequestRef.current += 1;
    setError(null);
    setSaving(false);
    setCustomOpen(false);
    setAutomatic(false);
    setVideoFps(null);
    setSubtitleFps(null);

    setLoading(true);
    void Promise.all([readMpvVideoFps(), readMpvSubtitleFps()]).then(([video, subtitle]) => {
      if (cancelled) return;
      const resetByPlayer = autoSyncActive || hasSecondary || !isTextSubTrack(track);
      const value = resetByPlayer ? null : subtitle.value;
      setVideoFps(video);
      setSubtitleFps(value);
      setNativeSupported(subtitle.supported);
      setDraft(formatSubtitleFps(value ?? video ?? 25, 6));
      const matchesVideo = subtitleFpsMatchesVideo(value, video);
      setAutomatic(matchesVideo);
      setCustomOpen(value != null && !matchesVideo && matchingSubtitleFpsPreset(value) == null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [autoSyncActive, hasSecondary, track?.id]);

  const availability = subtitleFpsAvailability({
    engine,
    hasTrack: track != null,
    textBased: isTextSubTrack(track),
    hasSecondary,
    videoFps,
    nativeSupported,
    autoSyncActive,
  });
  const disabled = loading || saving || !availability.enabled;
  const selectedPreset = matchingSubtitleFpsPreset(subtitleFps);
  const selectedValue = automatic
    ? "auto"
    : subtitleFps == null
      ? "default"
      : (selectedPreset ?? "custom");
  const reason = availability.enabled ? null : unavailableMessage(availability.reason, tr);

  const applySourceFps = async (choice: SubtitleFpsChoice, mode: "manual" | "auto" = "manual") => {
    if (!availability.enabled || !track) return;
    const request = ++applyRequestRef.current;
    setSaving(true);
    setError(null);
    try {
      onBeforeApply?.();
      await writeMpvSubtitleFps(choice, getMpvSubtitleFpsGeneration());
      if (request !== applyRequestRef.current) return;
      const value = choice === "default" ? null : choice;
      setSubtitleFps(value);
      setAutomatic(mode === "auto");
      setCustomOpen(mode !== "auto" && value != null && matchingSubtitleFpsPreset(value) == null);
      if (value != null) setDraft(formatSubtitleFps(value, 6));
    } catch (cause) {
      if (request !== applyRequestRef.current) return;
      console.warn("[subtitles] could not set subtitle FPS", cause);
      setError(tr("Couldn't apply subtitle FPS. Try again."));
    } finally {
      if (request === applyRequestRef.current) setSaving(false);
    }
  };

  const selectOption = (value: string) => {
    if (value === "default") {
      void applySourceFps("default");
      return;
    }
    if (value === "auto") {
      if (videoFps != null) void applySourceFps(videoFps, "auto");
      return;
    }
    if (value === "custom") {
      setDraft(formatSubtitleFps(subtitleFps ?? videoFps ?? 25, 6));
      setCustomOpen(true);
      return;
    }
    const preset = SUBTITLE_FPS_PRESETS.find((item) => item.label === value);
    if (preset) void applySourceFps(preset.value);
  };

  const commitCustom = () => {
    const result = validateSubtitleFps(draft);
    if (!result.ok) {
      setError(tr("Enter an FPS from 1 to 240."));
      return;
    }
    void applySourceFps(result.value);
  };

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-edge-soft px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label={tr("Back")}
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <ArrowLeft size={15} strokeWidth={2.2} className="rtl:-scale-x-100" />
        </button>
        <p className="text-[13px] font-semibold text-ink">{tr("Subtitle FPS")}</p>
        {saving && (
          <span role="status" aria-label={tr("Saving")} className="ms-auto text-ink-muted">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="text-[11px] font-bold uppercase text-ink-subtle">
          {tr("Subtitle source FPS")}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">
          {tr("Choose the frame rate the subtitle was authored for.")}
        </p>

        <select
          value={customOpen ? "custom" : selectedValue}
          disabled={disabled}
          onChange={(event) => selectOption(event.currentTarget.value)}
          aria-label={tr("Subtitle source FPS")}
          className="mt-2 h-9 w-full rounded-md border border-edge-soft bg-canvas px-2 text-[12px] font-semibold text-ink outline-none transition-colors hover:bg-raised focus:border-accent disabled:cursor-not-allowed disabled:opacity-45"
        >
          <option value="default">{tr("No correction (default)")}</option>
          <option value="auto">
            {tr("Auto (match video)")}
            {videoFps == null ? "" : ` · ${formatSubtitleFps(videoFps, 6)}`}
          </option>
          {SUBTITLE_FPS_PRESETS.map((preset) => (
            <option key={preset.label} value={preset.label}>
              {preset.label}
            </option>
          ))}
          <option value="custom">{tr("Custom...")}</option>
        </select>

        {customOpen && !loading && (
          <form
            className="mt-2 flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              commitCustom();
            }}
          >
            <input
              type="number"
              value={draft}
              disabled={!availability.enabled || saving}
              inputMode="decimal"
              min="1"
              max="240"
              step="any"
              onChange={(event) => setDraft(event.currentTarget.value)}
              aria-label={tr("Custom subtitle FPS")}
              className="h-8 min-w-0 flex-1 rounded-md border border-edge-soft bg-canvas px-2 text-end font-mono text-[12px] tabular-nums text-ink outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-45"
            />
            <button
              type="submit"
              disabled={!availability.enabled || saving}
              aria-label={tr("Apply custom subtitle FPS")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-canvas transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Check size={15} strokeWidth={2.5} />
            </button>
          </form>
        )}

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
          <dt className="text-ink-muted">{tr("Video FPS")}</dt>
          <dd className="text-end font-mono font-semibold tabular-nums text-ink">
            {videoFps == null ? "-" : formatSubtitleFps(videoFps, 6)}
          </dd>
          <dt className="text-ink-muted">{tr("Subtitle source FPS")}</dt>
          <dd className="text-end font-mono font-semibold tabular-nums text-ink">
            {loading
              ? "-"
              : subtitleFps == null
                ? tr("No correction")
                : formatSubtitleFps(subtitleFps, 6)}
          </dd>
        </dl>
      </div>

      {(reason || error) && !loading && (
        <p
          className="mx-3 mb-3 rounded-md border border-edge-soft bg-raised/50 px-2 py-1.5 text-[11.5px] leading-snug text-ink-muted"
          role={error ? "alert" : undefined}
        >
          {error ?? reason}
        </p>
      )}
    </div>
  );
}

function unavailableMessage(
  reason: SubtitleFpsUnavailableReason,
  tr: (key: string) => string,
): string {
  switch (reason) {
    case "no-track":
      return tr("Select a subtitle track first.");
    case "html5":
      return tr("Subtitle FPS is only available with the libmpv player.");
    case "not-text-based":
      return tr("Subtitle FPS conversion is only available for text-based subtitles.");
    case "secondary-active":
      return tr("Subtitle FPS is unavailable while a secondary subtitle is active.");
    case "video-fps-unavailable":
      return tr("Video FPS is unavailable.");
    case "native-unavailable":
      return tr("Subtitle FPS is unavailable in this libmpv runtime.");
    case "auto-sync-active":
      return tr("Turn off Auto Sync before changing subtitle FPS.");
  }
}
