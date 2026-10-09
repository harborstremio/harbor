import type { CSSProperties } from "react";
import { MusicServiceLogo } from "./music-service-logo";
import "./music-source-search-motion.css";

/** A quiet source motif, not a claim about which provider is currently responding. */
export function MusicSourceSearchMotion({ source }: { source?: string }) {
  const sources = source ? [source] : ["youtube", "soundcloud", "spotify"];
  return <span className="music-source-search-motion" aria-hidden="true" data-single={Boolean(source) || undefined}>
    {sources.map((id, index) => <span key={id} style={{ "--source-step": index } as CSSProperties}><MusicServiceLogo source={id} size={22} /></span>)}
  </span>;
}
