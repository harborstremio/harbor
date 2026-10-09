import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, Layers } from "lucide-react";
import { useT } from "@/lib/i18n";
import { minecraftRuntimeError } from "@/lib/games/minecraft-runtime";
import { GameRequestPool } from "@/lib/games/request-pool";
import "./minecraft-loader-choice.css";

export type MinecraftCreation = { loader: "vanilla" | "fabric" | "quilt" | "forge" | "neoforge"; version: string; ready: boolean; game: string };
type Release = { version: string; stable: boolean };
const k = (key: string) => `games.minecraft.creation.${key}`;
const versionsPool = new GameRequestPool(2);
const loaders = { vanilla: { name: "Vanilla", art: "/games/publisher/minecraft-java.jpg" }, fabric: { name: "Fabric", art: "https://fabricmc.net/assets/logo.png" }, quilt: { name: "Quilt", art: "/games/publisher/quilt.png" }, forge: { name: "Forge", art: "/games/publisher/forge.png" }, neoforge: { name: "NeoForge", art: "/games/publisher/neoforge.png" } };

export function MinecraftLoaderChoice({ game, value, change, disabled }: { game: string; value: MinecraftCreation; change: (value: MinecraftCreation) => void; disabled: boolean }) {
  const t = useT(), [releases, setReleases] = useState<Release[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(0), [failedArt, setFailedArt] = useState<Record<string, boolean>>({});
  const loaderName = loaders[value.loader].name;
  const update = useRef(change); update.current = change;
  useEffect(() => {
    let disposed = false; const controller = new AbortController();
    if (value.loader === "vanilla") { update.current({ loader: "vanilla", version: "", ready: !!game, game }); return; }
    const loader = value.loader;
    setReleases([]); setError(""); setLoading(true); update.current({ loader, version: "", ready: false, game });
    queueMicrotask(() => {
      if (disposed || !game) { if (!disposed) setLoading(false); return; }
      void versionsPool.run(() => invoke<Release[]>("games_minecraft_loader_versions", { game, loader }), controller.signal).then(items => {
        if (disposed) return; setReleases(items); const selected = items.find(v => v.stable) ?? items[0]; update.current({ loader, version: selected?.version ?? "", ready: !!selected, game });
      }).catch(reason => { if (!disposed) setError(minecraftRuntimeError(reason)); }).finally(() => { if (!disposed) setLoading(false); });
    });
    return () => { disposed = true; controller.abort(); };
  }, [game, value.loader, retry]);
  const choose = (loader: MinecraftCreation["loader"]) => { if (loader !== value.loader) change({ loader, version: "", ready: loader === "vanilla" && !!game, game }); };
  return <div className="mc-creation-loader">
    <span>{t(k("style"))}</span><div role="group" aria-label={t(k("style"))}>
      {(Object.keys(loaders) as MinecraftCreation["loader"][]).map(loader => <button key={loader} type="button" aria-pressed={value.loader === loader} disabled={disabled} onClick={() => choose(loader)}>{failedArt[loader] ? <Layers size={34} /> : <img className={loader !== "vanilla" ? "mc-creation-fabric-art" : undefined} src={loaders[loader].art} alt="" onError={() => setFailedArt(current => ({ ...current, [loader]: true }))} />}<strong>{loaders[loader].name}</strong><span className="mc-creation-selected">{value.loader === loader && <Check size={14} />}</span></button>)}
    </div>
    <p className="mc-creation-loader-note">{t(k(`${value.loader}Note`))}</p>
    {value.loader !== "vanilla" && <div className="mc-creation-version">
      {loading ? <p role="status">{t(k("loading"), { loader: loaderName })}</p> : error ? <div className="mc-instance-error" role="alert"><span>{t(error)}</span><button className="games-button" disabled={disabled} onClick={() => setRetry(v => v + 1)}>{t("common.retry")}</button></div> : releases.length ? <label className="mc-instance-field">{t(k("version"), { loader: loaderName })}<select aria-label={t(k("version"), { loader: loaderName })} value={value.version} disabled={disabled} onChange={e => change({ loader: value.loader, version: e.target.value, ready: true, game })}>{releases.map(v => <option value={v.version} key={v.version}>{v.version}{!v.stable ? ` · ${t(k("preview"))}` : ""}</option>)}</select></label> : <p role="status">{t(k("unavailable"), { loader: loaderName, version: game })}</p>}
    </div>}
  </div>;
}
