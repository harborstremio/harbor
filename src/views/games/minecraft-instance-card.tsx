import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowDownToLine, Box, FolderOpen, History, Layers } from "lucide-react";
import { useT } from "@/lib/i18n";
import { minecraftCatalogRequest, minecraftProject } from "@/lib/games/minecraft-catalog";
import type { MinecraftInstance } from "@/lib/games/minecraft-instances";
import type { MinecraftLifecycleAction } from "@/lib/games/minecraft-lifecycle";
import { transferBytes } from "@/lib/games/transfers";
import { GameArt } from "./game-art";
import { MinecraftInstanceMenu } from "./minecraft-instance-menu";

type Artwork = { art: string; icon: string };
type Action = "runtime" | "content" | "updates" | "rename" | MinecraftLifecycleAction;
const loaderName = (value: string) => value === "neoforge" ? "NeoForge" : value[0].toUpperCase() + value.slice(1);

/** Only visible pack identities are enriched. The shared catalog pool bounds requests to three. */
export function useMinecraftInstanceArtwork(root: RefObject<HTMLElement | null>, active: boolean, identities: string, retry: number) {
  const [artwork, setArtwork] = useState<Record<string, Artwork>>({});
  const known = useRef(artwork); known.current = artwork;
  useEffect(() => {
    if (!active || !root.current) return;
    const controller = new AbortController(), started = new Set<string>();
    const load = (node: Element) => {
      const id = node.getAttribute("data-mc-project");
      if (!id || started.has(id) || known.current[id]) return;
      started.add(id);
      void minecraftCatalogRequest({ kind: "project", query: id }, controller.signal).then(minecraftProject).then(project => {
        if (controller.signal.aborted || project.id !== id || project.type !== "modpack") return;
        setArtwork(current => ({ ...current, [id]: { art: project.art, icon: project.icon } }));
      }).catch(() => {});
    };
    const nodes = root.current.querySelectorAll("[data-mc-project]");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { observer.unobserve(entry.target); load(entry.target); }
    }, { rootMargin: "160px" });
    nodes.forEach(node => observer.observe(node));
    return () => { controller.abort(); observer.disconnect(); };
  }, [root, active, identities, retry]);
  return artwork;
}

export function MinecraftInstanceCard({ instance, artwork, choose, openFolder }: {
  instance: MinecraftInstance; artwork?: Artwork; choose: (action: Action) => void; openFolder: () => void;
}) {
  const t = useT(), pack = instance.pack;
  const icon = pack?.icon || artwork?.icon || "";
  return <article className="mc-instance-card" data-mc-project={pack?.project || undefined}>
    <div className={`mc-instance-art${pack ? " is-pack" : ""}`}>
      {!pack && <GameArt className="mc-instance-scene" src="/games/publisher/minecraft-java.jpg" />}
      {pack && artwork?.art && <GameArt className="mc-instance-scene mc-instance-gallery" src={artwork.art} />}
      {pack && <div className="mc-instance-emblem">{icon ? <GameArt src={icon} /> : <Layers size={36} />}</div>}
      <span className="mc-instance-kind">{pack ? <Layers size={14} /> : <Box size={14} />}{pack ? t("games.minecraft.instances.packLabel") : "Minecraft: Java Edition"}</span>
    </div>
    <div className="mc-instance-copy">
      <div className="mc-instance-identity"><div><h3><bdi>{instance.name}</bdi></h3><p><bdi>{pack?.name || "Minecraft: Java Edition"}</bdi></p></div><MinecraftInstanceMenu name={instance.name} choose={choose} /></div>
      <div className="mc-instance-environment"><span dir="ltr">{instance.gameVersion}</span><span><bdi>{loaderName(instance.loader)}{instance.loaderVersion && ` ${instance.loaderVersion}`}</bdi></span></div>
      <div className="mc-instance-details">{pack && <span title={pack.version}><bdi>{pack.version}</bdi></span>}<small>{t(`games.minecraft.instances.${pack ? "files" : "newWorld"}`, { count: instance.files })}{instance.bytes > 0 && <> · <bdi dir="ltr">{transferBytes(instance.bytes)}</bdi></>}</small></div>
      <footer>
        <button className="games-button mc-instance-setup" onClick={() => choose("runtime")}><ArrowDownToLine size={16} />{t("games.minecraft.runtime.setup")}</button>
        <div className="mc-instance-utilities">{instance.loader === "fabric" && <button className="mc-instance-manage" onClick={() => choose("content")}><Box size={16} />{t("games.minecraft.content.title")}</button>}<div className="mc-instance-tools">{pack && <button className="games-icon-button" title={t("games.minecraft.update.title")} aria-label={t("games.minecraft.update.title")} onClick={() => choose("updates")}><History size={17} /></button>}<button className="games-icon-button" title={t("games.minecraft.instances.openFolder")} aria-label={t("games.minecraft.instances.openFolder")} onClick={openFolder}><FolderOpen size={17} /></button></div></div>
      </footer>
    </div>
  </article>;
}
