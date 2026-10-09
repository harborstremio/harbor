import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, RefreshCw } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { useT } from "@/lib/i18n";
import { minecraftCatalogRequest, minecraftProject, minecraftProjects } from "@/lib/games/minecraft-catalog";
import { simsCancel, simsMtsBrowse } from "@/lib/games/sims";
import { MOD_GAMES, minecraftModCard, simsModCard, type ModDiscoveryProject, type ModsRoute } from "@/lib/games/mod-workspace";
import { ModProviderLogo } from "./mod-identity";
import { ModStats } from "./mod-stats";
import { ModGameLogo, ModImage, ModProjectCard } from "./mod-workspace-parts";

export function ModsHome({ active, profile, query, navigate }: { active: boolean; profile: string; query: string; navigate: (route: ModsRoute, origin?: HTMLElement) => void }) {
  const t = useT();
  const [packs, setPacks] = useState<ModDiscoveryProject[]>([]), [mods, setMods] = useState<ModDiscoveryProject[]>([]), [sims, setSims] = useState<ModDiscoveryProject[]>([]);
  const [status, setStatus] = useState<Record<string, "loading" | "ready" | "error">>({ packs: "loading", mods: "loading", sims: "loading" });
  const [attempt, setAttempt] = useState(0), loaded = useRef("");
  const [term, setTerm] = useState(query.trim());
  useEffect(() => { const timer = setTimeout(() => setTerm(query.trim()), 600); return () => clearTimeout(timer); }, [query]);
  const [slide, setSlide] = useState(0), [paused, setPaused] = useState(false), [hovering, setHovering] = useState(false);
  useEffect(() => {
    const requestKey = `${profile}:${attempt}:${term}`;
    if (!active || loaded.current === requestKey) return;
    const controller = new AbortController(), operation = crypto.randomUUID();
    const requests = [
      ["packs", minecraftCatalogRequest({ kind: "search", type: "modpack", query: term, sort: term ? "relevance" : "downloads" }, controller.signal, attempt > 0).then(minecraftProjects).then(value => { if (!controller.signal.aborted) setPacks(value.hits.map(minecraftModCard)); })],
      ["mods", minecraftCatalogRequest({ kind: "search", type: "mod", query: term, sort: term ? "relevance" : "downloads" }, controller.signal, attempt > 0).then(minecraftProjects).then(value => { if (!controller.signal.aborted) setMods(value.hits.map(minecraftModCard)); })],
      ["sims", isTauri() ? simsMtsBrowse(profile, { category: 38, sort: 7, query: term, page: 1 }, operation, attempt > 0).then(value => { if (!controller.signal.aborted) setSims(value.projects.map(simsModCard)); }) : Promise.reject(Error("desktop"))],
    ] as const;
    setPacks([]); setMods([]); setSims([]);
    setStatus({ packs: "loading", mods: "loading", sims: "loading" });
    void Promise.allSettled(requests.map(async ([key, request]) => { try { await request; if (!controller.signal.aborted) setStatus(previous => ({ ...previous, [key]: "ready" })); } catch { if (!controller.signal.aborted) setStatus(previous => ({ ...previous, [key]: "error" })); } })).then(() => { if (!controller.signal.aborted) loaded.current = requestKey; });
    return () => { controller.abort(); if (isTauri()) void simsCancel(profile, operation).catch(() => {}); };
  }, [active, profile, attempt, term]);
  const featured = [packs[0], packs[1], sims[0], sims[1]].filter((value): value is ModDiscoveryProject => !!value?.image);
  const current = featured[slide % Math.max(featured.length, 1)];
  const [heroArt, setHeroArt] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!active || term || !current || current.id in heroArt) return;
    const controller = new AbortController();
    const project = current.route.game === "minecraft" ? current.route.project : null;
    if (project) void minecraftCatalogRequest({ kind: "project", query: project.id }, controller.signal).then(minecraftProject).then(value => { if (!controller.signal.aborted) setHeroArt(previous => ({ ...previous, [current.id]: value.gallery[0]?.url || value.art || current.image })); }).catch(() => { if (!controller.signal.aborted) setHeroArt(previous => ({ ...previous, [current.id]: current.image })); });
    else setHeroArt(previous => ({ ...previous, [current.id]: current.image }));
    return () => controller.abort();
  }, [active, current?.id, term]);
  useEffect(() => {
    if (!active || paused || hovering || featured.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setSlide(value => value + 1), 10000);
    return () => clearInterval(timer);
  }, [active, paused, hovering, featured.length]);
  const open = (project: ModDiscoveryProject, origin: HTMLElement) => navigate(project.route, origin);
  const needle = query.trim();
  const shelf = (key: string, title: string, projects: ModDiscoveryProject[], route: ModsRoute) => <section className="mods-home-shelf" aria-label={t(title)}>
    <header><div><h2>{t(title)}</h2><small><ModProviderLogo source={key === "sims" ? "Mod The Sims" : "Modrinth"}/></small></div><button className="games-detail-text-button" onClick={event => navigate(route, event.currentTarget)}>{t("games.modHub.browseAll")}<ArrowRight size={17}/></button></header>
    {status[key] === "error" && <p className="mods-row-status" role="status">{t(key === "sims" && !isTauri() ? "games.sims.desktop" : "games.modHub.unavailable")}<button className="games-button" onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></p>}
    <div className="mods-project-row" aria-busy={status[key] === "loading"}>{projects.slice(0, 6).map(project => <ModProjectCard key={project.id} project={project} open={open}/>)}{!projects.length && status[key] === "loading" && Array.from({ length: 6 }, (_, i) => <div key={i} className="mods-card-skeleton"><i/><i/><i/></div>)}</div>
    {status[key] === "ready" && !projects.length && <p>{t("games.minecraft.catalog.empty")}</p>}
  </section>;
  return <section className="mods-home">
    {!needle && <section className="mods-feature" aria-label={t("games.modHub.featured")} onPointerEnter={() => setHovering(true)} onPointerLeave={() => setHovering(false)} onFocusCapture={() => setHovering(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHovering(false); }}>
      {current ? <><ModImage key={current.id} src={heroArt[current.id] ?? current.image} eager className="mods-feature-art"/><div className="mods-feature-shade"/>
        <div className="mods-feature-copy"><span className="mods-feature-kicker"><ModGameLogo game={current.route.game} compact/><span>{t("games.modHub.featured")}</span></span><h2 dir="auto">{current.title}</h2><p dir="auto">{current.description}</p><div className="mods-feature-meta"><span dir="auto">{current.author}</span><ModStats values={current.metrics}/><ModProviderLogo source={current.source}/></div><button className="games-button games-button-primary" onClick={event => open(current, event.currentTarget)}>{t("games.modHub.viewProject")}<ArrowRight size={18}/></button></div>
        <div className="mods-feature-controls"><button className="games-icon-button" aria-label={t(paused ? "common.play" : "common.pause")} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16}/> : <Pause size={16}/>}</button><span dir="ltr">{slide % featured.length + 1} / {featured.length}</span><button className="games-icon-button" aria-label={t("common.previous")} onClick={() => { setPaused(true); setSlide(value => (value + featured.length - 1) % featured.length); }}><ChevronLeft size={20}/></button><button className="games-icon-button" aria-label={t("common.next")} onClick={() => { setPaused(true); setSlide(value => value + 1); }}><ChevronRight size={20}/></button></div>
      </> : <div className="mods-feature-empty"><h2>{t("games.modHub.title")}</h2><p>{t("games.modHub.intro")}</p>{status.packs === "loading" && <span role="status">{t("common.loading")}</span>}</div>}
    </section>}
    <div className="games-inset mods-home-content"><section className="mods-game-chooser"><header><h2>{t("games.modHub.chooseGame")}</h2><button className="games-icon-button" aria-label={t("games.feed.refresh")} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={17}/></button></header><div>{MOD_GAMES.map(game => <button key={game.id} onClick={event => navigate({ game: game.id }, event.currentTarget)}><ModGameLogo game={game.id}/><span><strong>{game.name}</strong><small>{t(`games.modHub.${game.id === "minecraft" ? "minecraft" : "sims4"}Note`)}</small></span><ArrowRight size={20}/></button>)}</div></section>
      {shelf("packs", needle ? "games.minecraft.catalog.modpack" : "games.modHub.popularPacks", packs, { game: "minecraft" })}
      {shelf("sims", needle ? "games.modHub.sims4Note" : "games.modHub.simsPopular", sims, { game: "sims4" })}
      {shelf("mods", needle ? "games.minecraft.catalog.mod" : "games.modHub.minecraftPopular", mods, { game: "minecraft" })}
    </div>
  </section>;
}
