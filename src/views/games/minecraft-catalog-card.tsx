import { History, Image as ImageIcon, Layers } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { minecraftCatalogVersions, type MinecraftProject } from "@/lib/games/minecraft-catalog";
import { GameArt } from "./game-art";
import { ModGameMark } from "./mod-identity";
import { ModStats } from "./mod-stats";
import { minecraftLoaderLabel } from "./minecraft-project-versions";

export function MinecraftCatalogCard({ project, view, game, open }: { project: MinecraftProject; view: "list" | "grid"; game: string; open: (origin: HTMLButtonElement) => void }) {
  const t = useT(), language = useUiLanguage();
  const versions = minecraftCatalogVersions(project.versions, game), shown = versions.slice(0, 2);
  const date = new Date(project.updated), updated = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(language, { month: "short", day: "numeric", year: "numeric" }).format(date) : "";
  const image = view === "list" ? project.icon || project.art : project.art || project.icon;
  return <button className={`mc-project-card${project.art ? " has-art" : ""}`} onClick={event => open(event.currentTarget)}>
    <div className="mc-project-cover">{image ? <GameArt src={image} fallback={project.icon}/> : <ImageIcon size={36}/>}</div>
    <div className="mc-project-copy">
      <div className="mc-project-name"><h3 dir="auto">{project.title}</h3>{project.author && <span dir="auto">{project.author}</span>}</div>
      <p dir="auto">{project.description}</p>
      <div className="mc-project-compatibility">
        {!!shown.length && <span className="mc-project-games" title={`${t("games.minecraft.catalog.gameVersion")}: ${versions.join(", ")}`}><ModGameMark game="minecraft"/><bdi dir="ltr">Minecraft {shown.join(", ")}{versions.length > shown.length && <span className="mc-project-more"> +{versions.length - shown.length}</span>}</bdi></span>}
        {!!project.loaders.length && <span className="mc-project-loaders" title={t("games.minecraft.catalog.loader")}><Layers size={16}/><span>{project.loaders.map(minecraftLoaderLabel).join(" · ")}</span></span>}
        {!!project.categories.length && <span className="mc-project-categories">{project.categories.slice(0, 2).map(minecraftLoaderLabel).join(" · ")}</span>}
      </div>
      <div className="mc-project-metrics"><ModStats values={{ downloads: project.downloads, followers: project.followers }} compact/>{updated && <span className="mc-project-updated" title={`${t("games.minecraft.catalog.updated")} ${updated}`}><History size={16}/><span>{t("games.minecraft.catalog.updated")} <time dateTime={project.updated}>{updated}</time></span></span>}</div>
    </div>
  </button>;
}

export function MinecraftCatalogSkeleton() {
  return <div className="mc-project-card mc-project-skeleton" aria-hidden="true"><div className="mc-project-cover"/><div className="mc-project-copy"><div className="mc-project-name"><i/><i/></div><p><i/><i/></p><div className="mc-project-compatibility"><i/><i/></div><div className="mc-project-metrics"><i/><i/></div></div></div>;
}
