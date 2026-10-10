import { Check } from "lucide-react";
import { flagSrc } from "@/components/flag";
import { LANGUAGES, setUiLanguage, type UiLanguage } from "@/lib/i18n";
import { SFX } from "@/lib/sfx";
import { useSettings } from "@/lib/settings";
import { useBpT } from "@/views/big-picture/bp-i18n";
import { advanceBpOnboardRing } from "../bp-onboard-ring";
import { BP_ROW_FLUSH, BpDecisionScroll } from "../bp-step-parts";

const ROW_SCOPE = { ...BP_ROW_FLUSH, containIntrinsicSize: "auto 96px" } as const;

const PAIRED: Record<string, string[]> = {
  Portuguese: ["Portuguese", "Portuguese (Brazil)"],
};

function flagsFor(label: string): string[] {
  const names = PAIRED[label] ?? [label];
  return names.map(flagSrc).filter((s): s is string => s !== null);
}

/**
 * The current language leads in DOM order because the frame parks the ring on
 * the first focusable here, and pressing OK applies instantly. Landing on
 * English while the user reads Russian would switch them with one press.
 * Visual order is restored with flex `order`, which makes this the one step
 * where DOM order is not visual order, so every row carries a rail index in
 * visual order. The indices are for hasFocusableBelow in bp-onboard-escape,
 * which walks nextElementSibling and would otherwise call the DOM-last row the
 * bottom of the screen: with a non-default language selected that row is
 * visually first, and one Down from it would jump to Continue past three rows
 * the user has not seen. Vertical geometry never needed them.
 */
export function BpStepLanguage() {
  const t = useBpT();
  const { settings, update } = useSettings();
  const at = LANGUAGES.findIndex((l) => l.code === settings.uiLanguage);
  const ordered = at > 0 ? [LANGUAGES[at], ...LANGUAGES.filter((_, i) => i !== at)] : LANGUAGES;

  const pick = (code: UiLanguage) => {
    SFX.click();
    setUiLanguage(code);
    update({ uiLanguage: code });
    advanceBpOnboardRing();
  };

  return (
    <BpDecisionScroll>
      {ordered.map((lang) => {
        const selected = settings.uiLanguage === lang.code;
        const seat = LANGUAGES.indexOf(lang);
        return (
          <div
            key={lang.code}
            data-bp-row
            data-bp-rail-row={seat}
            style={{ ...ROW_SCOPE, order: seat }}
          >
            <div data-bp-scroll-x className="flex">
              <button
                type="button"
                data-bp-focusable
                data-bp-chip
                aria-pressed={selected}
                onClick={() => pick(lang.code)}
                className={`group flex w-full items-center gap-[clamp(13px,1.3vw,24px)] rounded-[var(--bp-r-md)] border px-[clamp(16px,1.5vw,30px)] py-[clamp(12px,1.6vh,22px)] text-start transition-colors duration-[var(--bp-dur-fast)] ${
                  selected
                    ? "border-transparent bg-[var(--bp-glass)]"
                    : "border-[var(--bp-edge)] bg-[var(--bp-panel)]"
                }`}
              >
                <span className="relative flex h-[clamp(44px,5vh,60px)] w-[clamp(44px,5vh,60px)] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bp-panel-2)] text-ink group-data-[bp-focus=true]:bg-[var(--bp-void)]/25">
                  {flagsFor(lang.label).length === 2 ? (
                    <span className="relative block h-full w-full">
                      {flagsFor(lang.label).map((src, half) => (
                        <img
                          key={src}
                          src={src}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{
                            clipPath:
                              half === 0
                                ? "polygon(0 0, 0 100%, 100% 100%)"
                                : "polygon(0 0, 100% 0, 100% 100%)",
                            objectPosition: "center",
                          }}
                        />
                      ))}
                      <span
                        aria-hidden
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(to bottom left, transparent calc(50% - 1px), var(--bp-page) calc(50% - 1px), var(--bp-page) calc(50% + 1px), transparent calc(50% + 1px))",
                        }}
                      />
                    </span>
                  ) : flagsFor(lang.label).length === 1 ? (
                    <img
                      src={flagsFor(lang.label)[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[clamp(12px,1.6vh,18px)] font-bold">
                      {lang.code.toUpperCase()}
                    </span>
                  )}
                  {selected && (
                    <span className="absolute inset-0 flex items-center justify-center bg-[var(--bp-void)]/65">
                      <Check size={23} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[clamp(2px,0.35vh,6px)] text-ink">
                  <span
                    lang={lang.code}
                    dir={lang.rtl ? "rtl" : "ltr"}
                    className={`truncate text-[clamp(16px,2.4vh,30px)] font-semibold leading-tight ${
                      lang.rtl ? "font-arabic" : ""
                    }`}
                  >
                    {lang.nativeLabel}
                  </span>
                  <span className="truncate text-[clamp(12px,1.65vh,19px)] font-medium opacity-65">
                    {t(lang.label)}
                  </span>
                </span>
                <span
                  lang={lang.code}
                  dir={lang.rtl ? "rtl" : "ltr"}
                  aria-hidden
                  className={`shrink-0 text-[clamp(15px,2.2vh,28px)] font-medium text-ink-subtle ${
                    lang.rtl ? "font-arabic" : "font-display"
                  }`}
                >
                  {lang.greeting}
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </BpDecisionScroll>
  );
}
