import { Image as ImageIcon, Layers, RotateCcw, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import type { PlayerControlId } from "@/lib/player-chrome";
import { getIconPresets, presetThumb, type IconPreset } from "@/lib/player-icon-presets";
import { tvFocus } from "@/lib/keyboard-navigation";
import { useT } from "@/lib/i18n";
import { stripArrowKeys } from "../shared";

const OVERLAY_LABEL =
  "text-[13px] font-extrabold uppercase leading-[17px] tracking-[0.72px]";
const ICON_BTN =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/15 hover:text-white";

const MAX_BYTES = 256 * 1024;
const WARN_BYTES = Math.floor(MAX_BYTES * 0.8);
const MIN_DIM = 16;
const MAX_DIM = 512;

const SVG_STRIP =
  /<script[\s\S]*?<\/script>|\son\w+="[^"]*"|\son\w+='[^']*'|\s(?:xlink:href|href)="(?:javascript:|data:text\/html)[^"]*"/gi;

export function IconUpload({
  currentUrl,
  replaceable,
  onUpload,
  onReset,
  states,
  onApplyToAll,
  controlId,
}: {
  currentUrl: string | undefined;
  replaceable: boolean;
  onUpload: (dataUrl: string, state?: string) => void;
  onReset: (state?: string) => void;
  states?: readonly { id: string; label: string; url: string | undefined }[];
  onApplyToAll?: (dataUrl: string) => void;
  controlId?: PlayerControlId;
}) {
  const t = useT();
  if (!replaceable) {
    return (
      <span
        className={`flex h-11 items-center whitespace-nowrap rounded-md bg-white/4 px-3.5 ${OVERLAY_LABEL} text-white/60`}
      >
        {t("Icon locked")}
      </span>
    );
  }
  const presets = controlId ? getIconPresets(controlId) : [];
  const uploadUI =
    states && states.length > 0 ? (
      <MultiStateUpload
        states={states}
        onUpload={onUpload}
        onReset={onReset}
        onApplyToAll={onApplyToAll}
      />
    ) : (
      <SingleUpload currentUrl={currentUrl} onUpload={onUpload} onReset={onReset} />
    );
  if (presets.length === 0) return uploadUI;
  return (
    <div className="flex items-center gap-2">
      <PresetRow presets={presets} onUpload={onUpload} />
      <span className="h-6 w-px shrink-0 bg-white/10" />
      {uploadUI}
    </div>
  );
}

function PresetRow({
  presets,
  onUpload,
}: {
  presets: IconPreset[];
  onUpload: (dataUrl: string, state?: string) => void;
}) {
  const t = useT();
  const apply = (p: IconPreset) => {
    for (const [state, url] of Object.entries(p.icons))
      onUpload(url, state === "default" ? undefined : state);
  };
  return (
    <div className="flex items-center gap-1">
      <span className={`${OVERLAY_LABEL} text-white/60`}>{t("Preset")}</span>
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => apply(p)}
          title={t("{label} icons", { label: t(p.label) })}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/6 transition-colors hover:border-accent hover:bg-white/12"
        >
          <img
            src={presetThumb(p)}
            alt={t(p.label)}
            className="h-6 w-6 object-contain"
            draggable={false}
          />
        </button>
      ))}
    </div>
  );
}

