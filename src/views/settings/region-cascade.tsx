import { Globe, X } from "lucide-react";
import { useEffect, useState } from "react";
import { directionForLanguage, useT } from "@/lib/i18n";
import { localeForRegion, localeLabel, type LocaleProfile } from "@/lib/region/locale-map";
import { useSettings } from "@/lib/settings";
import type { Settings } from "@/lib/settings";
import { RegionPicker } from "./region-picker";

export { RegionPicker };

function prepend(value: string, list: string[]): string[] {
  return [value, ...list.filter((item) => item !== value)];
}

function applyLocaleCascade(
  update: (patch: Partial<Settings>) => void,
  next: LocaleProfile,
  current: Pick<Settings, "preferredLanguages" | "preferredSubLangs" | "preferredAudioLangs">,
): void {
  update({
    tmdbLanguage: next.tmdbLanguage,
    preferredLanguages: prepend(next.audioLanguage, current.preferredLanguages),
    preferredSubLangs: prepend(next.subtitleLanguage, current.preferredSubLangs),
    preferredAudioLangs: prepend(next.audioLanguage, current.preferredAudioLangs),
  });
}

export function RegionField() {
  const { settings, update } = useSettings();
  const t = useT();
  const [pending, setPending] = useState<{ next: LocaleProfile } | null>(null);

  const onChange = (code: string) => {
    update({ region: code });
    const next = localeForRegion(code);
    setPending({ next });
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
          language={pending.next.language}
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
  language,
  onConfirm,
  onDismiss,
  t,
}: {
  label: string;
  language: string;
  onConfirm: () => void;
  onDismiss: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-canvas/70 p-6 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onDismiss}
    >
      <div
        dir={directionForLanguage(language)}
        className="flex w-full max-w-[440px] flex-col overflow-hidden rounded-3xl border border-edge bg-elevated shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)] animate-popover-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-edge-soft px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Globe size={18} strokeWidth={2.2} />
            </span>
            <div className="flex flex-col">
              <h2 className="font-display text-[19px] font-medium tracking-tight text-ink">
                {t("Apply {language} preferences?", { language: label })}
              </h2>
              <p className="text-[12.5px] text-ink-muted">
                {t("This sets metadata, subtitle, and audio languages to match.")}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label={t("Close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2.5 px-6 py-4">
          <button
            onClick={onDismiss}
            className="rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {t("Just change region")}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {t("Apply {language}", { language: label })}
          </button>
        </div>
      </div>
    </div>
  );
}
