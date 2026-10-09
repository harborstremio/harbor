import { useEffect, useRef, useState } from "react";
import { changeSteamImports, emptySteamImports, readSteamImports, steamImportsKey, STEAM_IMPORTS_CHANGED, type ImportedSteamGame, type SteamImportExclusionChange } from "@/lib/games/steam-imports";

export function useSteamImports(profile: string) {
  const [state, setState] = useState({ profile, data: emptySteamImports(), ready: false, error: "" });
  const owner = useRef(profile); owner.current = profile;
  const refresh = () => {
    try { setState({ profile, data: readSteamImports(profile), ready: true, error: "" }); }
    catch { setState({ profile, data: emptySteamImports(), ready: false, error: "games.steamImport.readError" }); }
  };
  useEffect(() => {
    refresh();
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === steamImportsKey(profile)) refresh(); };
    const changed = (event: Event) => { if ((event as CustomEvent<string>).detail === profile) refresh(); };
    window.addEventListener("storage", storage); window.addEventListener(STEAM_IMPORTS_CHANGED, changed);
    return () => { window.removeEventListener("storage", storage); window.removeEventListener(STEAM_IMPORTS_CHANGED, changed); };
  }, [profile]);
  const current = state.profile === profile ? state : { profile, data: emptySteamImports(), ready: false, error: "" };
  const update = async (add: ImportedSteamGame[], remove: number[] = [], signal?: AbortSignal, exclusions?: SteamImportExclusionChange) => {
    if (!current.ready || owner.current !== profile) throw Error("steam_import_read");
    const result = await changeSteamImports(profile, add, remove, signal, exclusions);
    if (owner.current === profile) setState({ profile, data: result.data, ready: true, error: "" });
    return result.added;
  };
  return { ...current, refresh, update };
}
export type SteamImportLibrary = ReturnType<typeof useSteamImports>;
