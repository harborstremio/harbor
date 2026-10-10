import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, Plus } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { EMULATION_SYSTEMS, emulationError, type RomScan } from "@/lib/games/emulation";
import { useOptionalGameAccess } from "./game-access";
import { setupPath, type SetupEntry } from "@/lib/games/setup";

export function GameSetupRom({ entry, profile, disabled, openLibrary }: { entry: SetupEntry; profile: string; disabled: boolean; openLibrary: () => void }) {
  const t = useT(), access = useOptionalGameAccess();
  const extension = entry.path.split(".").at(-1)?.toUpperCase();
  const systems = EMULATION_SYSTEMS.filter(system => system.extensions.split(" · ").includes(extension ?? ""));
  const [system, setSystem] = useState(systems.length === 1 ? systems[0].id : 0);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const revision = useRef(0), pending = useRef(false), currentAccess = useRef(access); currentAccess.current = access;
  useEffect(() => () => { revision.current++; }, [profile, entry.path]);
  const added = !!access?.emulation.data.folders.some(folder => folder.system === system && folder.games.some(game => setupPath(game.path) === setupPath(entry.path)));
  const add = async () => {
    if (!system || pending.current || disabled || !access || access.profile !== profile) return;
    pending.current = true; setBusy(true); setError(""); const token = revision.current;
    try {
      const parent = entry.path.replace(/[\\/][^\\/]+$/, "");
      const scan = await invoke<RomScan>("games_scan_roms", { root: parent, system });
      if (revision.current !== token || currentAccess.current?.profile !== profile) return;
      const game = scan.games.find(game => setupPath(game.path) === setupPath(entry.path));
      if (!game || !game.available) throw Error(game?.issue || "emulation_missing_file");
      if (!currentAccess.current.emulation.addOutput({ ...game, root: scan.root })) throw Error("import failed");
    } catch (reason) { if (revision.current === token) setError(emulationError(reason)); }
    finally { pending.current = false; if (revision.current === token) setBusy(false); }
  };
  if (!systems.length) return null;
  return <section className="games-setup-rom">
    <strong title={entry.path}>{entry.relativePath}</strong>
    <div className="games-setup-file-tools">
      <fieldset disabled={disabled || busy}><Dropdown ariaLabel={t("games.platforms")} value={String(system)} onChange={value => { if (disabled || busy) return; setSystem(Number(value)); setError(""); }} options={[...(systems.length > 1 ? [{ value: "0", label: t("games.platforms") }] : []), ...systems.map(item => ({ value: String(item.id), label: item.name }))]}/></fieldset>
      {added ? <button className="games-button" onClick={openLibrary}><Check size={17}/>{t("games.emulation.library")}</button> : <button className="games-button" disabled={disabled || busy || !system || !access?.emulation.available || access.profile !== profile} onClick={() => void add()}><Plus size={17}/>{t(busy ? "games.emulation.importing" : "games.setup.add")}</button>}
    </div>
    {error && <p className="games-setup-error" role="alert">{t(error)}</p>}
  </section>;
}
