import { useSettings } from "@/lib/settings";
import { LANGUAGES, setUiLanguage, useT } from "@/lib/i18n";
import { Section } from "../shared";

export function DisplayLanguageSection() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <Section
      title={t("Display language")}
      subtitle={t(
        "Sets Harbor's interface language and automatically follows its text direction. This is separate from subtitle and metadata languages below.",
      )}
    >
      <div className="flex flex-col gap-2.5">
        {LANGUAGES.map((lang) => {
          const selected = settings.uiLanguage === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                setUiLanguage(lang.code);
                update({ uiLanguage: lang.code });
              }}
              className={`flex items-center gap-3.5 rounded-2xl border px-5 py-4 text-start transition-colors ${
                selected
                  ? "border-ink bg-elevated"
                  : "border-edge-soft bg-canvas/40 hover:border-edge hover:bg-canvas/60"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  selected ? "border-ink" : "border-edge"
                }`}
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-ink">{lang.nativeLabel}</span>
                <span className="text-[12.5px] leading-snug text-ink-muted">{lang.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
