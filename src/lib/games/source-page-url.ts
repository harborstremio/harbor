import { sourceUrl, type GameSource, type SourceRelease } from './sources';

function sameOrigin(url: string, origin: string): boolean {
  try {
    // A normal HTTP authority ends before the path/query/fragment. Parsing only
    // that prefix avoids copying and normalizing long unrelated mirror paths.
    // Unusual whitespace/scheme forms fall back to the full standard parser.
    const authority = /^https?:\/\/[^/\\?#\x00-\x20]+(?=[/\\?#]|$)/i.exec(url)?.[0];
    return new URL(authority ? authority + '/' : url).origin === origin;
  } catch { return false; }
}

/** Only an explicit published page or one unambiguous same-site file is evidence. */
export function sourcePageUrl(source: GameSource, release: SourceRelease): string | undefined {
  const published = sourceUrl(release.sourcePage);
  if (published) return published;
  const site = sourceUrl(source.website?.site || source.homepage || source.url);
  if (!site) return;
  const origin = new URL(site).origin;
  let page: string | undefined;
  for (const file of release.files) {
    if (file.kind !== 'page' || !sameOrigin(file.url, origin) || !sourceUrl(file.url)) continue;
    if (page !== undefined) return;
    // Preserve the selected file's original fragment, just as the page reader does.
    page = file.url;
  }
  return page;
}
