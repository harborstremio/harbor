import { sourceIconUrl, sourceUrl } from "./sources";
export { sourceIconUrl } from "./sources";

/** Read declared site artwork without mounting any of the site's markup. */
export function discoverSourceIcon(html: string, base: string): string | undefined {
  const template = document.createElement("template");
  template.innerHTML = html;
  const icons = [...template.content.querySelectorAll('link[href][rel]')].flatMap(node => {
    const rel = (node.getAttribute("rel") || "").toLowerCase().split(/\s+/);
    if (!rel.includes("icon") && !rel.includes("apple-touch-icon")) return [];
    const url = sourceIconUrl(node.getAttribute("href"), base);
    if (!url) return [];
    const sizes = (node.getAttribute("sizes") || "").toLowerCase();
    const widths = [...sizes.matchAll(/(?:^|\s)(\d+)x\d+(?=\s|$)/g)].map(match => Number(match[1]));
    const width = Math.max(0, ...widths);
    const score = sizes === "any" ? 256 : width >= 64 && width <= 256 ? 300 - Math.abs(96 - width) : width >= 32 ? 100 : 0;
    return [{ url, score: score + (rel.includes("icon") ? 20 : 0) }];
  });
  return icons.sort((a, b) => b.score - a.score)[0]?.url;
}

/** A preview only contacts the origin, never a pasted catalog token or release key. */
export function sourceArtworkSite(url?: string, homepage?: string): string | undefined {
  const valid = sourceUrl(homepage) || sourceUrl(url);
  if (!valid) return;
  return new URL(valid).origin + "/";
}

export function retainSourceArtwork<T extends { homepage?: string; icon?: string }>(next: T, previous: T): T {
  const homepage = next.homepage || previous.homepage;
  const sameSite = !next.homepage || sourceArtworkSite(next.homepage) === sourceArtworkSite(previous.homepage);
  return { ...next, homepage, icon: next.icon || (sameSite ? previous.icon : undefined) };
}

/** A website can identify its published catalogs, but cannot replace another publisher's artwork. */
export function inheritSourceArtwork<T extends { homepage?: string; icon?: string }>(manifest: T, website: string, icon?: string): T {
  const homepage = sourceUrl(website);
  if (!homepage) return manifest;
  const sameSite = !manifest.homepage || sourceArtworkSite(manifest.homepage) === sourceArtworkSite(homepage);
  return { ...manifest, homepage: manifest.homepage || homepage, icon: manifest.icon || (sameSite ? sourceIconUrl(icon) : undefined) };
}
