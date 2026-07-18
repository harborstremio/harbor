import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { anyTabLocked, DEFAULT_HIDDEN, type HiddenTabs, type LockableTab } from "./lockable-tabs";
import { hashProfilePassword, verifyProfilePassword } from "./profile-password";
import { useProfiles } from "./profiles";

export { LOCKABLE_TABS, type LockableTab, type HiddenTabs } from "./lockable-tabs";

type ParentalValue = {
  hasPin: boolean;
  locked: boolean;
  hiddenTabs: HiddenTabs;
  setTabHidden: (tab: LockableTab, hidden: boolean) => void;
  setPin: (pin: string) => Promise<void>;
  clearPin: () => void;
  lock: () => void;
  unlock: (pin: string) => Promise<boolean>;
};

const Ctx = createContext<ParentalValue | null>(null);

export function ParentalProvider({ children }: { children: ReactNode }) {
  const { activeProfile, updateProfile, sessionUnlockedIds } = useProfiles();

  const hiddenTabs: HiddenTabs = useMemo(
    () => ({ ...DEFAULT_HIDDEN, ...(activeProfile?.lockedTabs ?? {}) }),
    [activeProfile?.id, activeProfile?.lockedTabs],
  );
  const hasPin = !!activeProfile?.passwordHash;
  const hasAnyLocked = anyTabLocked(activeProfile?.lockedTabs);
  const wantsLock = hasPin && hasAnyLocked;

  const [sessionUnlockedFor, setSessionUnlockedFor] = useState<string | null>(null);
  useEffect(() => {
    setSessionUnlockedFor(null);
  }, [activeProfile?.id]);

  const loginUnlocked = !!activeProfile && sessionUnlockedIds.has(activeProfile.id);
  const locked = wantsLock && sessionUnlockedFor !== activeProfile?.id && !loginUnlocked;

  const setTabHidden = useCallback(
    (tab: LockableTab, hidden: boolean) => {
      if (!activeProfile) return;
      const current = activeProfile.lockedTabs ?? DEFAULT_HIDDEN;
      const next: HiddenTabs = { ...DEFAULT_HIDDEN, ...current, [tab]: hidden };
      const stillAny = anyTabLocked(next);
      updateProfile(activeProfile.id, { lockedTabs: stillAny ? next : null });
    },
    [activeProfile, updateProfile],
  );

  const setPin = useCallback(
    async (pin: string) => {
      if (!activeProfile) return;
      const hash = await hashProfilePassword(pin);
      updateProfile(activeProfile.id, { passwordHash: hash });
      setSessionUnlockedFor(activeProfile.id);
    },
    [activeProfile, updateProfile],
  );

  const clearPin = useCallback(() => {
    if (!activeProfile) return;
    updateProfile(activeProfile.id, { passwordHash: null });
    setSessionUnlockedFor(activeProfile.id);
  }, [activeProfile, updateProfile]);

  const lock = useCallback(() => {
    setSessionUnlockedFor(null);
  }, []);

  const unlock = useCallback(
    async (pin: string) => {
      if (!activeProfile?.passwordHash) {
        setSessionUnlockedFor(activeProfile?.id ?? null);
        return true;
      }
      const ok = await verifyProfilePassword(pin, activeProfile.passwordHash);
      if (ok) {
        setSessionUnlockedFor(activeProfile.id);
        return true;
      }
      return false;
    },
    [activeProfile],
  );

  const value = useMemo<ParentalValue>(
    () => ({
      hasPin,
      locked,
      hiddenTabs,
      setTabHidden,
      setPin,
      clearPin,
      lock,
      unlock,
    }),
    [hasPin, locked, hiddenTabs, setTabHidden, setPin, clearPin, lock, unlock],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useParental() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useParental outside ParentalProvider");
  return v;
}
