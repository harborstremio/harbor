import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";
import { minecraftCatalogRequest, minecraftProject, minecraftProjects, type MinecraftProject } from "@/lib/games/minecraft-catalog";
import { GameArt } from "./game-art";
import "./minecraft-spotlight.css";

/** A small visual selection from the provider's download-ranked modpacks, not a personal recommendation. */
export function MinecraftSpotlight({ active, open, browse, fallback }: { active: boolean; open: (project: MinecraftProject) => void; browse: () => void; fallback: string }) {
  const t = useT(), [projects, setProjects] = useState<MinecraftProject[]>([]), [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [original, setOriginal] = useState<{ id: string; art: string } | null>(null);
  const project = projects[index];
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); setLoading(true); setFailed(false);
    void minecraftCatalogRequest({ kind: "search", type: "modpack", sort: "downloads" }, controller.signal)
      .then(minecraftProjects).then(result => {
        if (controller.signal.aborted) return;
        const visible = result.hits.filter(value => value.art).slice(0, 4);
        // Only the four small previews warm here; full-size artwork loads for the selected project.
        visible.forEach(value => { const preview = new Image(); preview.src = value.art; });
        setProjects(visible); setIndex(value => Math.min(value, Math.max(0, visible.length - 1)));
      }).catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active, attempt]);
  useEffect(() => {
    if (!active || !project) return;
    const controller = new AbortController();
    void minecraftCatalogRequest({ kind: "project", query: project.id }, controller.signal).then(minecraftProject).then(detail => {
      if (!controller.signal.aborted && detail.id === project.id) setOriginal({ id: project.id, art: detail.art });
    }).catch(() => {});
    return () => controller.abort();
  }, [active, project?.id]);
  return <section className="mc-spotlight games-inset" aria-label={t("games.minecraft.spotlight.title")}>
    <GameArt className="mc-world-art" src={project?.art || fallback} fallback={project ? undefined : "/games/publisher/minecraft-java.jpg"} eager />
    {project && original?.id === project.id && original.art !== project.art && <GameArt className="mc-world-art mc-spotlight-original" src={original.art} eager />}
    <div className="mc-world-shade" />
    <div className="mc-spotlight-brand"><img src="/games/minecraft/wordmark.svg" alt="Minecraft" /><span>Java Edition</span></div>
    <div className="mc-spotlight-body" aria-busy={loading && !project}>
      {project ? <>
        <div className="mc-spotlight-heading"><span>{t("games.minecraft.spotlight.title")}</span><span>Modrinth</span></div>
        <h2><bdi>{project.title}</bdi></h2>
        <p><bdi>{project.description}</bdi></p>
        <div className="mc-spotlight-byline"><GameArt src={project.icon} eager /><span><bdi>{project.author}</bdi></span><span className="mc-spotlight-count"><Download size={14} />{t("games.minecraft.spotlight.downloads", { count: new Intl.NumberFormat(document.documentElement.lang || "en", { notation: "compact", maximumFractionDigits: 1 }).format(project.downloads) })}</span></div>
      </> : loading ? <div className="mc-spotlight-placeholder"><i /><i /><i /><span className="sr-only">{t("common.loading")}</span></div> : <><h2>{t("games.minecraft.heroTitle")}</h2><p>{t(failed ? "games.minecraft.spotlight.unavailable" : "games.minecraft.heroNote")}</p></>}
    </div>
    <div className="mc-spotlight-footer">
      <div className="mc-world-actions">
        {project && <button className="games-button mc-spotlight-open" onClick={() => open(project)}>{t("games.minecraft.spotlight.view")}<ArrowRight size={17} /></button>}
        <button className={project ? "mc-spotlight-browse" : "games-button"} onClick={browse}>{t("games.minecraft.spotlight.browse")}{!project && <ArrowRight size={17} />}</button>
        {failed && !project && <button className="mc-spotlight-browse" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} />{t("common.retry")}</button>}
      </div>
      {project && <div className="mc-spotlight-controls"><span className="mc-spotlight-position" dir="ltr" aria-live="polite" aria-atomic="true">{index + 1}<span>/ {projects.length}</span></span><button aria-label={t("common.previous")} disabled={projects.length < 2} onClick={() => setIndex(value => (value + projects.length - 1) % projects.length)}><ChevronLeft size={18} /></button><button aria-label={t("common.next")} disabled={projects.length < 2} onClick={() => setIndex(value => (value + 1) % projects.length)}><ChevronRight size={18} /></button></div>}
    </div>
  </section>;
}
