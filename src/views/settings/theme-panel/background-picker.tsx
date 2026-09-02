import { fillStyle } from "@/components/slider";
import { AlertCircle, ImageDown, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
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
            <div className="absolute inset-0" style={{ background: "black", opacity: 0.45 }} />
            <div className="absolute inset-0 bg-canvas" style={{ opacity: dim }} />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-subtle">
            <ImageDown size={32} strokeWidth={1.6} />
            <p className="text-[13px]">{t("No background image")}</p>
          </div>
        )}
        <div className="relative z-10 flex h-full flex-col items-start justify-end gap-1 p-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.32em] text-ink-subtle">
            {t("Live preview")}
          </p>
          <p className="font-display text-[26px] font-medium tracking-tight text-ink">
            {t("Tonight's picks")}
          </p>
          <p className="text-[12.5px] text-ink-muted">
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
          className="flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ImageDown size={14} strokeWidth={2.2} />
          {busy ? t("Compressing…") : imageData ? t("Replace image") : t("Choose image")}
        </button>
        {imageData && !busy && (
          <button
            onClick={() => onImageChange(null)}
            className="flex items-center gap-2 rounded-md bg-canvas px-5 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <Trash2 size={14} strokeWidth={2.2} />
            {t("Remove")}
          </button>
        )}
        <p className="ms-auto text-[11.5px] text-ink-subtle">
          {t("JPEG / PNG / WebP. Big files auto-compress to fit.")}
        </p>
      </div>
      {error && (
        <div className="flex animate-fade-in items-start gap-2.5 rounded-md border border-danger/30 bg-danger/[0.08] px-4 py-3 text-[12.5px] leading-relaxed text-danger">
          <AlertCircle size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-danger" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label className="text-[13px] font-medium text-ink">{t("Dim overlay")}</label>
          <span className="text-[12.5px] tabular-nums text-ink-subtle">
            {Math.round(dim * 100)}%
          </span>
        </div>
        <input
          type="range"
          aria-label={t("Dim overlay")}
          min={0}
          max={100}
          value={Math.round(dim * 100)}
          onChange={(e) => onDimChange(parseInt(e.currentTarget.value, 10) / 100)}
          className="harbor-slider w-full"
          style={fillStyle(Math.round(dim * 100), 0, 100)}
        />
        <p className="text-[11.5px] leading-relaxed text-ink-subtle">
          {t(
            "0% shows the raw image. 100% covers it with the theme color. 60-80% is the readable sweet spot.",
          )}
        </p>
      </div>
    </div>
  );
}
