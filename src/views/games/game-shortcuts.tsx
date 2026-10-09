import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Plus } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useT } from "@/lib/i18n";
import { osClass } from "@/lib/platform";
import type { CustomGame } from "@/lib/games/custom-library";
import { shortcutError, type GameShortcuts, type GameShortcutTarget } from "@/lib/games/shortcuts";
import "./game-shortcuts.css";

function StartMenuMark() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 16h18M8 6v3m4-3v3m4-3v3M7 12h2m3 0h2M7 18.5h7"/></svg>;
}

export function GameShortcuts({ game }: { game: CustomGame }) {
  const t = useT(), [result, setResult] = useState<GameShortcuts>(), [busy, setBusy] = useState<GameShortcutTarget | null>(null), [error, setError] = useState("");
  const live = useRef(true), pending = useRef(false), supported = osClass() === "windows" && game.config.mode === "native";
  const identity = JSON.stringify([game.id, game.name, game.config]);
  const currentIdentity = useRef(identity); currentIdentity.current = identity;
  useEffect(() => {
    live.current = true;
    if (!supported) return;
    let current = true;
    setResult(undefined); setError("");
    const deadline = window.setTimeout(() => { if (current) { current = false; setResult({ desktop: null, startMenu: null }); setError("games.setupShortcuts.error"); } }, 10000);
    void invoke<GameShortcuts>("games_game_shortcuts", { id: game.id, name: game.name, config: game.config, target: null }).then(value => {
      if (current) { clearTimeout(deadline); setResult(value); }
    }, reason => { if (current) { clearTimeout(deadline); setResult({ desktop: null, startMenu: null }); setError(shortcutError(reason)); } });
    return () => { current = false; live.current = false; clearTimeout(deadline); };
  }, [identity, supported]);
  const create = async (target: GameShortcutTarget) => {
    if (pending.current) return;
    pending.current = true; setBusy(target); setError("");
    try {
      const value = await invoke<GameShortcuts>("games_game_shortcuts", { id: game.id, name: game.name, config: game.config, target });
      if (live.current && currentIdentity.current === identity) setResult(value);
    } catch (reason) { if (live.current && currentIdentity.current === identity) setError(shortcutError(reason)); }
    finally { pending.current = false; if (live.current && currentIdentity.current === identity) setBusy(null); }
  };
  if (!supported) return null;
  return <section className="games-shortcuts" aria-busy={!result || !!busy}>
    <h4>{t("games.setupShortcuts.title")}</h4><p>{t("games.setupShortcuts.note")}</p>
    <div>{(["startMenu", "desktop"] as const).map(target => <button type="button" key={target} className="games-shortcut" disabled={!result || !!busy || !!result[target]} onClick={() => void create(target)}>
      {target === "startMenu" ? <StartMenuMark/> : <Monitor size={22}/>}<span><strong>{t(`games.setupShortcuts.${target}`)}</strong><small>{!result ? <i/> : t(result[target] ? "games.setupShortcuts.added" : busy === target ? "games.setupShortcuts.adding" : "games.setupShortcuts.add")}</small></span>{result?.[target] ? <Check className="games-shortcut-check" size={18}/> : <Plus size={18}/>}
    </button>)}</div>
    {error && <p className="games-shortcuts-error" role="alert">{t(error)}</p>}
  </section>;
}
