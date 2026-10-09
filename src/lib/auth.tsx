import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { stremioSourceProfileId, useProfiles, type Profile } from "./profiles";
import { getUser, login as apiLogin, type User } from "./stremio";

type Session = { authKey: string; user: User };
type AuthValue = {
  user: User | null;
  authKey: string | null;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signInWithKey: (authKey: string) => Promise<void>;
  signOut: () => void;
};

const PROFILE_KEY_PREFIX = "harbor.auth.";

function profileAuthKey(id: string): string {
  return PROFILE_KEY_PREFIX + id;
}

function readProfileSession(id: string): Session | null {
  try {
    const raw = localStorage.getItem(profileAuthKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.authKey || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeProfileSession(id: string, session: Session | null): void {
  try {
    if (session) localStorage.setItem(profileAuthKey(id), JSON.stringify(session));
    else localStorage.removeItem(profileAuthKey(id));
  } catch {
    return;
  }
}

export function readActiveStremioAuthKey(): string | null {
  try {
    const raw = localStorage.getItem("harbor.profiles.v1");
    if (!raw) return null;
    const state = JSON.parse(raw) as { profiles?: Profile[]; activeId?: string | null };
    const profiles = Array.isArray(state.profiles) ? state.profiles : [];
    const active = profiles.find((p) => p.id === state.activeId) ?? null;
    const sourceId = stremioSourceProfileId(active, profiles);
    if (!sourceId) return null;
    return readProfileSession(sourceId)?.authKey ?? null;
  } catch {
    return null;
  }
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { profiles, activeProfile, updateProfile } = useProfiles();
  const sourceId = stremioSourceProfileId(activeProfile, profiles);

  const [session, setSession] = useState<Session | null>(() =>
    sourceId ? readProfileSession(sourceId) : null,
  );

  useEffect(() => {
    setSession(sourceId ? readProfileSession(sourceId) : null);
  }, [sourceId]);

  const commitSession = useCallback(
    (fresh: Session) => {
      if (!activeProfile) {
        setSession(fresh);
        return;
      }
      if (activeProfile.shareStremioWith) {
        updateProfile(activeProfile.id, { shareStremioWith: null });
      }
      writeProfileSession(activeProfile.id, fresh);
      setSession(fresh);
    },
    [activeProfile, updateProfile],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      commitSession(await apiLogin(email, password));
    },
    [commitSession],
  );

  const signInWithKey = useCallback(
    async (authKey: string) => {
      const key = authKey.trim();
      if (!key) throw new Error("No sign-in key received. Try again.");
      const fetched = await getUser(key).catch(() => null);
      const user: User = fetched?._id ? fetched : { _id: `stremio:${key.slice(0, 10)}`, email: "" };
      commitSession({ authKey: key, user });
    },
    [commitSession],
  );

  const signOut = useCallback(() => {
    if (!activeProfile) {
      setSession(null);
      return;
    }
    if (activeProfile.shareStremioWith) {
      updateProfile(activeProfile.id, { shareStremioWith: null });
    } else {
      writeProfileSession(activeProfile.id, null);
    }
    setSession(null);
  }, [activeProfile, updateProfile]);

  const value = useMemo<AuthValue>(
    () => ({
      user: session?.user ?? null,
      authKey: session?.authKey ?? null,
      signIn,
      signInWithKey,
      signOut,
    }),
    [session, signIn, signInWithKey, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
