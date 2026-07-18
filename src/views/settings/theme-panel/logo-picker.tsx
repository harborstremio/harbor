import { ImageDown, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { processLogoImage } from "./image-utils";

function LogoSlot({
  label,
  hint,
  value,
  square,
  maxDim,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  square?: boolean;
  maxDim: number;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const processed = await processLogoImage(file, maxDim);
      if (processed) onChange(processed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-4">
      <div
        className={`flex ${square ? "h-16 w-16" : "h-16 w-28"} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-edge-soft bg-elevated/30`}
      >
        {value ? (
          <img
            src={value}
            alt=""
            draggable={false}
            className="max-h-full max-w-full object-contain p-1.5"
          />
        ) : (
          <ImageDown size={20} strokeWidth={1.6} className="text-ink-subtle" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="text-[11.5px] leading-relaxed text-ink-subtle">{hint}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml,image/webp,image/x-icon"
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
        className="shrink-0 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "…" : value ? "Replace" : "Upload"}
      </button>
      {value && !busy && (
        <button
          onClick={() => onChange("")}
          aria-label="Remove"
          className="shrink-0 rounded-full border border-edge-soft p-2 text-ink-muted transition-colors hover:border-edge hover:text-ink"
        >
          <Trash2 size={13} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

export function LogoPicker() {
  const { settings, update } = useSettings();
  return (
    <div className="flex flex-col gap-4">
      <LogoSlot
        label="App logo"
        hint="Square mark in the sidebar. Transparent PNG or SVG works best."
        value={settings.customLogoMark}
        square
        maxDim={256}
        onChange={(v) => update({ customLogoMark: v })}
      />
      <LogoSlot
        label="Wordmark"
        hint="Wide logo shown beside the mark when the sidebar is expanded."
        value={settings.customLogoWordmark}
        maxDim={512}
        onChange={(v) => update({ customLogoWordmark: v })}
      />
      <LogoSlot
        label="App icon"
        hint="Window and taskbar icon while Harbor runs. Takes effect after the next update. The file's icon in Explorer stays the built-in one."
        value={settings.customAppIcon}
        square
        maxDim={256}
        onChange={(v) => update({ customAppIcon: v })}
      />
    </div>
  );
}
