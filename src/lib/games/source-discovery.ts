import { sourceUrl } from "./sources";

export type SourceCandidate = { url: string; name: string };
export const SOURCE_DISCOVERY_LIMIT = 12;

/** Accept pasted catalog/install links and a website address without a scheme. */
export function sourceInputUrl(input: string): string | undefined {
  let value = input.trim();
  if (!value || value.length > 8192 || /[\u0000-\u0020\u007f]/.test(value)) return;
  if (/^hydralauncher:/i.test(value)) {
    try {
      const install = new URL(value);
      if (install.hostname.toLowerCase() !== "install-source" || install.username || install.password || install.port || !["", "/"].includes(install.pathname)) return;
      const urls = install.searchParams.getAll("urls");
      if (urls.length !== 1 || !sourceUrl(urls[0])) return;
      value = urls[0];
    } catch { return; }
  }
  const explicitScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
  if (!explicitScheme && !/^(?:\[[a-f\d:]+\]|(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+|localhost)(?::\d{1,5})?(?:[/?#]|$)/iu.test(value)) return;
  const url = sourceUrl(explicitScheme ? value : `https://${value}`);
  if (!url) return;
  const parsed = new URL(url);
  if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost" && !parsed.hostname.startsWith("[")) return;
  if (parsed.hostname === "github.com" && /^\/[^/]+\/[^/]+\/blob\/.+\.json$/i.test(parsed.pathname)) {
    parsed.hostname = "raw.githubusercontent.com";
    parsed.pathname = parsed.pathname.replace(/^(\/[^/]+\/[^/]+)\/blob\//, "$1/");
    parsed.search = "";
    return parsed.href;
  }
  return url;
}

export function sourceCandidate(href: string, base: string, name = "", declared = false): SourceCandidate | undefined {
  let url: string | undefined;
  if (/^hydralauncher:/i.test(href)) url = sourceInputUrl(href);
  else {
    try {
      const resolved = new URL(href, base);
      if (!declared && !/\.json$/i.test(resolved.pathname)) return;
      url = sourceInputUrl(resolved.href);
    } catch { return; }
  }
  if (!url) return;
  const label = name.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return { url, name: label || new URL(url).pathname.split("/").filter(Boolean).at(-1) || new URL(url).hostname };
}

/** WordPress alternate JSON identifies an entity, not a downloadable game catalog. */
export function isWebsiteApiResource(href: string, api: string): boolean {
  try {
    const resource = new URL(href), root = new URL(api);
    if (resource.origin !== root.origin) return false;
    if (root.searchParams.has("rest_route")) return resource.pathname === root.pathname && /^\/wp\/v2\//.test(resource.searchParams.get("rest_route") || "");
    return resource.pathname.startsWith(`${root.pathname.replace(/\/?$/, "/")}wp/v2/`);
  } catch { return false; }
}

/** Parse only published links in an inert template; no scripts, images or site code run. */
export function discoverSourceLinks(html: string, base: string, websiteApi?: string): SourceCandidate[] {
  const template = document.createElement("template");
  template.innerHTML = html;
  const candidates = new Map<string, SourceCandidate>();
  for (const node of template.content.querySelectorAll("a[href],link[href],meta[name='harbor-game-source']")) {
    const rel = (node.getAttribute("rel") || "").toLowerCase().split(/\s+/);
    const type = (node.getAttribute("type") || "").toLowerCase();
    const declared = node.localName === "meta" || (node.localName === "link" && (rel.includes("harbor-game-source") || rel.includes("alternate") && ["application/json", "application/vnd.harbor.games+json"].includes(type)));
    if (node.localName === "link" && !declared) continue;
    const candidate = sourceCandidate(node.getAttribute(node.localName === "meta" ? "content" : "href") || "", base, node.getAttribute("title") || node.textContent || "", declared);
    if (candidate && websiteApi && node.localName === "link" && type === "application/json" && rel.includes("alternate") && !rel.includes("harbor-game-source") && isWebsiteApiResource(candidate.url, websiteApi)) continue;
    if (candidate && !candidates.has(candidate.url)) candidates.set(candidate.url, candidate);
    if (candidates.size >= SOURCE_DISCOVERY_LIMIT) break;
  }
  return [...candidates.values()];
}
