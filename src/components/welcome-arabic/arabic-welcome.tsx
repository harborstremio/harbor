import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useMedia } from "@/components/hover-preview/scene";
import { useSettings } from "@/lib/settings";
import {
  BODY_AR,
  BODY_EN,
  CTA_AR,
  CTA_HELPER_EN,
  ENGLISH_LINE,
  feedbackLabel,
  HEADLINE_AR,
  TRANSLITERATION,
} from "./copy";

export default function ArabicWelcome({ onFeedback }: { onFeedback?: () => void }) {
  const { settings, update } = useSettings();
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const show = settings.uiLanguage === "ar" && !settings.arabicWelcomeSeen;

  const dismiss = () => update({ arabicWelcomeSeen: true });

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  if (!show) return null;

  const riseClass = reduced ? "animate-fade-in" : "animate-welcome-rise";
  const riseStyle = (delay: number) =>
    reduced ? undefined : ({ animationDelay: `${delay}ms` } as React.CSSProperties);

  const bodyPrimary = settings.uiLanguage === "ar" ? BODY_AR : BODY_EN;
  const bodySecondary = settings.uiLanguage === "ar" ? BODY_EN : BODY_AR;
  const primaryIsAr = settings.uiLanguage === "ar";

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[240] flex items-center justify-center bg-canvas/92 px-8 backdrop-blur-2xl [backdrop-filter:blur(28px)_saturate(120%)]"
      onClick={dismiss}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent_70%)] blur-[60px] ${
          reduced ? "opacity-50" : "animate-welcome-aura"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="arabic-welcome-headline"
        dir={settings.uiLanguage === "ar" ? "rtl" : "ltr"}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-screen w-full max-w-[680px] flex-col items-center overflow-y-auto py-10 text-center"
      >
        <h2
          id="arabic-welcome-headline"
          lang="ar"
          dir="rtl"
          style={riseStyle(180)}
          className={`font-arabic text-[clamp(44px,8vw,76px)] font-semibold leading-[1.15] text-ink [text-shadow:0_2px_30px_var(--color-accent-soft)] ${riseClass}`}
        >
          {HEADLINE_AR}
        </h2>

        <p
          lang="en"
          dir="ltr"
          style={riseStyle(250)}
          className={`mt-5 text-[clamp(13px,1.6vw,15px)] font-medium tracking-[0.18em] text-ink-subtle ${riseClass}`}
        >
          {TRANSLITERATION}
        </p>

        <p
          lang="en"
          dir="ltr"
          style={riseStyle(320)}
          className={`mt-2 font-display text-[clamp(16px,2.2vw,20px)] font-normal italic leading-snug text-ink-muted ${riseClass}`}
        >
          {ENGLISH_LINE}
        </p>

        <div
          aria-hidden
          style={riseStyle(390)}
          className={`my-7 h-px w-16 bg-edge-soft ${riseClass}`}
        />

        <div className="flex flex-col items-center">
          <p
            lang={primaryIsAr ? "ar" : "en"}
            dir={primaryIsAr ? "rtl" : "ltr"}
            style={riseStyle(460)}
            className={`text-[clamp(14.5px,1.9vw,16.5px)] leading-relaxed text-ink-muted ${
              primaryIsAr ? "font-arabic" : "font-sans"
            } ${riseClass}`}
          >
            {bodyPrimary}
          </p>
          <p
            lang={primaryIsAr ? "en" : "ar"}
            dir={primaryIsAr ? "ltr" : "rtl"}
            style={riseStyle(530)}
            className={`mt-4 text-[clamp(13px,1.7vw,14.5px)] leading-relaxed text-ink-subtle ${
              primaryIsAr ? "font-sans" : "font-arabic"
            } ${riseClass}`}
          >
            {bodySecondary}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onFeedback?.()}
          style={riseStyle(600)}
          className={`mt-9 py-2 text-[14px] font-medium text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline hover:decoration-edge ${riseClass}`}
        >
          {feedbackLabel(settings.uiLanguage)}
        </button>

        <button
          type="button"
          autoFocus
          onClick={dismiss}
          style={riseStyle(670)}
          className={`mt-6 flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-full bg-ink px-8 text-canvas shadow-[0_18px_50px_-22px_var(--color-accent-soft)] transition-transform hover:scale-[1.02] active:scale-100 ${riseClass}`}
        >
          <span lang="ar" dir="rtl" className="font-arabic text-[16px] font-semibold">
            {CTA_AR}
          </span>
          <span lang="en" dir="ltr" className="text-[12px] font-medium tracking-wide text-canvas/70">
            {CTA_HELPER_EN}
          </span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
