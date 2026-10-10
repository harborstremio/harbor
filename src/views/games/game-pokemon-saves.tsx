import { useEffect, useRef, useState } from "react";
import { FolderOpen, RefreshCw, Save } from "lucide-react";
import { useT } from "@/lib/i18n";
import { pokemonBankRequest, type PokemonDetectedSave, type PokemonLocalRom } from "@/lib/games/pokemon-bank";

export function PokemonDetectedSaves({ profile, roms, active, disabled, open }: {
  profile: string; roms: PokemonLocalRom[]; active: boolean; disabled: boolean; open: (path: string) => void;
}) {
  const t = useT(), [data, setData] = useState<PokemonDetectedSave[]>(), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(roms.slice(0, 8));
  const loaded = useRef("");
  useEffect(() => {
    const token = `${profile}:${key}:${attempt}`;
    if (!active || !roms.length || loaded.current === token) return;
    let cancelled = false;
    setBusy(true); setFailed(false);
    void pokemonBankRequest(profile, { op: "discover", roms: JSON.parse(key) }).then(result => {
      if (!cancelled) { setData(result.saves ?? []); loaded.current = token; }
    }).catch(() => { if (!cancelled) setFailed(true); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [profile, key, attempt, active]);
  if (!roms.length) return null;
  return <section className="pokemon-detected-saves" aria-label={t("games.pokemon.detectedSaves")}>
    <header><h4>{t("games.pokemon.detectedSaves")}</h4><button type="button" disabled={busy} aria-label={t("games.pokemon.refreshSaves")} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={19}/></button></header>
    {busy && !data ? <div className="pokemon-save-skeleton pokemon-skeleton" role="status" aria-label={t("common.loading")}><div><span/><b/><i/></div></div> : failed ? <p role="alert">{t("games.pokemon.discoverFailed")}</p> : data?.length ? <div>{data.map(item => <button key={item.path} type="button" disabled={disabled || busy} onClick={() => open(item.path)} title={item.path}>
      {item.origin === "harbor" ? <Save size={24}/> : <FolderOpen size={24}/>}<span><strong>{item.romName}</strong><small>{t(`games.pokemon.saveOrigin.${item.origin}`)} · {new Date(item.modified * 1000).toLocaleString()}</small></span><FolderOpen size={19}/>
    </button>)}</div> : <p>{t("games.pokemon.noDetectedSaves")}</p>}
  </section>;
}
