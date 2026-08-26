import { AlertTriangle, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";

const ACCEPTED_TYPES = "image/png,image/gif,image/webp,image/jpeg,image/svg+xml,.svg";
const MAX_GIF_SIZE = 2 * 1024 * 1024;
const MAX_SVG_SIZE = 512 * 1024;
const MAX_RASTER_SOURCE = 16 * 1024 * 1024;
const MAX_STORED_BYTES = 1.5 * 1024 * 1024;

type Result = { url: string } | { error: string };

export function SeekImageUpload({
  value,
  onSelect,
  onClear,
  emptyTitle,
  hint,
  targetDim = 512,
  targetQuality = 0.9,
}: {
  value: string;
  onSelect: (dataUrl: string) => void;
  onClear: () => void;
  emptyTitle: string;
  hint: string;
  targetDim?: number;
  targetQuality?: number;
}) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const result = await processSeekImage(file, targetDim, targetQuality);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSelect(result.url);
    } catch (e) {
      console.warn("[seek-image] processing failed", e);
      setError(t("Couldn't read that image. Try a different file."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border bg-canvas/40 p-3 transition-colors duration-200 ${
        error ? "border-danger/60" : "border-edge-soft"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-raised transition-colors duration-200"
          style={{
            backgroundImage: value
              ? `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04), transparent 70%)`
              : undefined,
          }}
        >
          <ImageIcon
            size={20}
            strokeWidth={1.6}
            className={`absolute text-ink-subtle transition-all duration-300 ${
              value ? "scale-50 opacity-0" : "scale-100 opacity-100"
            }`}
          />
          <img
            key={value || "empty"}
            src={value || "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="}
            alt=""
            className={`h-12 w-12 object-contain transition-all duration-300 ease-out ${
              value ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-75 opacity-0"
            }`}
          />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-canvas/60 backdrop-blur-sm">
              <Loader2 size={16} className="animate-spin text-ink-muted" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-[12.5px] font-medium text-ink">
            {value ? t("Custom image loaded") : emptyTitle}
          </p>
          <p className="text-[11px] leading-snug text-ink-subtle">{hint}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="flex h-9 items-center gap-1.5 rounded-full bg-raised px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:cursor-wait disabled:opacity-60"
        >
          <Upload size={12} strokeWidth={2.2} />
          {busy ? t("Processing") : value ? t("Replace") : t("Upload")}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            onClear();
          }}
          disabled={!value}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-raised text-ink-muted transition-all duration-200 hover:bg-danger hover:text-white disabled:pointer-events-none disabled:scale-90 disabled:opacity-0"
          aria-label={t("Remove image")}
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-danger/15 px-2.5 py-2 text-[11.5px] leading-snug text-danger ring-1 ring-danger/30">
          <AlertTriangle size={13} strokeWidth={2.4} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function openSeekImageDialog(setBusy?: (b: boolean) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPTED_TYPES;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      setBusy?.(true);
      try {
        const r = await processSeekImage(f, 512, 0.9);
        resolve("url" in r ? r.url : null);
      } finally {
        setBusy?.(false);
      }
    };
    input.click();
  });
}

async function processSeekImage(file: File, maxDim: number, quality: number): Promise<Result> {
  const lowerName = file.name.toLowerCase();
  const isSvg = file.type === "image/svg+xml" || lowerName.endsWith(".svg");
  const isGif = file.type === "image/gif" || lowerName.endsWith(".gif");

  if (isSvg) {
    if (file.size > MAX_SVG_SIZE) {
      return {
        error: `That SVG is ${formatBytes(file.size)} (max 512 KB). Optimize it at svgomg or save it smaller and try again.`,
      };
    }
    const text = await file.text();
    const utf8 = unescape(encodeURIComponent(text));
    return { url: `data:image/svg+xml;base64,${btoa(utf8)}` };
  }

  if (isGif) {
    if (file.size > MAX_GIF_SIZE) {
      return {
        error: `Animated GIFs are kept as-is to preserve animation, but this one is ${formatBytes(file.size)} and the cap is 2 MB. Try a shorter or lower-frame-rate version.`,
      };
    }
    const url = await readAsDataUrl(file);
    return { url };
  }

  if (file.size > MAX_RASTER_SOURCE) {
    return {
      error: `That file is ${formatBytes(file.size)}. Source images need to be under 16 MB before resizing.`,
    };
  }

  const sourceUrl = await readAsDataUrl(file);
  const downsized = await downsizeRaster(sourceUrl, maxDim, quality);
  if (!downsized) return { error: "Couldn't read that image. Try a PNG, JPEG, or WebP." };
  if (downsized.length > MAX_STORED_BYTES) {
    const tighter = await downsizeRaster(sourceUrl, Math.round(maxDim / 2), 0.82);
    if (tighter && tighter.length <= MAX_STORED_BYTES) return { url: tighter };
    return {
      error: "Even after auto-shrinking this image is still too big to store. Try one with a tighter crop.",
    };
  }
  return { url: downsized };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader returned non-string"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

async function downsizeRaster(dataUrl: string, maxDim: number, quality: number): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(null);
          return;
        }
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const tw = Math.max(16, Math.round(w * scale));
        const th = Math.max(16, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, tw, th);
        const webp = canvas.toDataURL("image/webp", quality);
        if (webp.startsWith("data:image/webp")) {
          resolve(webp);
          return;
        }
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}
