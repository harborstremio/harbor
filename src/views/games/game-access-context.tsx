import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSteamLibrary } from "@/hooks/use-steam-library";
import { useSteamShortcuts } from "@/hooks/use-steam-shortcuts";
import { useSteamImports } from "@/hooks/use-steam-imports";
import { useLauncherLibrary } from "@/hooks/use-launcher-library";
import { useCustomGameLibrary } from "@/hooks/use-custom-game-library";
import { useEmulationLibrary } from "@/hooks/use-emulation-library";
import { useGameLibraryPreferences } from "@/hooks/use-game-library-preferences";
import { readSavedGames, writeSavedGames } from "@/lib/games/saved";
import { libraryFavoriteGames, libraryFavoriteKeys, quickLibrary } from "@/lib/games/quick-library";
import type { GameSummary } from "@/lib/games/types";
import { GameAccessContext, type GameAccessTarget } from "./game-access";
const GameRetroPlayer = lazy(() => import('./game-retro-player').then(module => ({ default: module.GameRetroPlayer })));
const GameCustomManager = lazy(() => import('./game-custom-library').then(module => ({ default: module.GameCustomManager })));
const GameSteamShortcutDetails = lazy(() => import('./game-steam-shortcuts').then(module => ({ default: module.GameSteamShortcutDetails })));

type Intent = { id: number; target: GameAccessTarget; external: boolean; origin?: HTMLElement };

