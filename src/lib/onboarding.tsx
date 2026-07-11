import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Flags = { onboarded: boolean; nudges: Record<string, boolean> };

type OnboardingValue = {
  onboarded: boolean;
  finishOnboarding: () => void;
  resetOnboarding: () => void;
  resetNudges: () => void;
  isDismissed: (key: string) => boolean;
  dismiss: (key: string) => void;
};

const STORAGE_KEY = "harbor.onboarding";
const DEFAULT: Flags = { onboarded: false, nudges: {} };

const Ctx = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Flags>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    try {
      const parsed = JSON.parse(raw) as Partial<Flags>;
      return { ...DEFAULT, ...parsed, nudges: { ...DEFAULT.nudges, ...(parsed.nudges ?? {}) } };
    } catch {
      return DEFAULT;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  }, [flags]);

  const finishOnboarding = useCallback(() => setFlags((f) => ({ ...f, onboarded: true })), []);
  const resetOnboarding = useCallback(() => setFlags({ onboarded: false, nudges: {} }), []);
  const resetNudges = useCallback(() => setFlags((f) => ({ ...f, nudges: {} })), []);
  const isDismissed = useCallback((key: string) => !!flags.nudges[key], [flags.nudges]);
  const dismiss = useCallback((key: string) => setFlags((f) => ({ ...f, nudges: { ...f.nudges, [key]: true } })), []);

  const value = useMemo(
    () => ({
      onboarded: flags.onboarded,
      finishOnboarding,
      resetOnboarding,
      resetNudges,
      isDismissed,
      dismiss,
    }),
    [flags.onboarded, finishOnboarding, resetOnboarding, resetNudges, isDismissed, dismiss],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboarding() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOnboarding outside OnboardingProvider");
  return v;
}
