import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link2 } from "lucide-react";
import { sourceArtworkSite, sourceIconUrl } from "@/lib/games/source-artwork";
import { fetchSourceIcon } from "@/lib/games/source-artwork-fetch";

export function GameSourceIcon({ url, homepage, icon, name = "", fallback, className = "" }: { url?: string; homepage?: string; icon?: string; name?: string; fallback?: ReactNode; className?: string }) {
  const site = sourceArtworkSite(url, homepage), declared = sourceIconUrl(icon);
  const root = useRef<HTMLSpanElement>(null);
  const [discovered, setDiscovered] = useState<{ site: string; icon?: string }>();
  const [ready, setReady] = useState("");
  const [failed, setFailed] = useState<string[]>([]), [loaded, setLoaded] = useState("");
  const needsLookup = !declared || failed.includes(declared);
  const src = [declared, discovered && discovered.site === site ? discovered.icon : undefined, site && ready === site ? new URL("favicon.ico", site).href : undefined].find(value => value && !failed.includes(value));
  useEffect(() => {
    if (!site || !needsLookup || !root.current) return;
    let current = true, timer: ReturnType<typeof setTimeout> | undefined;
    const begin = () => { timer = setTimeout(() => { setReady(site); void fetchSourceIcon(site).then(icon => { if (current) setDiscovered({ site, icon }); }); }, 450); };
    if (typeof IntersectionObserver === "undefined") {
      begin();
      return () => { current = false; clearTimeout(timer); };
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      begin();
    });
    observer.observe(root.current);
    return () => { current = false; clearTimeout(timer); observer.disconnect(); };
  }, [site, needsLookup]);
  return <span ref={root} className={`games-source-art ${className}`} aria-hidden="true" data-loaded={!!src && loaded === src} data-loading={!!src && loaded !== src || !!site && needsLookup && discovered?.site !== site || undefined}>
    {(!src || loaded !== src) && (fallback || (name ? <span>{Array.from(name.trim()).slice(0, 2).join("").toLocaleUpperCase()}</span> : <Link2 size={18}/>))}
    {src && <img key={src} src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onLoad={() => setLoaded(src)} onError={() => setFailed(previous => [...previous, src])}/>}
  </span>;
}
