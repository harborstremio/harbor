import { Image as ImageIcon, Layers, RotateCcw, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

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
}: {
  currentUrl: string | undefined;
  replaceable: boolean;
  onUpload: (dataUrl: string, state?: string) => void;
  onReset: (state?: string) => void;
  states?: readonly { id: string; label: string; url: string | undefined }[];
  onApplyToAll?: (dataUrl: string) => void;
}) {
  if (!replaceable) {
    return (
      <span className="flex h-9 items-center whitespace-nowrap rounded-lg bg-white/4 px-3 text-[10px] uppercase tracking-[0.16em] text-white/35">
        Icon locked
      </span>
    );
  }
  if (states && states.length > 0) {
    return <MultiStateUpload states={states} onUpload={onUpload} onReset={onReset} onApplyToAll={onApplyToAll} />;
  }
  return <SingleUpload currentUrl={currentUrl} onUpload={onUpload} onReset={onReset} />;
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
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setWarning(null);
    if (!/^image\//.test(file.type)) {
      window.alert("Please choose a PNG, SVG, JPG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      window.alert(
        `Icon must be under ${Math.round(MAX_BYTES / 1024)} KB. Yours is ${Math.round(file.size / 1024)} KB.`,
      );
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readAsDataURL(file);
      const sanitized = file.type === "image/svg+xml" ? sanitizeSvgDataUrl(dataUrl) : dataUrl;
      const dims = await probeImage(sanitized);
      const messages: string[] = [];
      if (file.size > WARN_BYTES) messages.push(`large file (${Math.round(file.size / 1024)} KB)`);
      if (dims && (dims.w < MIN_DIM || dims.h < MIN_DIM)) messages.push(`tiny (${dims.w}×${dims.h}px)`);
      if (dims && (dims.w > MAX_DIM || dims.h > MAX_DIM)) messages.push(`huge (${dims.w}×${dims.h}px)`);
      if (messages.length > 0) setWarning(messages.join(" · "));
      onUpload(sanitized);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not read the file.");
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
      <Thumb currentUrl={currentUrl} busy={busy} dragOver={dragOver} warning={warning} label={label} />
      <PickButton onPick={(f) => void handleFile(f)} busy={busy} />
      {currentUrl && <ResetButton onClick={onReset} />}
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
  const [activeState, setActiveState] = useState(states[0]?.id);
  const active = states.find((s) => s.id === activeState) ?? states[0];
  if (!active) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 rounded-lg bg-white/8 p-0.5">
        {states.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveState(s.id)}
            className={`flex h-8 items-center gap-1 rounded-md px-2 text-[10.5px] font-medium uppercase tracking-[0.08em] transition-colors ${
              s.id === active.id ? "bg-white/18 text-white" : "text-white/55 hover:text-white/85"
            }`}
          >
            {s.url && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
            {s.label}
          </button>
        ))}
      </div>
      <SingleUpload
        currentUrl={active.url}
        onUpload={(url) => onUpload(url, active.id)}
        onReset={() => onReset(active.id)}
        label={active.label}
      />
      {onApplyToAll && active.url && (
        <button
          type="button"
          onClick={() => onApplyToAll(active.url!)}
          title="Use this icon for all states"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/15 hover:text-white"
        >
          <Layers size={13} strokeWidth={2.3} />
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
  return (
    <div
      title={warning ?? (label ? `${label} icon` : undefined)}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white/8 transition-colors ${
        dragOver ? "border-accent ring-2 ring-accent/40" : warning ? "border-amber-300/40" : "border-white/12"
      }`}
    >
      {busy ? (
        <Spinner />
      ) : currentUrl ? (
        <img src={currentUrl} alt="" className="h-6 w-6 object-contain" draggable={false} />
      ) : (
        <ImageIcon size={14} className="text-white/40" strokeWidth={2.1} />
      )}
      {warning && !busy && (
        <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-300 ring-1 ring-black/40" />
      )}
    </div>
  );
}

function PickButton({ onPick, busy }: { onPick: (file: File | undefined) => void; busy: boolean }) {
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
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        title="Upload icon"
        aria-label="Upload icon"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Upload size={14} strokeWidth={2.3} />
      </button>
    </>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Reset to default"
      aria-label="Reset icon"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/15 hover:text-white"
    >
      <RotateCcw size={13} strokeWidth={2.3} />
    </button>
  );
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />;
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
