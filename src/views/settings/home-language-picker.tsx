import { Check, Globe } from "./icons";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { LangFlags } from "./home-language-flags";

const LANGS: Array<{ code: string; native: string; name: string; flags: string[] }> = [
  { code: "en", native: "English", name: "English", flags: ["us"] },
  { code: "es", native: "Español", name: "Spanish", flags: ["es", "mx"] },
  { code: "fr", native: "Français", name: "French", flags: ["fr"] },
  { code: "de", native: "Deutsch", name: "German", flags: ["de"] },
  { code: "it", native: "Italiano", name: "Italian", flags: ["it"] },
  { code: "sv", native: "Svenska", name: "Swedish", flags: ["se"] },
  { code: "pt", native: "Português", name: "Portuguese", flags: ["pt", "br"] },
  { code: "ru", native: "Русский", name: "Russian", flags: ["ru"] },
  { code: "tr", native: "Türkçe", name: "Turkish", flags: ["tr"] },
  { code: "ar", native: "العربية", name: "Arabic", flags: ["sa"] },
  { code: "hi", native: "हिन्दी", name: "Hindi", flags: ["in"] },
  { code: "ta", native: "தமிழ்", name: "Tamil", flags: ["in"] },
  { code: "zh", native: "中文", name: "Chinese", flags: ["cn"] },
  { code: "ja", native: "日本語", name: "Japanese", flags: ["jp"] },
  { code: "ko", native: "한국어", name: "Korean", flags: ["kr"] },
];

export function HomeLanguagePicker() {
  const { settings, update } = useSettings();
  const t = useT();
  const selected = settings.homeLanguages;
  const count = selected.length;

  const toggle = (code: string) =>
    update({
      homeLanguages: selected.includes(code)
        ? selected.filter((c) => c !== code)
        : [...selected, code],
    });

  return (
    <div className="flex flex-col gap-3">
 <div className="flex items-center gap-2.5 rounded-md bg-canvas px-3.5 py-2.5">
        <Globe size={18} className={`shrink-0 ${count ? "text-accent" : "text-ink-subtle"}`} />
        <span className="text-[15.5px] leading-[22px] text-ink-muted">
          {count === 0 ? (
            t("No filter. Home shows every language.")
          ) : (
            <>
              <span className="font-semibold tabular-nums text-ink">{count}</span>{" "}
              {t(count === 1 ? "language. Home filters to it." : "languages. Home filters to these.")}
            </>
          )}
        </span>
        {count > 0 && (
          <button
            onClick={() => update({ homeLanguages: [] })}
            className="ms-auto flex h-11 shrink-0 items-center rounded-[8px] px-3 text-[15px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            {t("Clear")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
        {LANGS.map(({ code, native, name, flags }) => {
          const on = selected.includes(code);
          return (
            <button
              key={code}
              onClick={() => toggle(code)}
              className={`group relative flex flex-col items-start gap-0.5 rounded-md border px-3 py-2.5 text-start transition ${
                on
                  ? "bg-accent-soft text-ink"
                  : "border-edge-soft bg-canvas hover:border-edge hover:bg-elevated"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span
                  className={`text-[16.5px] font-medium leading-[24px] ${on ? "text-ink" : "text-ink-muted group-hover:text-ink"}`}
                >
                  {native}
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${
                    on ? "bg-accent text-canvas" : "bg-transparent text-transparent ring-1 ring-edge-soft"
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </span>
              </span>
              <span className="flex w-full items-center gap-1.5">
                <LangFlags codes={flags} />
                <span className="truncate text-[15.5px] leading-[22px] text-ink-subtle">{t(name)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
