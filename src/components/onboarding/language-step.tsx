import { useEffect, useRef, useState } from "react";
import { isRtl, LANGUAGES, setUiLanguage, useT, type UiLanguage } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const GREETING_HOLD_MS = 3000;

export function LanguageStep() {
  const { settings, update } = useSettings();
  const t = useT();
  const reduce = useReducedMotion();
  const [drift, setDrift] = useState(0);
  const [picked, setPicked] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const settled = reduce || picked;
  const activeIdx = Math.max(
    LANGUAGES.findIndex((l) => l.code === settings.uiLanguage),
    0,
  );

  useEffect(() => {
    if (settled) return;
    const id = window.setInterval(
      () => setDrift((i) => (i + 1) % LANGUAGES.length),
      GREETING_HOLD_MS,
    );
    return () => window.clearInterval(id);
  }, [settled]);

  const pick = (code: UiLanguage) => {
    setUiLanguage(code);
    update({ uiLanguage: code });
    setPicked(true);
  };

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const rtl = isRtl(settings.uiLanguage);
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    let next = idx;
    if (e.key === "ArrowDown" || e.key === forward) next = (idx + 1) % LANGUAGES.length;
    else if (e.key === "ArrowUp" || e.key === backward)
      next = (idx - 1 + LANGUAGES.length) % LANGUAGES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = LANGUAGES.length - 1;
    else return;
    e.preventDefault();
    pick(LANGUAGES[next].code);
    buttons.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <Greeting index={settled ? activeIdx : drift} fade={!reduce} />
        <h1 className="font-display text-[26px] font-medium leading-tight tracking-tight text-ink">
          {t("Pick your language")}
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-muted">
          {t(
            "Harbor's own menus and labels. Subtitle languages come later, and you can change both in Settings.",
          )}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={t("Display language")}
        className="grid max-h-[min(48vh,430px)] grid-cols-2 gap-2.5 overflow-y-auto pe-1"
      >
        {LANGUAGES.map((lang, i) => {
          const selected = settings.uiLanguage === lang.code;
          return (
            <button
              key={lang.code}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={i === activeIdx ? 0 : -1}
              onClick={() => pick(lang.code)}
              onKeyDown={(e) => onKeyDown(e, i)}
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
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  lang={lang.code}
                  dir={lang.rtl ? "rtl" : "ltr"}
                  className={`text-[15px] font-semibold text-ink ${lang.rtl ? "font-arabic" : ""}`}
                >
                  {lang.nativeLabel}
                </span>
                <span className="text-[12.5px] leading-snug text-ink-muted">{t(lang.label)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Greeting({ index, fade }: { index: number; fade: boolean }) {
  return (
    <div aria-hidden className="grid">
      {LANGUAGES.map((lang, i) => (
        <span
          key={lang.code}
          lang={lang.code}
          dir={lang.rtl ? "rtl" : "ltr"}
          className={`col-start-1 row-start-1 justify-self-start text-[38px] font-medium leading-[1.2] tracking-tight text-ink-muted ${
            lang.rtl ? "font-arabic" : "font-display"
          } ${fade ? "transition-opacity duration-[900ms] ease-in-out" : ""} ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          {lang.greeting}
        </span>
      ))}
    </div>
  );
}
