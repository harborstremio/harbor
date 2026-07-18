import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSettings } from "@/lib/settings";
import {
  loginLetterboxd,
  StremboxdLoginError,
  updateLetterboxdPreferences,
  type LetterboxdPreferences,
} from "./client";
import { buildStremboxdConfig } from "./settings-helper";
import { invalidateLetterboxdCache } from "./cache";
import { getLetterboxdSession, setLetterboxdSession, subscribeLetterboxdSession } from "./session";
import type { LetterboxdSession } from "./types";

type LoginResult =
  | { kind: "success"; session: LetterboxdSession }
  | { kind: "2fa" }
  | { kind: "error"; message: string };

type Value = {
  enabled: boolean;
  mode: "public" | "full";
  username: string;
  configSegment: string;
  selectedCatalogs: string[];
  hiddenCatalogs: string[];
  catalogOrder: string[];
  showRatingsOnPosters: boolean;
  listRefs: Array<{ id: string; name: string; owner?: string; filmCount?: number }>;
  session: LetterboxdSession | null;
  isFullConnected: boolean;
  isActive: boolean;
  login: (username: string, password: string, totp?: string) => Promise<LoginResult>;
  disconnect: () => void;
  toggleHidden: (catalogId: string) => void;
  moveCatalog: (catalogId: string, delta: -1 | 1) => void;
};

const Ctx = createContext<Value | null>(null);

// Map our user-facing catalog toggles to the server-side preferences shape.
function buildServerPreferences(
  selectedCatalogs: string[],
  listRefs: Array<{ id: string; name: string; owner?: string; filmCount?: number }>,
): LetterboxdPreferences {
  const sel = new Set(selectedCatalogs);
  return {
    catalogs: {
      watchlist: sel.has("letterboxd-watchlist"),
      diary: sel.has("letterboxd-diary"),
      friends: sel.has("letterboxd-friends"),
      popular: sel.has("letterboxd-popular"),
      top250: sel.has("letterboxd-top250"),
      likedFilms: sel.has("letterboxd-liked"),
      recommended: sel.has("letterboxd-recommended"),
    },
    ownLists: listRefs.map((r) => r.id),
    externalLists: [],
    showActions: true,
    showRatings: true,
  };
}

export function LetterboxdProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const lb = settings.letterboxd;
  const [session, setLocalSession] = useState<LetterboxdSession | null>(() =>
    getLetterboxdSession(),
  );

  useEffect(
    () =>
      subscribeLetterboxdSession(() => {
        setLocalSession(getLetterboxdSession());
      }),
    [],
  );

  const login = useCallback(
    async (username: string, password: string, totp?: string): Promise<LoginResult> => {
      try {
        const res = await loginLetterboxd(username, password, totp);
        const next: LetterboxdSession = {
          userToken: res.userToken,
          userId: res.user.id,
          username: res.user.username,
          displayName: res.user.displayName,
          loginAt: Date.now(),
          lists: res.lists,
        };
        setLetterboxdSession(next);
        const updatedSettings = {
          ...lb,
          enabled: true,
          mode: "full" as const,
          username: res.user.username,
        };
        update({
          letterboxd: { ...updatedSettings, encodedConfig: buildStremboxdConfig(updatedSettings) },
        });

        // Sync preferences so the server enables the catalogs the user selected.
        // Without this, the server may default watchlist/recommended to off.
        try {
          const prefs = buildServerPreferences(lb.selectedCatalogs, lb.listRefs);
          await updateLetterboxdPreferences(next.userToken, prefs);
          invalidateLetterboxdCache();
        } catch {
          /* non-fatal — catalogs may still work via direct requests */
        }

        return { kind: "success", session: next };
      } catch (e) {
        if (e instanceof StremboxdLoginError) {
          if (e.code === "2FA_REQUIRED") return { kind: "2fa" };
          if (e.status === 0) return { kind: "error", message: e.message };
          return { kind: "error", message: e.message };
        }
        return {
          kind: "error",
          message: e instanceof Error ? e.message : "Could not reach Stremboxd.",
        };
      }
    },
    [lb, update],
  );

  // Sync preferences whenever the selected catalogs or lists change while
  // connected in full mode. This keeps the server-side manifest in sync with
  // the user's Harbor settings.
  useEffect(() => {
    if (!session || lb.mode !== "full") return;
    const prefs = buildServerPreferences(lb.selectedCatalogs, lb.listRefs);
    updateLetterboxdPreferences(session.userToken, prefs)
      .then(() => invalidateLetterboxdCache())
      .catch(() => {});
  }, [session, lb.mode, lb.selectedCatalogs, lb.listRefs]);

  const disconnect = useCallback(() => {
    setLetterboxdSession(null);
    update({ letterboxd: { ...lb, mode: "public" } });
  }, [lb, update]);

  const toggleHidden = useCallback(
    (catalogId: string) => {
      const hidden = new Set(lb.hiddenCatalogs);
      if (hidden.has(catalogId)) hidden.delete(catalogId);
      else hidden.add(catalogId);
      update({ letterboxd: { ...lb, hiddenCatalogs: [...hidden] } });
    },
    [lb, update],
  );

  const moveCatalog = useCallback(
    (catalogId: string, delta: -1 | 1) => {
      const current = lb.catalogOrder.length > 0 ? lb.catalogOrder : lb.selectedCatalogs;
      const idx = current.indexOf(catalogId);
      if (idx === -1) return;
      const swapWith = idx + delta;
      if (swapWith < 0 || swapWith >= current.length) return;
      const next = [...current];
      [next[idx], next[swapWith]] = [next[swapWith]!, next[idx]!];
      update({ letterboxd: { ...lb, catalogOrder: next } });
    },
    [lb, update],
  );

  const isFullConnected = !!session;
  const hasPublicIdentity = lb.username.trim().length > 0;
  const isActive = lb.enabled && (lb.mode === "full" ? isFullConnected : hasPublicIdentity);

  // Rebuild encodedConfig if missing (e.g. after app restart if it wasn't saved)
  useEffect(() => {
    if (!lb.enabled) return;
    if (lb.mode === "public" && lb.username && !lb.encodedConfig) {
      update({ letterboxd: { ...lb, encodedConfig: buildStremboxdConfig(lb) } });
    }
  }, [lb, update]);

  const value = useMemo<Value>(
    () => ({
      enabled: lb.enabled,
      mode: lb.mode,
      username: lb.username,
      configSegment: lb.encodedConfig,
      selectedCatalogs: lb.selectedCatalogs,
      hiddenCatalogs: lb.hiddenCatalogs,
      catalogOrder: lb.catalogOrder,
      showRatingsOnPosters: lb.showRatingsOnPosters,
      listRefs: lb.listRefs,
      session,
      isFullConnected,
      isActive,
      login,
      disconnect,
      toggleHidden,
      moveCatalog,
    }),
    [lb, session, isFullConnected, isActive, login, disconnect, toggleHidden, moveCatalog],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLetterboxd(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLetterboxd outside LetterboxdProvider");
  return v;
}
