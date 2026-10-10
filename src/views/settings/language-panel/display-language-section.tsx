import { Check } from "../icons";
import { Flag } from "@/components/flag";
import { useSettings } from "@/lib/settings";
import { LANGUAGES, setUiLanguage, useT } from "@/lib/i18n";
import { ROW_DESC, ROW_TITLE, Section } from "../shared";

export function DisplayLanguageSection() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <Section
      title={t("Display language")}
      subtitle={t(
        "The language of Harbor's menus, buttons, and labels. Audio, subtitles, and title information have their own language settings.",
      )}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-2.5">
        {LANGUAGES.map((lang) => {
          const selected = settings.uiLanguage === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setUiLanguage(lang.code);
                update({ uiLanguage: lang.code });
              }}
              className={`flex min-h-[var(--hset-row-min-h)] items-center gap-3 rounded-[10px] border bg-elevated px-4 py-3 text-start transition-colors ${
                selected ? "border-accent" : "border-edge-soft hover:bg-raised"
              }`}
            >
              <Flag language={lang.label} size="md" showLabel={false} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={ROW_TITLE}>{lang.nativeLabel}</span>
                <span className={ROW_DESC}>
                  {lang.rtl ? `${t(lang.label)} · ${t("Right to left")}` : t(lang.label)}
                </span>
              </span>
              <span
                dir={lang.rtl ? "rtl" : "ltr"}
                className="shrink-0 rounded-[6px] bg-canvas px-2.5 py-1 text-[15.5px] font-medium leading-[22px] text-ink-muted"
              >
                {lang.greeting}
              </span>
              {selected && (
                <Check size={18} strokeWidth={2.6} className="shrink-0 text-accent" />
              )}
            </button>
          );
        })}
      </div>
    </Section>
  );
}
