import { Flag } from "@/components/flag";
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
        "Sets the language of Harbor's own interface: menus, buttons, and labels. Arabic switches the layout to right to left. This is separate from subtitle and metadata languages below.",
      )}
    >
      <div className="grid gap-1.5 sm:grid-cols-2">
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
              className={`flex items-center gap-3.5 rounded-md px-4 py-3.5 text-start transition-colors ${
                selected ? "bg-ink text-canvas" : "bg-elevated text-ink hover:bg-raised"
              }`}
            >
              <Flag language={lang.label} size="md" showLabel={false} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13.5px] font-medium leading-snug">
                  {lang.nativeLabel}
                </span>
                <span
                  className={`truncate text-[12.5px] leading-snug ${
                    selected ? "text-canvas/70" : "text-ink-subtle"
                  }`}
                >
                  {lang.rtl ? `${t(lang.label)} · ${t("Right to left")}` : t(lang.label)}
                </span>
              </span>
              <span
                dir={lang.rtl ? "rtl" : "ltr"}
                className={`shrink-0 rounded-md bg-canvas px-2.5 py-1 text-[12.5px] font-medium ${
                  selected ? "text-ink" : "text-ink-muted"
                }`}
              >
                {lang.greeting}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
