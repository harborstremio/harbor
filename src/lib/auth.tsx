import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useProfiles } from "./profiles";
import type { User } from "./stremio";
import { signInJl, signOutJl, useJlSession } from "./jl/account/client";
import { activeLocalLibraryScope, localLibraryScope } from "./jl/local-library";

type AuthValue = {
  user: User | null;
  /** Compatibility name: a JL local profile scope, never a bearer token. */
  authKey: string | null;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signInWithKey: (authKey: string) => Promise<void>;
  signOut: () => void;
};

/** Legacy name for library callers. Stored harbor.auth.* credentials are never read. */
export function readActiveStremioAuthKey(): string | null {
  return activeLocalLibraryScope();
}

const Ctx = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { activeProfile } = useProfiles();
  const session = useJlSession();
  const value = useMemo<AuthValue>(
    () => ({
      user: session
        ? { _id: session.userId, email: session.email ?? "", fullname: activeProfile?.name }
        : null,
      authKey: localLibraryScope(activeProfile?.id ?? "default"),
      signIn: async (email, password) => {
        await signInJl(email, password);
      },
      signInWithKey: async () => {
        throw new Error(
          "External account tokens are not accepted. Sign in with your JL Media Vision account on this device.",
        );
      },
      signOut: () => {
        void signOutJl();
      },
    }),
    [session, activeProfile?.id, activeProfile?.name],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
}
