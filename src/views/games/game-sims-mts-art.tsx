import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import packageIcon from "@/assets/settings-icons/package.svg";

export function SimsMtsArt({ src, lazy = false, skeleton = false }: { src: string; lazy?: boolean; skeleton?: boolean }) {
  const [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false);
  return <span className="games-sims-mts-art" aria-hidden="true">{(!src || failed) ? <span style={{ maskImage: `url("${packageIcon}")` }}/> : <>{!loaded && (skeleton ? <i className="sims-art-skeleton sims-discovery-skeleton"/> : <LoaderCircle size={22}/>)}<img src={src} alt="" loading={lazy ? "lazy" : "eager"} decoding="async" className={loaded ? "is-loaded" : ""} onLoad={() => setLoaded(true)} onError={() => setFailed(true)}/></>}</span>;
}
