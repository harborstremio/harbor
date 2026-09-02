import { Check, ChevronDown, ImageDown, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { applyAppIcon } from "@/lib/app-icon";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { processLogoImage } from "./image-utils";
import { APP_ICON_PRESETS } from "./app-icon-presets";
import { LogoPreview } from "./logo-preview";

const PRESET_SRCS = APP_ICON_PRESETS.map((p) => p.src);

async function srcToDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

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
  const t = useT();
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
        className={`flex ${square ? "h-14 w-14" : "h-14 w-24"} shrink-0 items-center justify-center overflow-hidden rounded-md border border-edge-soft bg-elevated`}
      >
        {value ? (
          <img
            src={value}
            alt=""
            draggable={false}
            className="max-h-full max-w-full object-contain p-1.5"
          />
        ) : (
          <ImageDown size={18} strokeWidth={1.6} className="text-ink-subtle" />
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
        className="shrink-0 rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "…" : value ? t("Replace") : t("Upload")}
      </button>
      {value && !busy && (
        <button
          onClick={() => onChange("")}
          aria-label={t("Remove")}
          className="shrink-0 rounded-md bg-canvas p-2 text-ink-muted transition-colors hover:text-ink"
        >
          <Trash2 size={14} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

function TaskbarPreview({ srcs, active }: { srcs: string[]; active: number }) {
  return (
    <div className="flex h-12 items-center justify-center gap-2.5 rounded-md bg-canvas px-4">
      <span className="h-6 w-6 rounded-[4px] bg-ink/[0.10]" />
      <span className="h-6 w-6 rounded-[4px] bg-ink/[0.10]" />
      <span className="flex flex-col items-center">
        <span className="relative h-7 w-7 overflow-hidden rounded-[5px]">
          {srcs.map((s, i) => (
            <img
              key={s}
              src={s}
              alt=""
              draggable={false}
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-[1100ms] ease-in-out ${
                i === active ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
        </span>
        <span className="mt-[3px] h-[3px] w-4 rounded-full bg-accent" />
      </span>
      <span className="h-6 w-6 rounded-[4px] bg-ink/[0.10]" />
      <span className="h-6 w-6 rounded-[4px] bg-ink/[0.10]" />
    </div>
  );
}

function AppIconPicker() {
  const { settings, update } = useSettings();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rot, setRot] = useState(0);
  const presetId = settings.customAppIconPreset;
  const hasCustom = !!settings.customAppIcon && !presetId;
  const active = presetId || hasCustom;

  useEffect(() => {
    if (open) return;
    const id = window.setInterval(() => setRot((i) => (i + 1) % APP_ICON_PRESETS.length), 3000);
    return () => window.clearInterval(id);
  }, [open]);

  const pickPreset = async (id: string, src: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const dataUrl = await srcToDataUrl(src);
      if (dataUrl) update({ customAppIcon: dataUrl, customAppIconPreset: id });
    } finally {
      setBusy(false);
    }
  };
  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const processed = await processLogoImage(file, 256);
      if (processed) update({ customAppIcon: processed, customAppIconPreset: "" });
    } finally {
      setBusy(false);
    }
  };
  const applyNow = async () => {
    const res = await applyAppIcon(settings.customAppIcon);
    if (res.ok) {
      setApplied(true);
      window.setTimeout(() => setApplied(false), 1600);
    } else {
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2600);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center">
          {settings.customAppIcon ? (
            <img
              src={settings.customAppIcon}
              alt=""
              draggable={false}
              className="h-full w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-edge-soft bg-elevated">
              <ImageDown size={18} strokeWidth={1.6} className="text-ink-subtle" />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-medium text-ink">{t("App icon")}</span>
          <span className="text-[11.5px] leading-relaxed text-ink-subtle">
            {t(
              "The window and taskbar icon updates right away. The installed shortcut refreshes on the next update.",
            )}
          </span>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title={t("Use your own image as the app icon")}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-canvas px-3 py-1.5 text-[11.5px] font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-60"
        >
          <Upload size={12} strokeWidth={2.2} />
          {hasCustom ? t("Replace") : t("Upload")}
        </button>
        {active && (
          <button
            onClick={() => void applyNow()}
            title={t("Re-apply to the window and taskbar now")}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
              applied
                ? "border-accent bg-accent-soft text-accent"
                : failed
                  ? "border-danger bg-danger/15 text-danger"
                  : "border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
            }`}
          >
            {applied ? (
              <Check size={12} strokeWidth={2.6} />
            ) : (
              <RefreshCw size={12} strokeWidth={2.2} />
            )}
            {applied ? t("Applied") : failed ? t("Could not apply") : t("Apply now")}
          </button>
        )}
        {active && (
          <button
            onClick={() => update({ customAppIcon: "", customAppIconPreset: "" })}
            className="shrink-0 rounded-md bg-canvas px-3 py-1.5 text-[11.5px] font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            {t("Reset")}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-4 rounded-md bg-canvas p-3 text-start transition-colors hover:bg-surface"
      >
        <div className="w-[172px] shrink-0">
          <TaskbarPreview srcs={PRESET_SRCS} active={rot} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold text-ink">{t("Or try one of ours")}</span>
          <span className="text-[11.5px] text-ink-subtle">
            {t("{n} Harbor icons", { n: APP_ICON_PRESETS.length })}
          </span>
        </div>
        <ChevronDown
          size={18}
          strokeWidth={2.2}
          className={`shrink-0 text-ink-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="grid grid-cols-4 gap-x-3 gap-y-3.5 pt-1 sm:grid-cols-6 animate-fade-in">
          {APP_ICON_PRESETS.map((p) => {
            const selected = presetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => void pickPreset(p.id, p.src)}
                disabled={busy}
                className="group flex flex-col items-center gap-1.5"
              >
                <span className="relative aspect-square w-full transition-transform duration-200 group-active:scale-[0.96]">
                  <img
                    src={p.src}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
                  />
                  {selected && (
                    <span className="pointer-events-none absolute -inset-[3px] rounded-[28%] ring-2 ring-accent" />
                  )}
                  {selected && (
                    <span className="absolute -end-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent text-canvas shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span
                  className={`w-full truncate text-center text-[10.5px] font-medium ${
                    selected ? "text-accent" : "text-ink-subtle"
                  }`}
                >
                  {p.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="group flex flex-col items-center gap-1.5"
          >
            <span
              className={`relative flex aspect-square w-full items-center justify-center rounded-[22%] border border-dashed transition group-active:scale-[0.96] ${
                hasCustom
                  ? "border-accent bg-accent-soft"
                  : "border-edge-soft text-ink-subtle group-hover:border-edge group-hover:text-ink"
              }`}
            >
              {hasCustom ? (
                <img
                  src={settings.customAppIcon}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-contain"
                />
              ) : (
                <Upload size={16} strokeWidth={2} />
              )}
              {hasCustom && (
                <span className="absolute end-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-canvas">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </span>
            <span
              className={`text-[10.5px] font-medium ${hasCustom ? "text-accent" : "text-ink-subtle"}`}
            >
              {t("Upload")}
            </span>
          </button>
        </div>
      )}
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
    </div>
  );
}

export function LogoPicker() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <div className="flex flex-col gap-5">
      <LogoPreview
        mark={settings.customLogoMark}
        wordmark={settings.customLogoWordmark}
        icon={settings.customAppIcon}
      />
      <div className="flex flex-col gap-4">
        <LogoSlot
          label={t("App logo")}
          hint={t("Square mark in the sidebar. Transparent PNG or SVG works best.")}
          value={settings.customLogoMark}
          square
          maxDim={256}
          onChange={(v) => update({ customLogoMark: v })}
        />
        <LogoSlot
          label={t("Wordmark")}
          hint={t("Wide logo shown beside the mark when the sidebar is expanded.")}
          value={settings.customLogoWordmark}
          maxDim={512}
          onChange={(v) => update({ customLogoWordmark: v })}
        />
      </div>
      <AppIconPicker />
    </div>
  );
}
