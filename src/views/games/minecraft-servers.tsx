import { useCallback, useEffect, useState } from "react";
import { Check, Copy, RefreshCw, Search, Users } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { SERVER_SOURCES, serverDirectoryUrl, type ServerSource, type MinecraftServer } from "@/lib/games/minecraft-discovery";
import { loadMinecraftServers } from "@/lib/games/minecraft-discovery-request";
import { useMinecraftDiscovery } from "./use-minecraft-discovery";
import { MinecraftProjectLink } from "./minecraft-project-link";
import { GameArt } from "./game-art";
import { DiscoveryFooter } from "./minecraft-discovery-shared";
import "./minecraft-catalog.css";
import "./minecraft-discovery.css";

function DirectoryMark({ source }: { source: ServerSource }) {
  return <span className={`mc-directory-mark is-${source}`}><img src={SERVER_SOURCES[source].logo} alt=""/></span>;
}

export function MinecraftServers({ active, query }: { active: boolean; query: string }) {
  const t = useT(), [source, setSource] = useState<ServerSource>("org"), [mode, setMode] = useState(""), [term, setTerm] = useState(query), [sort, setSort] = useState("rank");
  useEffect(() => setTerm(query), [query]);
  const load = useCallback(async (url: string, signal: AbortSignal, refresh: boolean) => { const { data, at } = await loadMinecraftServers(source, url, signal, refresh); return { items: data.servers, next: data.next, meta: { modes: data.modes, at } }; }, [source]);
  const feed = useMinecraftDiscovery(serverDirectoryUrl(source, mode), active, load, !term.trim());
  const words = term.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const servers = feed.items.filter(server => words.every(word => [server.name, server.address, server.description, ...server.tags].join(" ").toLocaleLowerCase().includes(word))).sort((a, b) => sort === "players" ? (b.players ?? -1) - (a.players ?? -1) : (a.rank ?? Infinity) - (b.rank ?? Infinity));
  return <section className="mc-discovery mc-servers games-inset">
    <header className="mc-discovery-heading"><div><h2>{t("games.minecraft.discovery.servers")}</h2><p>{t("games.minecraft.discovery.serverNote")}</p></div><label className="mc-catalog-search"><Search size={17}/><input value={term} maxLength={200} onChange={event => setTerm(event.target.value)} placeholder={t("games.minecraft.discovery.searchServers")} aria-label={t("games.minecraft.discovery.searchServers")}/></label></header>
    <div className="mc-discovery-toolbar">
      <Dropdown ariaLabel={t("games.minecraft.discovery.directory")} value={source} onChange={value => { setSource(value as ServerSource); setMode(""); }} options={Object.entries(SERVER_SOURCES).map(([value, provider]) => ({ value, label: provider.name, left: <DirectoryMark source={value as ServerSource}/> }))}/>
      <Dropdown ariaLabel={t("games.minecraft.discovery.mode")} value={mode} onChange={setMode} options={[{ value: "", label: t("games.minecraft.discovery.allModes") }, ...(feed.meta?.modes || [])]}/>
      <Dropdown ariaLabel={t("games.minecraft.catalog.sort")} value={sort} onChange={setSort} options={[{ value: "rank", label: t("games.minecraft.discovery.directoryRank") }, { value: "players", label: t("games.minecraft.discovery.playersLoaded") }]}/>
      <button className="games-icon-button" onClick={feed.refresh} disabled={feed.busy} aria-label={t("games.feed.refresh")}><RefreshCw size={17}/></button>
    </div>
    <div className="mc-server-attribution"><MinecraftProjectLink url={serverDirectoryUrl(source, mode)}><DirectoryMark source={source}/>{SERVER_SOURCES[source].name}</MinecraftProjectLink><span>{t("games.minecraft.discovery.loaded", { count: feed.items.length })}</span></div>
    <div className="mc-source-list" aria-busy={feed.busy}>{servers.map(server => <ServerRow key={server.id} server={server}/>)}</div>
    {!servers.length && !!feed.items.length && !feed.busy && <p className="mc-catalog-empty">{t("games.minecraft.discovery.noLoadedMatches")}</p>}
    <DiscoveryFooter feed={feed} unavailable={t("games.minecraft.discovery.unavailable")}/>
  </section>;
}

function ServerRow({ server }: { server: MinecraftServer }) {
  const t = useT(), [copied, setCopied] = useState(false), [error, setError] = useState(false);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(timer); }, [copied]);
  const copy = async () => { try { if (isTauri()) await (await import("@tauri-apps/plugin-clipboard-manager")).writeText(server.address); else await navigator.clipboard.writeText(server.address); setCopied(true); setError(false); } catch { setError(true); } };
  return <article className="mc-server-row">
    <span className="mc-server-rank">{server.rank ? `#${server.rank}` : ""}</span><GameArt src={server.icon}/>
    <div className="mc-server-copy"><h3><MinecraftProjectLink url={server.url}>{server.name}</MinecraftProjectLink></h3><button className="mc-server-address" onClick={() => void copy()} aria-label={t("games.minecraft.discovery.copy", { address: server.address })}><bdi>{server.address}</bdi>{copied ? <Check size={14}/> : <Copy size={14}/>}</button>{!!server.description && <p>{server.description}</p>}{!!server.tags.length && <small>{server.tags.slice(0, 4).join(" · ")}</small>}<span role="status">{copied ? t("games.minecraft.discovery.copied") : error ? t("games.minecraft.discovery.copyError") : ""}</span></div>
    {server.banner && <GameArt className="mc-server-banner" src={server.banner}/>}
    <div className="mc-server-status">{server.players !== null && <span dir="ltr"><Users size={14}/><strong>{server.players.toLocaleString()}</strong>{server.capacity !== null && <small>/ {server.capacity.toLocaleString()}</small>}</span>}{server.online !== null && <small className={server.online ? "is-online" : ""}>{t(server.online ? "games.minecraft.discovery.online" : "games.minecraft.discovery.offline")}</small>}{server.version && <small>{server.version}</small>}</div>
  </article>;
}
