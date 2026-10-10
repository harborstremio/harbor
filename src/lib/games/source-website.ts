import { parseSourceManifest, SOURCE_SCHEMA, sourceFileUrl, sourceUrl, type SourceRelease, type SourceWebsite } from "./sources";

export const WEBSITE_PAGE_SIZE = 30;
export type WebsitePage = { entries: SourceRelease[]; next: number | null };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function discoverWebsiteApi(html: string, base: string, linkHeader?: string | null): string | undefined {
  const template = document.createElement("template"); template.innerHTML = html;
  const link = [...template.content.querySelectorAll('link[href]')].find(node => (node.getAttribute("rel") || "").split(/\s+/).includes("https://api.w.org/"));
  const header = linkHeader?.match(/<([^>]+)>\s*;\s*rel=["']https:\/\/api\.w\.org\/["']/i)?.[1];
  try { const href = link?.getAttribute("href") || header; return href ? sourceUrl(new URL(href, base).href) : undefined; } catch { return; }
}

export function websiteApiInfo(value: unknown, api: string, fallbackSite: string) {
  const root = object(value), site = sourceUrl(root.home) || sourceUrl(root.url) || sourceUrl(fallbackSite);
  if (!site || !Array.isArray(root.namespaces) || !root.namespaces.includes("wp/v2") || !object(root.routes)["/wp/v2/posts"]) throw Error("source_no_catalog");
  const name = plainText(typeof root.name === "string" ? root.name : new URL(site).hostname).slice(0, 120);
  return { name, website: { kind: "wordpress", api, site } as SourceWebsite };
}

export function websitePostsUrl(website: SourceWebsite, query: string, page: number) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 5000) throw Error("source_limit");
  const url = new URL(website.api);
  if (url.searchParams.has("rest_route")) url.searchParams.set("rest_route", "/wp/v2/posts");
  else url.pathname = url.pathname.replace(/\/?$/, "/") + "wp/v2/posts";
  url.searchParams.set("per_page", String(WEBSITE_PAGE_SIZE));
  url.searchParams.set("page", String(page));
  url.searchParams.set("_fields", "id,link,title,content,date_gmt");
  url.searchParams.set("orderby", "date"); url.searchParams.set("order", "desc");
  if (query.trim()) { url.searchParams.set("search", query.trim().slice(0, 200)); url.searchParams.set("search_columns[]", "post_title"); }
  else { url.searchParams.delete("search"); url.searchParams.delete("search_columns[]"); }
  return url.href;
}

function plainText(html: string) {
  const template = document.createElement("template"); template.innerHTML = html;
  template.content.querySelectorAll("script,style,iframe,svg").forEach(node => node.remove());
  return (template.content.textContent || "").replace(/\s+/g, " ").trim();
}

export function parseWebsitePosts(value: unknown, website: SourceWebsite, page: number, totalPages: string | null): WebsitePage {
  if (!Array.isArray(value) || value.length > WEBSITE_PAGE_SIZE) throw Error("source_format");
  const items: unknown[] = [];
  for (const raw of value) {
    const post = object(raw), link = sourceUrl(post.link), content = object(post.content).rendered, title = object(post.title).rendered;
    if (!Number.isSafeInteger(post.id) || Number(post.id) <= 0 || !link || new URL(link).origin !== new URL(website.site).origin || typeof content !== "string" || typeof title !== "string") continue;
    const template = document.createElement("template"); template.innerHTML = content;
    // Read published release links only. Comments, scripts, images and remote markup never mount.
    const files = [...template.content.querySelectorAll('a[href]')].flatMap(node => {
      const href = node.getAttribute("href") || "";
      let url: string | undefined;
      try { url = sourceFileUrl(new URL(href, link).href); } catch { return []; }
      if (!url) return [];
      if (url.startsWith("magnet:")) return [{ url, kind: "magnet", name: "BitTorrent" }];
      if (!node.hasAttribute("download") && !(node.getAttribute("rel") || "").split(/\s+/).includes("enclosure")) return [];
      return [{ url, kind: "page", name: plainText(node.getAttribute("download") || node.textContent || new URL(url).hostname).slice(0, 240) }];
    });
    if (!files.length) continue;
    const published = typeof post.date_gmt === "string" && post.date_gmt ? `${post.date_gmt.replace(/Z$/, "")}Z` : undefined;
    items.push({ id: `wp-${post.id}`, title: plainText(title), date: published, files: [...new Map(files.map(file => [file.url, file])).values()].slice(0, 63).concat({ url: link, kind: "page", name: new URL(link).hostname }) });
  }
  const manifest = parseSourceManifest({ schema: SOURCE_SCHEMA, name: "Website", items });
  const pages = totalPages && /^\d+$/.test(totalPages) ? Number(totalPages) : null;
  const more = pages === null ? value.length === WEBSITE_PAGE_SIZE : page < pages;
  return { entries: manifest.entries, next: more && page < 5000 ? page + 1 : null };
}
