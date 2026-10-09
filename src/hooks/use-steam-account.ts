import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { osClass } from "@/lib/platform";
import { steamAccountError, type SteamAccountStatus, type SteamAchievements } from "@/lib/games/steam-account";

const EMPTY: SteamAccountStatus = { connected: false, remembered: false, snapshot: null };
export function useSteamAccount(profile: string, active: boolean) {
  const available = isTauri() && ["windows", "linux", "macos"].includes(osClass());
  const [status, setStatus] = useState(EMPTY), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [installing, setInstalling] = useState<number | null>(null);
  const current = useRef(profile), lock = useRef(false), initialized = useRef(false), lastAttempt = useRef(0);
  useEffect(() => { current.current = profile; initialized.current = false; setStatus(EMPTY); setLoaded(false); setError(null); return () => { current.current = ""; }; }, [profile]);
  const update = useCallback(async (command: string, args: Record<string, unknown> = {}) => {
    if (!available || lock.current) return false;
    lock.current = true; setBusy(true); setError(null); lastAttempt.current = Date.now();
    try {
      const value = await invoke<SteamAccountStatus>(command, { profile, ...args });
      if (current.current === profile) { setStatus(value); setLoaded(true); }
      return true;
    } catch (reason) { if (current.current === profile) setError(steamAccountError(reason)); return false; }
    finally { lock.current = false; if (current.current === profile) setBusy(false); }
  }, [profile, available]);
  const refresh = useCallback(() => update("games_refresh_steam_account"), [update]);
  useEffect(() => {
    if (!available || !active) return;
    if (!initialized.current) { initialized.current = true; void update("games_steam_account_status"); }
    else if (status.connected && status.snapshot && Date.now() - status.snapshot.updatedAt * 1000 > 15 * 60_000 && Date.now() - lastAttempt.current > 15 * 60_000) void refresh();
  }, [active, available, status.connected, status.snapshot?.updatedAt, update, refresh]);
  const connect = useCallback((target: string, key: string, remember: boolean) => update("games_connect_steam_account", { target, key, remember }), [update]);
  const disconnect = useCallback(async () => {
    if (!available) return false;
    try { await invoke("games_disconnect_steam_account", { profile }); if (current.current === profile) { setStatus(EMPTY); setError(null); } return true; }
    catch (reason) { if (current.current === profile) setError(steamAccountError(reason)); return false; }
  }, [available, profile]);
  const install = useCallback(async (appId: number) => {
    if (!available || installing !== null) return;
    setInstalling(appId); setError(null);
    try { await invoke("games_install_steam", { profile, appId }); }
    catch (reason) { if (current.current === profile) setError(steamAccountError(reason)); }
    finally { if (current.current === profile) setInstalling(null); }
  }, [available, profile, installing]);
  const achievements = useCallback((appId: number) => invoke<SteamAchievements>("games_steam_achievements", { profile, appId }), [profile]);
  return { available, profile, status, loaded, busy, error, connect, disconnect, refresh, install, installing, achievements, dismissError: () => setError(null), retryStatus: () => update("games_steam_account_status") };
}
export type SteamAccount = ReturnType<typeof useSteamAccount>;
