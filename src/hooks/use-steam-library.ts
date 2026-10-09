import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import type { SteamLibraryScan } from "@/lib/games/installed";
import { osClass } from "@/lib/platform";

export function useSteamLibrary(active: boolean) {
  const available = isTauri() && ["windows", "macos", "linux"].includes(osClass());
  const [scan, setScan] = useState<SteamLibraryScan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [launching, setLaunching] = useState<number | null>(null);
  const [launchError, setLaunchError] = useState(false);
  const [launched, setLaunched] = useState<number | null>(null);
  const running = useRef(false);
  const launchLock = useRef(false);
  const lastAttempt = useRef<number | null>(null);
  const hasScan = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const scanLibrary = useCallback(async (background = false) => {
    if (!available || !mounted.current) return;
    if (running.current) {
      if (!background) setLoading(true);
      return;
    }
    running.current = true;
    lastAttempt.current = Date.now();
    if (!background || !hasScan.current) { setLoading(true); setError(false); }
    try {
      const value = await invoke<SteamLibraryScan>("games_scan_steam");
      value.games = value.games.map(game => ({ ...game, artwork: Object.fromEntries(Object.entries(game.artwork ?? {}).flatMap(([key, path]) => typeof path === "string" && path ? [[key, convertFileSrc(path)]] : [])) }));
      if (mounted.current) { hasScan.current = true; setScan(value); setError(false); }
    } catch { if (mounted.current) setError(true); }
    finally { running.current = false; if (mounted.current) setLoading(false); }
  }, [available]);
  const refresh = useCallback(() => scanLibrary(), [scanLibrary]);
  useEffect(() => {
    if (!active || !available) return;
    const check = (minimumAge: number) => {
      if (document.hidden) return;
      if (lastAttempt.current === null || Date.now() - lastAttempt.current >= minimumAge) void scanLibrary(true);
    };
    // Focus and visibility often arrive together; coalesce them without missing a return from Steam.
    const returned = () => check(2_000);
    returned();
    const timer = window.setInterval(() => check(30_000), 30_000);
    window.addEventListener("focus", returned);
    document.addEventListener("visibilitychange", returned);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", returned);
      document.removeEventListener("visibilitychange", returned);
    };
  }, [active, available, scanLibrary]);
  const launch = useCallback(async (appId: number) => {
    if (!available || launchLock.current) return;
    launchLock.current = true; setLaunching(appId); setLaunched(null); setLaunchError(false);
    try { await invoke("games_launch_steam", { appId }); if (mounted.current) setLaunched(appId); }
    catch { if (mounted.current) { setLaunchError(true); void refresh(); } }
    finally { launchLock.current = false; if (mounted.current) setLaunching(null); }
  }, [available, refresh]);
  useEffect(() => {
    if (launched === null) return;
    const timer = setTimeout(() => setLaunched(null), 5000);
    return () => clearTimeout(timer);
  }, [launched]);
  return { available, scan, loading, error, refresh, launching, launch, launched, launchError, dismissLaunchError: () => setLaunchError(false) };
}

export type SteamLibraryState = ReturnType<typeof useSteamLibrary>;
