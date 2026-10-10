import { importedArtworkFor, importedArtworkIcon } from "@/lib/games/imported-artwork";
import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { LIBRARY_PREFERENCES_CHANGED, changeLibraryPreferences, defaultLibraryPreference, emptyLibraryPreferences, libraryPreferenceKey, readLibraryPreferences, type LibraryPreference, type LibraryPreferences } from "@/lib/games/library-preferences";
import { changeLibraryTitles, type LibraryTitleChange } from "@/lib/games/library-preferences";
import { libraryTitle, matchesLibraryTitle, type LibraryTitleRules } from "@/lib/games/library-titles";
import { changeLibraryLinkOrders } from "@/lib/games/library-preferences";
import type { LibraryLinkChange } from "@/lib/games/library-links";
import { artworkBinding, matchingLibraryArtwork, igdbArtworkUrl, type LibraryArtwork } from "@/lib/games/igdb-artwork";
import { changeLibraryArtwork } from "@/lib/games/library-preferences";
import { changeLibraryMetadata } from "@/lib/games/library-preferences";
import { libraryMetadataMatch, type LibraryMetadataMatch } from "@/lib/games/library-metadata";
import type { GameSummary } from "@/lib/games/types";

export type ManagedLibraryItem = { id: string; name: string; cover?: string; game?: GameSummary };
export function useGameLibraryPreferences(profile: string, active: boolean) {
  const [state, setState] = useState<{ profile: string; data: LibraryPreferences }>({ profile, data: emptyLibraryPreferences() }), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [editing, setEditing] = useState<ManagedLibraryItem | null>(null), live = useRef(true), owner = useRef(profile), pending = useRef(false); owner.current = profile;
  const valid = () => live.current && owner.current === profile;
  const fail = (reason: unknown) => { const code = reason instanceof Error ? reason.message : String(reason); setError(code === "library_artwork_conflict" ? "games.artwork.conflict" : code === "library_metadata_conflict" ? "games.metadata.conflict" : code === "library_links_conflict" ? "games.links.conflict" : code === "library_title_conflict" ? "games.titles.conflict" : ["library_prefs_read", "library_prefs_limit", "library_prefs_art"].includes(code) ? `games.libraryPersonal.${code}` : "games.libraryPersonal.library_prefs_write"); };
  const refresh = () => { try { const data = readLibraryPreferences(profile); setState({ profile, data }); setReady(true); setError(""); } catch (reason) { setReady(false); fail(reason); } };
  useEffect(() => { live.current = true; pending.current = false; setBusy(false); setReady(false); setEditing(null); refresh(); const storage = (event: StorageEvent) => { if (event.key === libraryPreferenceKey(profile)) refresh(); }; const changed = (event: Event) => { if ((event as CustomEvent<string>).detail === profile) refresh(); }; window.addEventListener("storage", storage); window.addEventListener(LIBRARY_PREFERENCES_CHANGED, changed); return () => { live.current = false; window.removeEventListener("storage", storage); window.removeEventListener(LIBRARY_PREFERENCES_CHANGED, changed); }; }, [profile]);
  useEffect(() => { if (!active) setEditing(null); }, [active]);
  const data = state.profile === profile ? state.data : emptyLibraryPreferences();
  const write = async (ids: string[], patch: Partial<LibraryPreference>) => { const data = await changeLibraryPreferences(profile, ids, patch); if (valid()) { setState({ profile, data }); setError(""); } };
  const update = async (ids: string[], patch: Partial<LibraryPreference>) => {
    if (!ready || pending.current) return false; pending.current = true; setBusy(true);
    try { await write(ids, patch); return true; } catch (reason) { if (valid()) fail(reason); return false; } finally { if (valid()) { pending.current = false; setBusy(false); } }
  };
  const chooseCover = async (id: string, title: string) => {
    if (!ready || pending.current || !isTauri()) return; pending.current = true; setBusy(true); setError("");
    try { const { open } = await import("@tauri-apps/plugin-dialog"); const path = await open({ title, multiple: false, directory: false, filters: [{ name: title, extensions: ["png", "jpg", "jpeg", "webp", "gif"] }] }); if (typeof path !== "string" || !valid()) return;
      const canonical = await invoke<string>("games_validate_custom_artwork", { path });
      await new Promise<void>((resolve, reject) => { const image = new Image(), timer = setTimeout(() => reject(Error("library_prefs_art")), 8000); image.onload = () => { clearTimeout(timer); image.naturalWidth > 0 && image.naturalWidth * image.naturalHeight <= 40_000_000 ? resolve() : reject(Error("library_prefs_art")); }; image.onerror = () => { clearTimeout(timer); reject(Error("library_prefs_art")); }; image.src = convertFileSrc(canonical); });
      if (valid()) await write([id], { cover: canonical });
    } catch { if (valid()) setError("games.libraryPersonal.library_prefs_art"); } finally { if (valid()) { pending.current = false; setBusy(false); } }
  };
  const get = (id: string) => data.entries[id] ?? defaultLibraryPreference();
  const title = (id: string, original: string) => libraryTitle(id,original,data.entries[id],data.titleRules);
  const matchesTitle = (id: string, original: string, query: string) => matchesLibraryTitle(query,original,title(id,original));
  const updateTitles = async (changes: LibraryTitleChange[], rules: LibraryTitleRules, expectedRules: LibraryTitleRules | undefined) => {
    if (!ready || pending.current) return false; pending.current = true; setBusy(true);
    try { const next = await changeLibraryTitles(profile,changes,rules,expectedRules); if (valid()) { setState({profile,data:next}); setError(""); } return true; }
    catch (reason) { if (valid()) fail(reason); return false; }
    finally { if (valid()) { pending.current = false; setBusy(false); } }
  };
  const artwork = (id: string, game?: GameSummary) => matchingLibraryArtwork(data.entries[id]?.artwork, artworkBinding(id, game, data.entries[id]?.metadata?.igdbId));
  const imported = (id: string, game?: GameSummary) => data.entries[id]?.metadata ? data.entries[id].metadata?.importedArtwork : importedArtworkFor(game);
  const icon = (id: string, game?: GameSummary) => { const path=data.entries[id]?.cover,chosen=artwork(id,game)?.cover; return path && isTauri() ? convertFileSrc(path) : chosen ? igdbArtworkUrl(chosen) : importedArtworkIcon(imported(id,game)); };
  const cover = (id: string, game?: GameSummary) => { const entry=data.entries[id],path=entry?.cover,chosen=artwork(id,game)?.cover ?? imported(id,game)?.cover; return path && isTauri() ? convertFileSrc(path) : (chosen ? igdbArtworkUrl(chosen) : undefined) || entry?.metadata?.portrait || entry?.metadata?.capsule || undefined; };
  const background = (id: string, game?: GameSummary) => { const chosen=artwork(id,game)?.background,base=imported(id,game); return chosen ? igdbArtworkUrl(chosen) : base ? base.background ? igdbArtworkUrl(base.background) : null : undefined; };
  const updateArtwork = async (id: string, value: LibraryArtwork | null, expected?: LibraryArtwork, expectedMetadata?: LibraryMetadataMatch) => {
    if (!ready || pending.current || !valid()) return false; pending.current=true; setBusy(true); setError("");
    try { const next=await changeLibraryArtwork(profile,id,value,expected,expectedMetadata); if(valid()){setState({profile,data:next});setError("");} return true; }
    catch(reason){if(valid())fail(reason);return false;}
    finally{if(valid()){pending.current=false;setBusy(false);}}
  };
  const updateMetadata = async (id: string, game: GameSummary | null, expected?: LibraryMetadataMatch, signal?: AbortSignal) => {
    if (!ready || pending.current || !valid()) return false; pending.current=true; setBusy(true); setError("");
    try { const next=await changeLibraryMetadata(profile,id,game?libraryMetadataMatch(game):null,expected,signal); if(valid()){setState({profile,data:next});setError("");} return true; }
    catch(reason){if(valid())fail(reason);return false;}
    finally{if(valid()){pending.current=false;setBusy(false);}}
  };
  const updateLinkOrders = async (changes: LibraryLinkChange[]) => {
    if (!ready || pending.current) return false; pending.current = true; setBusy(true);
    try { const next = await changeLibraryLinkOrders(profile,changes); if (valid()) {setState({profile,data:next});setError("");} return true; }
    catch (reason) {if (valid()) fail(reason);return false;}
    finally {if (valid()) {pending.current=false;setBusy(false);}}
  };
  return { profile, data, ready, busy, error, get, title, matchesTitle, cover, icon, background, updateArtwork, update, updateTitles, updateLinkOrders, updateMetadata, chooseCover, refresh, editing, manage: setEditing, dismissError: () => setError("") };
}
export type GameLibraryPreferences = ReturnType<typeof useGameLibraryPreferences>;
