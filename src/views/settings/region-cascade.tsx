import { X } from "./icons";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalExit } from "@/components/modal-shell";
import { captureFocusReturn } from "@/lib/keyboard-navigation";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { normalizeLanguage, setUiLanguage, useT } from "@/lib/i18n";
import { localeForRegion, localeLabel, type LocaleProfile } from "@/lib/region/locale-map";
import { useSettings } from "@/lib/settings";
import type { Settings } from "@/lib/settings";
import { RegionPicker } from "./region-picker";

export { RegionPicker };

function prepend(value: string, list: string[]): string[] {
  return [value, ...list.filter((x) => x !== value)];
}

export function applyLocaleCascade(
  update: (patch: Partial<Settings>) => void,
  next: LocaleProfile,
  current: Pick<Settings, "preferredLanguages" | "preferredSubLangs" | "preferredAudioLangs">,
): void {
  const uiLanguage = normalizeLanguage(next.uiLanguage);
  setUiLanguage(uiLanguage);
  update({
    uiLanguage,
    tmdbLanguage: next.tmdbLanguage,
    preferredLanguages: prepend(next.audioLanguage, current.preferredLanguages),
    preferredSubLangs: prepend(next.subtitleLanguage, current.preferredSubLangs),
    preferredAudioLangs: prepend(next.audioLanguage, current.preferredAudioLangs),
  });
}

export function regionFromNavigator(): string | null {
  if (typeof navigator === "undefined") return null;
  const tag = (navigator.language || "").trim();
  if (!tag) return null;
  const parts = tag.split("-");
  const region = parts[1]?.toUpperCase();
  if (region && region.length === 2) return region;
  const lang = parts[0]?.toLowerCase();
  if (lang === "ar") return "SA";
  if (lang === "es") return "ES";
  if (lang === "ru") return "RU";
  if (lang === "pt") return "PT";
  return null;
}

export function useFirstRunLocaleDetect(): void {
  const { settings, update } = useSettings();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (settings.uiLanguage !== "en" || settings.arabicWelcomeSeen) return;
    if (settings.region !== "US") return;
    const detected = regionFromNavigator();
    if (!detected) return;
    const next = localeForRegion(detected);
    if (next.uiLanguage === "en") return;
    update({ region: detected });
    applyLocaleCascade(update, next, settings);
  }, [settings, update]);
}

export function RegionField() {
  const { settings, update } = useSettings();
  const t = useT();
  const [pending, setPending] = useState<{ code: string; next: LocaleProfile } | null>(null);

  const onChange = (code: string) => {
    update({ region: code });
    const next = localeForRegion(code);
    if (next.uiLanguage === "en") return;
    setPending({ code, next });
  };

  const confirm = () => {
    if (!pending) return;
    applyLocaleCascade(update, pending.next, settings);
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <RegionPicker value={settings.region} onChange={onChange} />
      {pending && (
        <LocaleConfirm
          label={localeLabel(pending.next)}
          rtl={pending.next.rtl}
          onConfirm={confirm}
          onDismiss={() => setPending(null)}
          t={t}
        />
      )}
    </div>
  );
}

function LocaleConfirm({
  label,
  rtl,
  onConfirm,
  onDismiss,
  t,
}: {
  label: string;
  rtl: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const { closing, close } = useModalExit(onDismiss);
  useEffect(() => captureFocusReturn(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);
  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[240] flex items-center justify-center p-6`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        dir={rtl ? "rtl" : undefined}
        className={`${closing ? "animate-dialog-out" : "animate-dialog-in"} flex max-h-[86vh] w-[min(640px,100%)] flex-col overflow-hidden rounded-md bg-surface harbor-float`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5">
          <h2 className="min-w-0 text-[19px] font-semibold leading-[26px] tracking-tight text-ink">
            {t("Switch Harbor to {language}?", { language: label })}
          </h2>
          <button
            onClick={close}
            aria-label={t("Close")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>
        <div className="min-h-0 grow overflow-y-auto px-6 pt-1.5 [scrollbar-width:thin]">
          <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
            {t("This sets the interface, metadata, subtitle, and audio languages to match.")}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 px-6 pb-5 pt-5">
          <button
            onClick={close}
            className="h-11 rounded-[8px] bg-elevated px-4 text-[15px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {t("Just change region")}
          </button>
          <button
            onClick={onConfirm}
            className="h-11 rounded-[8px] bg-ink px-4 text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {t("Apply {language}", { language: label })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
