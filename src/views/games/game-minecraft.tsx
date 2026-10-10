import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Box, Layers, Paintbrush, Users } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { MinecraftContentIcon } from "./minecraft-content-icon";
import { MINECRAFT_CONTENT, type MinecraftContent } from "@/lib/games/minecraft-catalog";
import { useT } from "@/lib/i18n";
import { loadAtlasGame } from "@/lib/games/atlas";
import { useSectionBack } from "@/lib/section-back";
import { useMinecraftAccount } from "@/hooks/use-minecraft-account";
import { MinecraftAccountButton, MinecraftAccountDialog } from "./minecraft-account";
import { GameMods } from "./game-mods";
import { MinecraftCatalog } from "./minecraft-catalog";
import { MinecraftServers } from "./minecraft-servers";
import type { MinecraftProject } from "@/lib/games/minecraft-catalog";
import type { MinecraftPackRequest } from "@/lib/games/minecraft-instances";
import { MinecraftInstances } from "./minecraft-instances";
import { MinecraftSpotlight } from "./minecraft-spotlight";
import "./game-minecraft.css";

const SkinStudio = lazy(() => import("./minecraft-skin-studio").then(m => ({ default: m.MinecraftSkinStudio })));

export function GameMinecraft({ profile, query, active, workspace = false, requested }: { profile: string; query: string; active: boolean; workspace?: boolean; requested?: MinecraftProject }) {
  const t = useT(), [tab, setTab] = useState<"discover" | "instances" | "mods" | "skins" | "servers">("discover"), [artwork, setArtwork] = useState("");
  const [browseRevision,setBrowseRevision]=useState(0);
  const [contentType,setContentType] = useState<MinecraftContent>("modpack");
  const [requestedProject, setRequestedProject] = useState<MinecraftProject | null>(null), previousTab = useRef<"discover" | "instances" | "mods" | "servers">("discover");
  const [requestedPack, setRequestedPack] = useState<MinecraftPackRequest | null>(null);
  const [catalogProject, setCatalogProject] = useState<MinecraftProject | null>(null);
  const nav = useRef<HTMLElement>(null);
  const lastRequest = useRef<MinecraftProject | undefined>(undefined);
  useEffect(() => { if (requested && active && lastRequest.current !== requested) { lastRequest.current = requested; setTab("discover"); setCatalogProject(requested); } }, [requested, active]);
  const catalog = useRef<HTMLDivElement>(null);
  const account = useMinecraftAccount(profile, active), [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => { if (!active) setAccountOpen(false); }, [active]);
  const scrollToStudio = useRef(false);
  useSectionBack(() => { setTab("discover"); requestAnimationFrame(() => nav.current?.querySelector<HTMLButtonElement>("[aria-current='page']")?.focus({ preventScroll: true })); }, active && tab === "servers");
  useSectionBack(() => { setTab(previousTab.current); nav.current?.querySelector<HTMLButtonElement>("[data-minecraft-management] button")?.focus({ preventScroll: true }); }, active && tab === "skins");
  useEffect(() => {
    if (!active || artwork || workspace) return;
    const controller = new AbortController();
    void loadAtlasGame({ id: "igdb:121", igdbId: 121, name: "Minecraft: Java Edition", capsule: "", platforms: [] }, controller.signal)
      .then(game => { if (game && !controller.signal.aborted) setArtwork(game.hero || game.screenshots[0] || ""); }).catch(() => {});
    return () => controller.abort();
  }, [active, artwork]);
  const studioReady = useCallback(() => {
    if (!scrollToStudio.current) return;
    scrollToStudio.current = false;
    nav.current?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, []);
  const browse = () => {
    setTab("discover");
    requestAnimationFrame(() => {
      catalog.current?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      catalog.current?.querySelector<HTMLInputElement>(".mc-catalog-search input")?.focus({ preventScroll: true });
    });
  };
  return <section className={`games-minecraft${tab === "skins" ? " is-editing" : ""}`} data-page={tab}>
    <header className="mc-world-hero" hidden={tab !== "discover" || workspace}>
      <MinecraftSpotlight active={active && tab === "discover" && !workspace} open={setCatalogProject} browse={browse} fallback={artwork} />
    </header>
    {!workspace && tab !== "discover" && tab !== "skins" && <div className="mc-workspace-title games-inset"><img src="/games/minecraft/wordmark.svg" alt="Minecraft" /><span>Java Edition</span></div>}
    <nav className="mc-world-nav games-inset" aria-label="Minecraft" ref={nav}>
      <img className="mc-navigation-wordmark" src="/games/minecraft/wordmark.svg" alt="Minecraft"/>
      <div className="mc-browse-navigation">{MINECRAFT_CONTENT.map(kind=><button key={kind} aria-current={tab === "discover" && contentType === kind ? "page" : undefined} onClick={()=>{setContentType(kind);setBrowseRevision(value=>value+1);setTab("discover");}}><MinecraftContentIcon kind={kind}/>{t(`games.minecraft.catalog.${kind}`)}</button>)}<button aria-current={tab === "servers" ? "page" : undefined} onClick={()=>setTab("servers")}><Users size={18}/>{t("games.minecraft.discovery.servers")}</button></div>
      <div data-minecraft-management className="mc-manage-navigation"><Dropdown ariaLabel={t("games.minecraft.hub.manage")} placeholder={t("games.minecraft.hub.manage")} value={tab === "discover" || tab === "servers" ? "" : tab} options={[{value:"instances",label:t("games.minecraft.instances.tab"),left:<Layers size={17}/>},{value:"mods",label:t("games.minecraft.hub.installed"),left:<Box size={17}/>},{value:"skins",label:t("games.minecraft.skins"),left:<Paintbrush size={17}/>}]} onChange={value=>{if(value === "skins"){if(tab !== "skins") previousTab.current=tab;scrollToStudio.current=true;}setTab(value as "instances"|"mods"|"skins");}}/></div>
      <MinecraftAccountButton account={account} open={() => setAccountOpen(true)} />
    </nav>
    <div hidden={tab !== "discover"} ref={catalog}><MinecraftCatalog browseRevision={browseRevision} contentType={contentType} pageDetails={workspace} active={active && tab === "discover"} query={query} requested={catalogProject} consumed={() => setCatalogProject(null)} manage={project => { setRequestedProject(project); setTab("mods"); }} installPack={pack => { setRequestedPack(pack); setTab("instances"); }} /></div>
    <div hidden={tab !== "instances"}><MinecraftInstances key={profile} profile={profile} active={active && tab === "instances"} requested={requestedPack} consumed={() => setRequestedPack(null)} browse={() => setTab("discover")} account={account} /></div>
    <div hidden={tab !== "servers"}><MinecraftServers active={active && tab === "servers"} query={query}/></div>
    <div hidden={tab !== "mods"}><GameMods profile={profile} query={query} active={active && tab === "mods"} embedded requestedProject={requestedProject} onProjectOpened={() => setRequestedProject(null)} /></div>
    {tab === "skins" && <Suspense fallback={<div className="mc-studio-loading games-inset" aria-busy="true"><div /><div /></div>}><SkinStudio key={profile} profile={profile} active={active && !accountOpen} onReady={studioReady} account={account} /></Suspense>}
    {accountOpen && <MinecraftAccountDialog account={account} close={() => setAccountOpen(false)} />}
  </section>;
}
