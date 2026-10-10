import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { isInstalled } from "@/lib/addon-store";
import { AccountStep } from "@/components/onboarding/account-step";
import { DoneStep } from "@/components/onboarding/done-step";
import { Dots } from "@/components/onboarding/dots";
import { LanguageStep } from "@/components/onboarding/language-step";
import { LiveTvStep } from "@/components/onboarding/live-tv-step";
import { MoviesStep } from "@/components/onboarding/movies-step";
import { ProfileStep } from "@/components/onboarding/profile-step";
import { SplashStep } from "@/components/onboarding/splash-step";
import { useBigPicture } from "@/lib/big-picture";
import { useT } from "@/lib/i18n";
import { jlAccountsConfigured, useJlSession } from "@/lib/jl/account/client";
import { JL_TORRENTIO_ADDON_ID } from "@/lib/jl/onboarding";
import { useOnboarding } from "@/lib/onboarding";
import { isPlaceholderName, useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";

// Only what a working setup needs. Everything else keeps its default and lives in Settings.
type StepId = "splash" | "language" | "account" | "profile" | "live" | "movies" | "done";
const STEPS: StepId[] = jlAccountsConfigured()
  ? ["splash", "language", "account", "profile", "live", "movies", "done"]
  : ["splash", "language", "profile", "live", "movies", "done"];

export function OnboardingModal() {
  const { onboarded, finishOnboarding } = useOnboarding();
  const bigPicture = useBigPicture().active;
  const { settings } = useSettings();
  const { activeProfile } = useProfiles();
  const session = useJlSession();
  const t = useT();
  const [stepIdx, setStepIdx] = useState(0);
  const [closing, setClosing] = useState(false);
  const [skipAccount, setSkipAccount] = useState(false);
  const [noIptv, setNoIptv] = useState(false);
  const [noDebrid, setNoDebrid] = useState(false);
  const [torrentioAdded, setTorrentioAdded] = useState(false);

  useEffect(() => {
    if (onboarded || bigPicture) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [onboarded, bigPicture]);

  // Big Picture ships its own ten-foot setup at z-900. Leaving this mounted
  // underneath it keeps a second focusable dialog in native tab order and a
  // second owner of the body scroll lock.
  if (onboarded || bigPicture) return null;

  const step = STEPS[stepIdx];
  const isSplash = step === "splash";
  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 1));
  const finish = () => {
    setClosing(true);
    setTimeout(finishOnboarding, 320);
  };

  const hasPlaylist = settings.iptvPlaylists.some((p) => (p.kind ?? "m3u") !== "epg");
  const hasDebrid = !!(settings.rdKey.trim() || settings.tbKey.trim());
  const ready: Record<StepId, boolean> = {
    splash: true,
    language: true,
    account: !!session || skipAccount,
    profile: !isPlaceholderName(activeProfile?.name),
    live: hasPlaylist || noIptv,
    movies: noDebrid || (hasDebrid && (torrentioAdded || isInstalled(JL_TORRENTIO_ADDON_ID))),
    done: true,
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 backdrop-blur-md ${
        closing ? "opacity-0 transition-opacity duration-300" : "animate-fade-in"
      }`}
    >
      <div
        className={`relative flex w-[min(92vw,580px)] flex-col overflow-hidden rounded-2xl border border-edge-soft bg-elevated/95 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] ${closing ? "scale-[0.97] opacity-0 !transition-all !duration-300" : "animate-modal-in"}`}
      >
        {isSplash ? (
          <SplashStep onAdvance={next} />
        ) : (
          <>
            <div className="flex max-h-[78vh] min-h-[440px] flex-col justify-center overflow-y-auto px-12 py-10">
              <div key={step} className="animate-step-in">
                {step === "language" && <LanguageStep />}
                {step === "account" && (
                  <AccountStep
                    onSkip={() => {
                      setSkipAccount(true);
                      next();
                    }}
                  />
                )}
                {step === "profile" && <ProfileStep />}
                {step === "live" && (
                  <LiveTvStep
                    onNoIptv={() => {
                      setNoIptv(true);
                      next();
                    }}
                  />
                )}
                {step === "movies" && (
                  <MoviesStep
                    onNoDebrid={() => {
                      setNoDebrid(true);
                      next();
                    }}
                    onTorrentio={() => setTorrentioAdded(true)}
                  />
                )}
                {step === "done" && <DoneStep />}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-edge-soft bg-canvas/40 px-8 py-5">
              <Dots
                count={STEPS.length - 1}
                active={Math.max(stepIdx - 1, 0)}
                onJump={(i) => i + 1 < stepIdx && setStepIdx(i + 1)}
              />
              <div className="flex items-center gap-2.5">
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
                    disabled={!ready[step]}
                    className="flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.03] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
                  >
                    {t("Continue")}
                    <ArrowRight size={15} strokeWidth={2.4} className="dir-icon" />
                  </button>
                ) : (
                  <button
                    onClick={finish}
                    className="flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.03] active:scale-[0.97]"
                  >
                    {t("Start watching")}
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
