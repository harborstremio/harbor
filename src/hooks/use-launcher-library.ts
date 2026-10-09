import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { osClass } from "@/lib/platform";
import { canLaunchGame, launcherDispatchId, type LauncherScan } from "@/lib/games/launchers";
import { observeLauncherIdentities } from "@/lib/games/launcher-identities";
import { emptyLauncherSessions, launcherSessionBusy, withLauncherActivity, type LauncherSessions } from "@/lib/games/launcher-sessions";
import { useBattleNetAccount } from "./use-battlenet-account";
import { withBattleNetAccount } from "@/lib/games/battlenet-account";

export function useLauncherLibrary(active: boolean, profile: string) {
  const battlenet = useBattleNetAccount(profile, active);
  const available = isTauri() && osClass() === "windows";
  const [scan, setScan] = useState<LauncherScan | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null), [launched, setLaunched] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState(false);
  const mounted = useRef(true), running = useRef(false), launchLock = useRef(false), lastAttempt = useRef(0);
  const observed = useRef<LauncherScan | null>(null);
  const owner = useRef(profile); owner.current = profile;
  const [sessions, setSessions] = useState({ profile, value: emptyLauncherSessions() });
  const [sessionError, setSessionError] = useState(false);
  const sessionRead = useRef(0), sessionBusy = useRef<Promise<void> | null>(null);
  const sessionDismissed = useRef(false), sessionUnsupported = useRef(false);
  const refreshSessions = useCallback(async (force = false) => {
    if (!available || sessionUnsupported.current) return;
    if (sessionBusy.current) { if (!force) return; await sessionBusy.current; }
    if (!mounted.current || owner.current !== profile) return;
    const revision = ++sessionRead.current;
    const request = (async () => {
      try {
        const value = await invoke<LauncherSessions>("games_launcher_sessions", { profile });
        if (mounted.current && owner.current === profile && revision === sessionRead.current) {
          if (!value.error) sessionDismissed.current = false;
          setSessions({ profile, value }); setSessionError(value.error && !sessionDismissed.current);
        }
      } catch (error) {
        // Dev frontend updates can precede the native binary. Genuine observation errors stay visible.
        const unavailable = String(error).includes("Command games_launcher_sessions not found");
        sessionUnsupported.current = unavailable;
        if (mounted.current && owner.current === profile) setSessionError(!unavailable && !sessionDismissed.current);
      }
    })();
    sessionBusy.current = request;
    await request;
    if (sessionBusy.current === request) sessionBusy.current = null;
  }, [available, profile]);
  const decorated = useMemo(() => withLauncherActivity(withBattleNetAccount(scan, battlenet.status), sessions.profile === profile ? sessions.value : emptyLauncherSessions(), profile), [scan, sessions, profile, battlenet.status]);
  const liveScan = useRef(decorated); liveScan.current = decorated;
  useEffect(() => {
    sessionRead.current++; sessionDismissed.current = false; setLaunched(null); setLaunching(null); setLaunchError(false); setSessionError(false);
    void refreshSessions();
  }, [refreshSessions]);
  useEffect(() => {
    if (!available) return;
    const check = () => { if (!document.hidden && (active || liveScan.current?.games.some(launcherSessionBusy))) void refreshSessions(); };
    check(); const timer = window.setInterval(check, 3_000);
    window.addEventListener("focus", check); document.addEventListener("visibilitychange", check);
    return () => { clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [active, available, refreshSessions]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const scanLibrary = useCallback(async (background = false) => {
    if (!available || !mounted.current || running.current) return;
    running.current = true; lastAttempt.current = Date.now();
    if (!background || !observed.current) { setLoading(true); setError(false); }
    try {
      const value = await observeLauncherIdentities(await invoke<LauncherScan>("games_scan_launchers"));
      if (mounted.current) { observed.current = value; setScan(value); setError(false); }
    } catch { if (mounted.current) setError(true); }
    finally { running.current = false; if (mounted.current) setLoading(false); }
  }, [available]);
  const refresh = useCallback(() => { sessionDismissed.current = false; void refreshSessions(); return scanLibrary(); }, [scanLibrary, refreshSessions]);
  useEffect(() => {
    if (!active || !available) return;
    const check = (age: number) => { if (!document.hidden && Date.now() - lastAttempt.current >= age) void scanLibrary(true); };
    const returned = () => check(2_000);
    returned(); const timer = window.setInterval(() => check(60_000), 60_000);
    window.addEventListener("focus", returned); document.addEventListener("visibilitychange", returned);
    return () => { clearInterval(timer); window.removeEventListener("focus", returned); document.removeEventListener("visibilitychange", returned); };
  }, [active, available, scanLibrary]);
  const launch = useCallback(async (id: string) => {
    if (!available || launchLock.current) return;
    const snapshot = liveScan.current, game = snapshot?.games.find(item => item.id === id);
    if (game && launcherSessionBusy(game)) return;
    if (!snapshot || !game || !canLaunchGame(game, snapshot)) { setLaunchError(true); void refresh(); return; }
    launchLock.current = true; setLaunching(id); setLaunched(null); setLaunchError(false);
    try {
      // Native code re-scans the product and constructs the launch command itself.
      const tracked = await invoke<boolean>("games_launch_launcher_game", { profile, id: launcherDispatchId(game) });
      if (mounted.current && owner.current === profile) {
        if (!tracked) setLaunched(id);
        await refreshSessions(true);
      }
    } catch { if (mounted.current && owner.current === profile) { setLaunchError(true); void refresh(); } }
    finally { launchLock.current = false; if (mounted.current && owner.current === profile) setLaunching(null); }
  }, [available, refresh, refreshSessions, profile]);
  useEffect(() => { if (!launched) return; const timer = setTimeout(() => setLaunched(null), 5_000); return () => clearTimeout(timer); }, [launched]);
  return { available, scan: decorated, loading, error, refresh, launch, launching, launched, launchError, sessionError, battlenet, dismissLaunchError: () => { setLaunchError(false); sessionDismissed.current = true; setSessionError(false); } };
}
export type LauncherLibraryState = ReturnType<typeof useLauncherLibrary>;
