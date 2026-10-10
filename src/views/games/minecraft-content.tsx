import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import type { MinecraftInstance } from "@/lib/games/minecraft-instances";
import { GameArt } from "./game-art";
import { GameMods } from "./game-mods";
import "./minecraft-content.css";

export function MinecraftContentDialog({ profile, path, instance, close: onClose }: { profile: string; path: string; instance: MinecraftInstance; close: () => void }) {
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null), { closing, close } = useModalExit(onClose);
  const [query, setQuery] = useState(""), [projectOpen, setProjectOpen] = useState(false), input = useRef<HTMLInputElement>(null);
  useSectionBack(close, !projectOpen);
  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>(".mc-content-close")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || [...document.querySelectorAll('[role="dialog"]')].at(-1) !== root.current?.closest('[role="dialog"]')) return;
      const nodes = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]') ?? [])].filter(v => v.getClientRects().length);
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
    };
    document.addEventListener("keydown", trap); return () => document.removeEventListener("keydown", trap);
  }, []);
  return <ModalShell closing={closing} onDismiss={close} width={1120} labelledBy={id} backdropClassName="mc-content-scrim" dismissOnBackdrop={false}>
    <div className="mc-content" ref={root}>
      <header><div className="mc-content-art"><GameArt src={instance.pack?.icon || "/games/publisher/minecraft-java.jpg"} /></div><div><span>{t("games.minecraft.content.title")}</span><h2 id={id} dir="auto">{instance.name}</h2><p>Minecraft {instance.gameVersion}<i />Fabric {instance.loaderVersion}</p></div><button className="games-icon-button mc-content-close" onClick={close} aria-label={t("common.close")}><X size={20} /></button></header>
      <div className="mc-content-scroll"><div className="mc-content-intro"><p>{t("games.minecraft.content.compatible", { version: instance.gameVersion })}</p><label><Search size={17} /><input ref={input} value={query} onChange={event => setQuery(event.target.value)} aria-label={t("games.minecraft.content.search")} placeholder={t("games.minecraft.content.search")} />{query && <button className="games-icon-button" aria-label={t("games.clear")} onClick={() => { setQuery(""); input.current?.focus({ preventScroll: true }); }}><X size={15} /></button>}</label></div>
        <GameMods key={instance.id} profile={profile} query={query} active={!closing} embedded bound={{ id: instance.id, libraryPath: path, name: instance.name, loader: "fabric", gameVersion: instance.gameVersion }} onDialogChange={setProjectOpen} />
      </div>
    </div>
  </ModalShell>;
}
