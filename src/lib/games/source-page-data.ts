import { sourceArtworkTitles } from "./source-display";
import { sourceDownloadTitle, sourceTitleKey } from "./source-title";
import { sourceUrl } from "./sources";

export type SourcePageData = { steamId?: number; portrait?: string; description: string; screenshots: string[] };

/** Read inert metadata from the selected release, never neighboring cards or arbitrary script IDs. */
export function sourcePageArtwork(content: DocumentFragment, page: string, releaseTitle: string): Omit<SourcePageData, "steamId"> {
  const empty = { description: "", screenshots: [] as string[] };
  const meta = (name: string) => content.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.getAttribute("content") || "";
  const host = new URL(page).hostname;
  const post = /(^|\.)rutracker\.(org|net)$/.test(host) ? content.querySelector(".post_body") : /(^|\.)rutor\.(info|is|org)$/.test(host) ? content.querySelector("#details") : null;
  const title = post?.textContent?.slice(0, 1200) || meta("og:title") || content.querySelector("h1")?.textContent || "";
  const names = sourceArtworkTitles(releaseTitle).map(sourceTitleKey);
  const titleKey = sourceTitleKey(sourceDownloadTitle(title));
  const describesRelease = names.some(name => name.length >= 3 && (post ? titleKey.startsWith(name) : titleKey === name || titleKey.startsWith(name + " free ")));
  if (!describesRelease) return empty;
  const image = (value: string | null | undefined) => {
    if (!value) return;
    try {
      const url = sourceUrl(new URL(value, page).href);
      return url && /\.(?:png|jpe?g|webp|avif)$/i.test(new URL(url).pathname) ? url : undefined;
    } catch { return; }
  };
  const images = post ? [...post.querySelectorAll("img.postImg,img.post-img,img[src]")].map(node => image(node.getAttribute("src") || node.getAttribute("data-src"))).filter((url): url is string => !!url && !/\/(?:smiles|avatars|ranks|templates)\//i.test(url)).slice(0, 7) : [];
  const portrait = images[0] || image(meta("og:image")) || image(meta("twitter:image"));
  if (!portrait) return empty;
  const body = post?.textContent?.replace(/\s+/g, " ") || "";
  const description = (post ? body.split(/Описание\s*:/i)[1]?.split(/Порядок установки|Доп\. информация|Особенности релиза|Скриншоты/i)[0] : meta("og:description") || meta("description"))?.trim().slice(0, 600) || "";
  return { portrait, description, screenshots: [...new Set(images)].filter(url => url !== portrait).slice(0, 6) };
}
