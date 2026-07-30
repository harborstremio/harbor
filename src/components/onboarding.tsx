import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DoneStep } from "@/components/onboarding/done-step";
import { Dots } from "@/components/onboarding/dots";
import { LanguageStep } from "@/components/onboarding/language-step";
import { LayoutStep } from "@/components/onboarding/layout-step";
import { SplashStep } from "@/components/onboarding/splash-step";
import { StreamingStep } from "@/components/onboarding/streaming-step";
import { StremioStep } from "@/components/onboarding/stremio-step";
import { SubtitlesStep } from "@/components/onboarding/subtitles-step";
import { TasteStep, TASTE_MAX } from "@/components/onboarding/taste-step";
import { TmdbStep } from "@/components/onboarding/tmdb-step";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import type { Meta } from "@/lib/cinemeta";
import { setVote } from "@/lib/feed/preferences";
import { useT } from "@/lib/i18n";
import { useOnboarding } from "@/lib/onboarding";

type StepId =
  | "splash"
  | "language"
  | "welcome"
  | "layout"
  | "tmdb"
  | "stremio"
  | "streaming"
  | "subtitles"
  | "taste"
  | "done";
const STEPS: StepId[] = [
  "splash",
  "language",
  "welcome",
  "layout",
  "tmdb",
  "stremio",
  "streaming",
  "subtitles",
  "taste",
  "done",
];

export function OnboardingModal() {
  const { onboarded, finishOnboarding } = useOnboarding();
  const t = useT();
  const [stepIdx, setStepIdx] = useState(0);
  const [closing, setClosing] = useState(false);
  const [tastePicks, setTastePicks] = useState<Meta[]>([]);

  useEffect(() => {
    if (!onboarded) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [onboarded]);

  if (onboarded) return null;

  const step = STEPS[stepIdx];
  const isSplash = step === "splash";
  const isTaste = step === "taste";
  const toggleTaste = (m: Meta) =>
    setTastePicks((prev) =>
      prev.some((p) => p.id === m.id)
        ? prev.filter((p) => p.id !== m.id)
        : prev.length >= TASTE_MAX
          ? prev
          : [...prev, m],
    );
  const next = () => {
    if (isTaste) for (const m of tastePicks) setVote(m.id, "up", { name: m.name, type: m.type });
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  };
  const skip = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));
  const finish = () => {
    setClosing(true);
    setTimeout(finishOnboarding, 320);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 backdrop-blur-md ${
        closing ? "opacity-0 transition-opacity duration-300" : "animate-fade-in"
      }`}
    >
      <div
        className={`relative flex flex-col overflow-hidden rounded-[28px] border border-edge-soft bg-elevated/95 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] ${
          isTaste ? "w-[min(93vw,640px)]" : "w-[min(92vw,580px)]"
        } transition-[width] duration-300 ${closing ? "scale-[0.97] opacity-0 !transition-all !duration-300" : "animate-modal-in"}`}
      >
        {!isSplash && (
          <button
            onClick={finish}
            aria-label={t("Skip setup")}
            className="absolute end-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={17} />
          </button>
        )}

        {isSplash ? (
          <SplashStep onAdvance={next} />
        ) : (
          <>
            <div
              className={`flex min-h-[440px] flex-col ${isTaste ? "px-8 pt-9 pb-3" : "justify-center px-12 py-10"}`}
            >
              <div key={step} className="animate-step-in">
                {step === "language" && <LanguageStep />}
                {step === "welcome" && <WelcomeStep />}
                {step === "layout" && <LayoutStep />}
                {step === "tmdb" && <TmdbStep />}
                {step === "stremio" && <StremioStep />}
                {step === "streaming" && <StreamingStep />}
                {step === "subtitles" && <SubtitlesStep />}
                {step === "taste" && <TasteStep selected={tastePicks} onToggle={toggleTaste} />}
                {step === "done" && <DoneStep />}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-edge-soft bg-canvas/40 px-8 py-5">
              <Dots
                count={STEPS.length - 1}
                active={Math.max(stepIdx - 1, 0)}
                onJump={(i) => setStepIdx(i + 1)}
              />
              <div className="flex items-center gap-2.5">
                {(step === "tmdb" ||
                  step === "stremio" ||
                  step === "streaming" ||
                  step === "subtitles" ||
                  step === "taste") && (
                  <button
                    key={`skip-${step}`}
                    onClick={skip}
                    className="animate-skip-in h-11 rounded-full px-4 text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink"
                  >
                    {t("Skip for now")}
                  </button>
                )}
                {stepIdx > 1 && stepIdx < STEPS.length - 1 && (
                  <button
                    onClick={back}
                    className="h-11 rounded-full px-5 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink"
                  >
                    {t("Back")}
                  </button>
                )}
                {stepIdx < STEPS.length - 1 ? (
                  <button
                    onClick={next}
                    className="flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.03] active:scale-[0.97]"
                  >
                    {step === "welcome" ? t("Get Started") : t("Continue")}
                    <ArrowRight size={15} strokeWidth={2.4} className="dir-icon" />
                  </button>
                ) : (
                  <button
                    onClick={finish}
                    className="flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.03] active:scale-[0.97]"
                  >
                    {t("Enter Harbor")}
                    <ArrowRight size={15} strokeWidth={2.4} className="dir-icon" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