function SingleUpload({
  currentUrl,
  onUpload,
  onReset,
  label,
}: {
  currentUrl: string | undefined;
  onUpload: (dataUrl: string, state?: string) => void;
  onReset: (state?: string) => void;
  label?: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const pickRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setWarning(null);
    if (!/^image\//.test(file.type)) {
      window.alert(t("Please choose a PNG, SVG, JPG, or WebP image."));
      return;
    }
    if (file.size > MAX_BYTES) {
      window.alert(
        t("Icon must be under {max} KB. Yours is {size} KB.", {
          max: Math.round(MAX_BYTES / 1024),
          size: Math.round(file.size / 1024),
        }),
      );
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readAsDataURL(file);
      const sanitized = file.type === "image/svg+xml" ? sanitizeSvgDataUrl(dataUrl) : dataUrl;
      const dims = await probeImage(sanitized);
      const messages: string[] = [];
      if (file.size > WARN_BYTES)
        messages.push(t("large file ({size} KB)", { size: Math.round(file.size / 1024) }));
      if (dims && (dims.w < MIN_DIM || dims.h < MIN_DIM))
        messages.push(t("tiny ({width}×{height}px)", { width: dims.w, height: dims.h }));
      if (dims && (dims.w > MAX_DIM || dims.h > MAX_DIM))
        messages.push(t("huge ({width}×{height}px)", { width: dims.w, height: dims.h }));
      if (messages.length > 0) setWarning(messages.join(" · "));
      onUpload(sanitized);
    } catch (err) {
      window.alert(
        err instanceof Error && err.message === "Unexpected file contents."
          ? t("Unexpected file contents.")
          : t("Could not read the file."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex items-center gap-1"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <Thumb
        currentUrl={currentUrl}
        busy={busy}
        dragOver={dragOver}
        warning={warning}
        label={label}
      />
      <PickButton btnRef={pickRef} onPick={(f) => void handleFile(f)} busy={busy} />
      {currentUrl && (
        <ResetButton
          btnRef={resetRef}
          onClick={() => {
            if (pickRef.current && document.activeElement === resetRef.current)
              tvFocus(pickRef.current);
            onReset();
          }}
        />
      )}
    </div>
  );
}

function MultiStateUpload({
  states,
  onUpload,
  onReset,
  onApplyToAll,
}: {
  states: readonly { id: string; label: string; url: string | undefined }[];
  onUpload: (dataUrl: string, state?: string) => void;
  onReset: (state?: string) => void;
  onApplyToAll?: (dataUrl: string) => void;
}) {
  const t = useT();
  const [activeState, setActiveState] = useState(states[0]?.id);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = states.find((s) => s.id === activeState) ?? states[0];
  if (!active) return null;
  return (
    <div className="flex items-center gap-2">
      <div
        onKeyDown={stripArrowKeys(btnRefs, (i) => setActiveState(states[i].id))}
        className="flex items-center gap-0.5 rounded-md bg-white/8 p-0.5"
      >
        {states.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            onClick={() => setActiveState(s.id)}
            className={`flex h-11 items-center gap-2 rounded-md px-3 text-[15px] font-medium transition-colors ${
              s.id === active.id ? "bg-white/18 text-white" : "text-white/70 hover:text-white"
            }`}
          >
            {s.url && <span className="h-2 w-2 rounded-full bg-success" />}
            {t(s.label)}
          </button>
        ))}
      </div>
      <SingleUpload
        currentUrl={active.url}
        onUpload={(url) => onUpload(url, active.id)}
        onReset={() => onReset(active.id)}
        label={t(active.label)}
      />
      {onApplyToAll && active.url && (
        <button
          type="button"
          onClick={() => onApplyToAll(active.url!)}
          title={t("Use this icon for all states")}
          className={ICON_BTN}
        >
          <Layers size={18} strokeWidth={2.3} />
        </button>
      )}
    </div>
  );
}

function Thumb({
  currentUrl,
  busy,
  dragOver,
  warning,
  label,
}: {
  currentUrl: string | undefined;
  busy: boolean;
  dragOver: boolean;
  warning: string | null;
  label?: string;
}) {
  const t = useT();
  return (
    <div
      title={warning ?? (label ? t("{label} icon", { label }) : undefined)}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white/8 transition-colors ${
        dragOver
          ? "border-accent ring-2 ring-accent"
          : warning
            ? "border-accent/40"
            : "border-white/12"
      }`}
    >
      {busy ? (
        <Spinner />
      ) : currentUrl ? (
        <img src={currentUrl} alt="" className="h-7 w-7 object-contain" draggable={false} />
      ) : (
        <ImageIcon size={18} className="text-white/50" strokeWidth={2.1} />
      )}
      {warning && !busy && (
        <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-1 ring-black/40" />
      )}
    </div>
  );
}

function PickButton({
  onPick,
  busy,
  btnRef,
}: {
  onPick: (file: File | undefined) => void;
  busy: boolean;
  btnRef?: React.Ref<HTMLButtonElement>;
}) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/svg+xml,image/webp,image/jpeg,image/jpg"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
        className="hidden"
      />
      <button
        ref={btnRef}
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        title={t("Upload icon")}
        aria-label={t("Upload icon")}
        className={`${ICON_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <Upload size={18} strokeWidth={2.3} />
      </button>
    </>
  );
}

function ResetButton({
  onClick,
  btnRef,
}: {
  onClick: () => void;
  btnRef?: React.Ref<HTMLButtonElement>;
}) {
  const t = useT();
  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onClick}
      title={t("Reset to default")}
      aria-label={t("Reset icon")}
      className={ICON_BTN}
    >
      <RotateCcw size={18} strokeWidth={2.3} />
    </button>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
  );
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") resolve(r);
      else reject(new Error("Unexpected file contents."));
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function probeImage(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function sanitizeSvgDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/svg\+xml;base64,(.+)$/);
  if (!match) return dataUrl;
  try {
    const decoded = atob(match[1]);
    const cleaned = decoded.replace(SVG_STRIP, "");
    return `data:image/svg+xml;base64,${btoa(cleaned)}`;
  } catch {
    return dataUrl;
  }
}
