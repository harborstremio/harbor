import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import { osClass } from "@/lib/platform";
import { customLaunchError } from "@/lib/games/custom-library";

export function GameExecutionPermission({ path, onFixed, disabled = false }: { path: string; onFixed: () => void; disabled?: boolean }) {
  const t = useT(), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const current = useRef(path), alive = useRef(true), pending = useRef(false);
  current.current = path;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (osClass() !== "linux") return null;
  const repair = async () => {
    if (pending.current || disabled) return;
    const selected = path; pending.current = true; setBusy(true); setError("");
    try {
      await invoke("games_allow_game_execution", { path: selected });
      if (alive.current && current.current === selected) onFixed();
    } catch (reason) { if (alive.current && current.current === selected) setError(customLaunchError(reason)); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  return <div><button type="button" className="games-button" disabled={busy || disabled} onClick={() => void repair()}><Check size={16}/>{t(busy ? "common.loading" : "games.custom.allowExecution")}</button>{error && <p role="alert">{t(error)}</p>}</div>;
}
