import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
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
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!customOpen || loading) return;
    const field = customInputRef.current;
    if (!field) return;
    field.focus();
    field.select();
  }, [customOpen, loading]);

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

      <div className="px-3 pb-3 pt-2.5">
        <p className="text-[11.5px] leading-snug text-ink-muted">
          {tr("Choose the frame rate the subtitle was authored for.")}
        </p>

        <div className={`mt-2 ${disabled ? "pointer-events-none opacity-45" : ""}`}>
          <Dropdown
            size="sm"
            value={customOpen ? "custom" : selectedValue}
            onChange={selectOption}
            className="w-full"
            options={[
              { value: "default", label: tr("No correction (default)") },
              {
                value: "auto",
                label:
                  videoFps == null
                    ? tr("Auto (match video)")
                    : `${tr("Auto (match video)")} · ${formatSubtitleFps(videoFps, 6)}`,
              },
              ...SUBTITLE_FPS_PRESETS.map((preset) => ({
                value: preset.label,
                label: preset.label,
              })),
              { value: "custom", label: tr("Custom...") },
            ]}
          />
        </div>

        {customOpen && !loading && (
          <form
            className="animate-item-in mt-2 flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              commitCustom();
            }}
          >
            <input
              ref={customInputRef}
              type="number"
              value={draft}
              disabled={!availability.enabled || saving}
              inputMode="decimal"
              min="1"
              max="240"
              step="any"
              onChange={(event) => setDraft(event.currentTarget.value)}
              aria-label={tr("Custom subtitle FPS")}
              className="h-9 min-w-0 flex-1 rounded-md bg-canvas px-2.5 text-end font-mono text-[12.5px] tabular-nums text-ink outline-none transition-colors focus:bg-raised disabled:cursor-not-allowed disabled:opacity-45"
            />
            <button
              type="submit"
              disabled={!availability.enabled || saving}
              aria-label={tr("Apply custom subtitle FPS")}
              className="harbor-press-pop flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink text-canvas transition-transform disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Check size={15} strokeWidth={2.5} />
            </button>
          </form>
        )}

        <dl className="mt-3 flex flex-col gap-1.5 border-t border-edge-soft pt-2.5 text-[11.5px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-subtle">{tr("Video FPS")}</dt>
            <dd className="font-mono font-semibold tabular-nums text-ink">
              {videoFps == null ? "-" : formatSubtitleFps(videoFps, 6)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-subtle">{tr("Subtitle source FPS")}</dt>
            <dd className="font-mono font-semibold tabular-nums text-ink">
              {loading
                ? "-"
                : subtitleFps == null
                  ? tr("No correction")
                  : formatSubtitleFps(subtitleFps, 6)}
            </dd>
          </div>
        </dl>

        {(reason || error) && !loading && (
          <p
            className={`mt-2.5 text-[11.5px] leading-snug ${error ? "text-danger" : "text-ink-subtle"}`}
            role={error ? "alert" : undefined}
          >
            {error ?? reason}
          </p>
        )}
      </div>
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
