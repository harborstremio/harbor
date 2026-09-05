import { fillStyle } from "@/components/slider";
import { AlertCircle, ImageDown, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { ROW_ACTION, ROW_ACTION_PRIMARY, SettingRow } from "../kit";
import { processBackgroundImage } from "./image-utils";

export function BackgroundPicker({
  imageData,
  dim,
  onImageChange,
  onDimChange,
}: {
  imageData: string | null;
  dim: number;
  onImageChange: (data: string | null) => void;
  onDimChange: (dim: number) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const justSetRef = useRef(false);

  const flashError = (text: string) => {
    setError(text);
    if (errorTimerRef.current != null) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => setError(null), 6000);
  };

  useEffect(
    () => () => {
      if (errorTimerRef.current != null) window.clearTimeout(errorTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (justSetRef.current && !imageData) {
      flashError(
        t(
          "Couldn't save that background. Your local storage is full. Try a smaller crop or clear cached data.",
        ),
      );
      justSetRef.current = false;
    } else if (imageData) {
      justSetRef.current = false;
    }
  }, [imageData]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const processed = await processBackgroundImage(file);
      if (!processed) {
        flashError(
          t("Couldn't compress this image small enough. Try a different photo or crop it down."),
        );
        return;
      }
      justSetRef.current = true;
      onImageChange(processed);
    } catch {
      flashError(t("Couldn't read that image. Try a different file."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-elevated">
        {imageData ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${imageData})` }}
            />
            <div className="absolute inset-0 bg-canvas/[0.45]" />
            <div className="absolute inset-0 bg-canvas" style={{ opacity: dim }} />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-subtle">
            <ImageDown size={32} strokeWidth={1.6} />
            <p className="text-[15.5px]">{t("No background image")}</p>
          </div>
        )}
        <div className="relative z-10 flex h-full flex-col items-start justify-end gap-1 p-5">
          <p className="harbor-settings-label">{t("Live preview")}</p>
          <p className="font-display text-[26px] font-medium tracking-tight text-ink">
            {t("Tonight's picks")}
          </p>
          <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
            {t("Both serif and body text should stay legible at this dim.")}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0] ?? null;
            e.currentTarget.value = "";
            void onFile(f);
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={ROW_ACTION_PRIMARY}
        >
          <ImageDown size={18} strokeWidth={2.2} />
          {busy ? t("Compressing…") : imageData ? t("Replace image") : t("Choose image")}
        </button>
        {imageData && !busy && (
          <button
            onClick={() => onImageChange(null)}
            className={ROW_ACTION}
          >
            <Trash2 size={18} strokeWidth={2.2} />
            {t("Remove")}
          </button>
        )}
        <p className="ms-auto max-w-[66ch] text-[15.5px] text-ink-subtle">
          {t("JPEG / PNG / WebP. Big files auto-compress to fit.")}
        </p>
      </div>
      {error && (
        <div className="flex animate-fade-in items-start gap-2.5 rounded-[10px] border border-danger/30 bg-elevated px-4 py-3 text-[15.5px] leading-[22px] text-danger">
          <AlertCircle size={18} strokeWidth={2.2} className="mt-[2px] shrink-0 text-danger" />
          <span className="max-w-[66ch]">{error}</span>
        </div>
      )}
      <SettingRow
        wide
        label={t("Dim overlay")}
        desc={t(
          "0% shows the raw image. 100% covers it with the theme color. 60-80% is the readable sweet spot.",
        )}
      >
        <div className="flex w-full max-w-[520px] flex-wrap items-center gap-4">
          <input
            type="range"
            aria-label={t("Dim overlay")}
            min={0}
            max={100}
            step={5}
            value={Math.round(dim * 100)}
            onChange={(e) => onDimChange(parseInt(e.currentTarget.value, 10) / 100)}
            className="harbor-slider h-11 min-w-0 flex-1"
            style={fillStyle(Math.round(dim * 100), 0, 100, 5)}
          />
          <span className="w-[64px] shrink-0 text-end text-[15.5px] font-semibold tabular-nums text-ink">
            {Math.round(dim * 100)}%
          </span>
        </div>
      </SettingRow>
    </div>
  );
}
