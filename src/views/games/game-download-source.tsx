import { createContext, useContext } from "react";
import { GameSourceIcon } from "./game-source-icon";
import { sourceArtworkSite } from "@/lib/games/source-artwork";
import "./game-download-source.css";

export type DownloadSourceArtwork = { name: string; url: string; homepage?: string; icon?: string };
export const DownloadSourceArtworkContext = createContext<readonly DownloadSourceArtwork[]>([]);

export function DownloadSourceIdentity({ name, release, url }: { name?: string; release?: string; url?: string }) {
  const sources = useContext(DownloadSourceArtworkContext);
  const matches = name ? sources.filter(source => source.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase()) : [];
  // Legacy transfers retain the source name. Subscribing to one catalog twice still names one
  // publisher, but two publishers sharing a name may not supply each other's identity.
  const sites = new Set(matches.map(source => sourceArtworkSite(source.url, source.homepage)).filter(Boolean));
  const source = sites.size === 1 ? matches.find(source => sourceArtworkSite(source.url, source.homepage)) : undefined;
  if (!name && !release) return null;
  return <div className="games-download-source-identity">{name && <GameSourceIcon key={`${source?.url ?? url ?? ""}:${name}`} url={source?.url ?? url} homepage={source?.homepage} icon={source?.icon} name={name} className="games-download-source-icon"/>}<div>{name && <p>{name}</p>}{release && <span title={release}>{release}</span>}</div></div>;
}