function useAccess(profile: string, enabled: boolean, gamesActive: boolean, onNavigate?: () => void, onLeave?: () => void) {
  const [dockOpen, setDockOpen] = useState(false), [primed, setPrimed] = useState(false);
  const [repair, setRepair] = useState<{profile:string;id:string;origin?:HTMLElement}|null>(null);
  const [shortcutDetails,setShortcutDetails]=useState<{profile:string;id:string;origin?:HTMLElement}|null>(null);
  const [activity, setActivity] = useState({ custom: false, retro: false });
  const library = useSteamLibrary(enabled && (gamesActive || dockOpen || !primed));
  const shortcuts = useSteamShortcuts(profile,enabled && (gamesActive || dockOpen || shortcutDetails?.profile===profile));
  const steamImports = useSteamImports(profile);
  const launchers = useLauncherLibrary(enabled && (gamesActive || dockOpen), profile);
  const libraryPreferences = useGameLibraryPreferences(profile, enabled);
  const customLibrary = useCustomGameLibrary(profile, enabled && (gamesActive || dockOpen || activity.custom || repair?.profile === profile));
  const emulation = useEmulationLibrary(profile, enabled && (dockOpen || activity.retro));
  const [savedState, setSavedState] = useState(() => ({ profile, games: readSavedGames(profile) }));
  const [saveFailed, setSaveFailed] = useState(false);
  const [intent, setIntent] = useState<Intent|null>(null), serial = useRef(0);
  const consumed = useRef(0);
  useEffect(() => { if (library.scan || library.error || !library.available) setPrimed(true); }, [library.scan, library.error, library.available]);
  useEffect(() => { setDockOpen(false); setIntent(null); setActivity({ custom: false, retro: false }); setSavedState({ profile, games: readSavedGames(profile) }); setSaveFailed(false); }, [profile]);
  useEffect(() => { if (!enabled) { setDockOpen(false); setRepair(null); } }, [enabled]);
  useEffect(() => setRepair(null), [profile]);
  const storedSaved = savedState.profile === profile ? savedState.games : [];
  const quick = useMemo(() => quickLibrary(library.scan?.games ?? [], customLibrary.data.games, emulation.data, storedSaved, libraryPreferences.data, launchers.scan, { shortcuts: shortcuts.games }), [library.scan, customLibrary.data.games, emulation.data, storedSaved, libraryPreferences.data, launchers.scan, shortcuts.games]);
  const saved = useMemo(() => libraryFavoriteGames(storedSaved, quick), [storedSaved, quick]);
  const saving = useRef(false), owner = useRef(profile); owner.current = profile;
  const save = async (game: GameSummary) => {
    if (saving.current) return false;
    saving.current = true;
    const keys = libraryFavoriteKeys(game, quick), removing = saved.some(item => keys.has(item.id));
    const next = removing ? storedSaved.filter(item => !keys.has(item.id)) : [game, ...storedSaved];
    try {
      if (removing) {
        const entries = quick.filter(item => keys.has(item.id) || !!item.game && keys.has(item.game.id));
        const ids = entries.filter(item => libraryPreferences.data.entries[item.id]?.pinned).map(item => item.id);
        for (const id of keys) if (libraryPreferences.data.entries[id]?.pinned && !ids.includes(id)) ids.push(id);
        if (ids.length && !await libraryPreferences.update(ids, { pinned: false })) throw Error("favorite_write");
        for (const item of entries) if (item.source === "custom" && item.custom.pinned) {
          if (owner.current !== profile || !await customLibrary.update(item.custom.id, { pinned: false })) throw Error("favorite_write");
        }
      }
      if (owner.current !== profile) return false;
      writeSavedGames(profile, next); setSavedState({ profile, games: next }); setSaveFailed(false); return true;
    } catch { if (owner.current === profile) setSaveFailed(true); return false; }
    finally { saving.current = false; }
  };
  const navigate = (target: GameAccessTarget, origin?: HTMLElement) => { setDockOpen(false); setIntent({ id: ++serial.current, target, external: !gamesActive, origin }); onNavigate?.(); };
  const repairCustom = (id:string,origin?:HTMLElement) => setRepair({profile,id,origin});
  const closeRepair = () => { const origin=repair?.origin; setRepair(null); requestAnimationFrame(()=>{if(origin?.isConnected)origin.focus({preventScroll:true});}); };
  const openShortcut=(id:string,origin?:HTMLElement)=>{setDockOpen(false);setShortcutDetails({profile,id,origin});};
  const closeShortcut=()=>{const origin=shortcutDetails?.origin;setShortcutDetails(null);requestAnimationFrame(()=>{if(origin?.isConnected)origin.focus({preventScroll:true});});};
  useEffect(()=>setShortcutDetails(null),[profile,enabled]);
  return { profile, library, shortcuts, steamImports, openShortcut, closeShortcut, shortcutDetails, launchers, libraryPreferences, customLibrary, emulation, saved, save, saveFailed, setSaveFailed, dockOpen, setDockOpen, setActivity, intent, consumed, navigate, repair, repairCustom, closeRepair, leave: onLeave };
}
export type GameAccessValue = ReturnType<typeof useAccess>;
export function GameAccessProvider({ profile, enabled = true, gamesActive, onNavigate, onLeave, children }: { profile: string; enabled?: boolean; gamesActive: boolean; onNavigate?: () => void; onLeave?: () => void; children: ReactNode }) {
  const value = useAccess(profile, enabled, gamesActive, onNavigate, onLeave);
  return <GameAccessContext.Provider value={value}>{children}{value.shortcutDetails?.profile===profile&&<Suspense fallback={null}><GameSteamShortcutDetails key={`${profile}:${value.shortcutDetails.id}`} id={value.shortcutDetails.id} library={value.shortcuts} onClose={value.closeShortcut}/></Suspense>}{value.repair?.profile===profile&&<Suspense fallback={null}><GameCustomManager key={`${profile}:${value.repair.id}`} id={value.repair.id} library={value.customLibrary} onClose={value.closeRepair}/></Suspense>}{value.emulation.session && value.emulation.session.profile === profile && <Suspense fallback={null}><GameRetroPlayer key={value.emulation.session.sessionId} game={value.emulation.session} close={value.emulation.closeSession} onStarted={value.emulation.sessionStarted}/></Suspense>}</GameAccessContext.Provider>;
}
