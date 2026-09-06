import { Check, ChevronDown, ImageDown, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { applyAppIcon } from "@/lib/app-icon";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SettingRow } from "../kit";
import { SButton, SRow } from "../ui";
import { processLogoImage } from "./image-utils";
import { APP_ICON_PRESETS } from "./app-icon-presets";

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
    <SettingRow label={label} desc={hint}>
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
      <span
        className={`flex ${square ? "h-14 w-14" : "h-14 w-24"} shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-edge-soft bg-elevated`}
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
      </span>
      <SButton onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? t("Working…") : value ? t("Replace") : t("Upload")}
      </SButton>
      {value && !busy && (
        <SButton variant="danger" onClick={() => onChange("")} title={t("Remove")}>
          <Trash2 size={18} strokeWidth={2.2} />
        </SButton>
      )}
    </SettingRow>
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
    const id = window.setInterval(() => setRot((i) => (i + 1) % APP_ICON_PRESETS.length), 3000);
    return () => window.clearInterval(id);
  }, []);

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
    <div className="harbor-settings-group">
      <SettingRow
        wide
        label={t("App icon")}
        desc={t(
          "The window and taskbar icon updates right away. The installed shortcut refreshes on the next update.",
        )}
      >
        <div className="flex w-full flex-wrap items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center">
            {settings.customAppIcon ? (
              <img
                src={settings.customAppIcon}
                alt=""
                draggable={false}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center rounded-[10px] border border-dashed border-edge-soft bg-elevated">
                <ImageDown size={20} strokeWidth={1.6} className="text-ink-subtle" />
              </span>
            )}
          </span>
          <SButton
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title={t("Use your own image as the app icon")}
          >
            <Upload size={18} strokeWidth={2.2} />
            {hasCustom ? t("Replace") : t("Upload")}
          </SButton>
          {active && (
            <SButton
              variant={failed ? "danger" : "secondary"}
              onClick={() => void applyNow()}
              title={t("Re-apply to the window and taskbar now")}
            >
              {applied ? (
                <Check size={18} strokeWidth={2.6} className="text-accent" />
              ) : (
                <RefreshCw size={18} strokeWidth={2.2} />
              )}
              {applied ? t("Applied") : failed ? t("Could not apply") : t("Apply now")}
            </SButton>
          )}
          {active && (
            <SButton onClick={() => update({ customAppIcon: "", customAppIconPreset: "" })}>
              {t("Reset")}
            </SButton>
          )}
        </div>
      </SettingRow>

      <SRow
        title={t("Or try one of ours")}
        description={t("{n} Harbor icons", { n: APP_ICON_PRESETS.length })}
        onClick={() => setOpen((o) => !o)}
        trailing={
          <ChevronDown
            size={20}
            strokeWidth={2.2}
            className={`shrink-0 text-ink-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        }
      />

      {open && (
        <div className="animate-fade-in flex flex-col gap-3 pt-1">
          <span className="harbor-settings-label">{t("On the taskbar")}</span>
          <div className="w-[172px]">
            <TaskbarPreview srcs={PRESET_SRCS} active={rot} />
          </div>
        </div>
      )}

      {open && (
        <div className="animate-fade-in grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 pt-1">
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
                    className="h-full w-full object-contain"
                  />
                  {selected && (
                    <span className="pointer-events-none absolute -inset-[3px] rounded-[28%] ring-2 ring-accent" />
                  )}
                  {selected && (
                    <span className="absolute -end-1 -top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-canvas">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span
                  className={`w-full break-words text-center text-[15.5px] font-medium leading-[22px] ${
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
              className={`text-[15.5px] font-medium leading-[22px] ${hasCustom ? "text-accent" : "text-ink-subtle"}`}
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
      <div className="harbor-settings-group">
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
