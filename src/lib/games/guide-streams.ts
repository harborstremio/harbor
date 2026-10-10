import { guideCount, guideUrl, normalizeGuideGame, type GameGuide } from "./guides-data";
import { readGuideSource } from "./guides-fetch";

// Public web-client identifier published in twitch.tv's anonymous bootstrap.
// No account token, login cookie or client secret is used by this read-only adapter.
const TWITCH_WEB_CLIENT = "kimne78kx3ncx6brgo4mv6wki5h1ko";
class TwitchContinuationRestricted extends Error {}
const query = `query HarborGameStreams($slug: String!, $cursor: Cursor) {
  game(slug: $slug) { id name displayName streams(first: 24, after: $cursor, options: {sort: VIEWER_COUNT}) {
    edges { cursor node { id title type viewersCount previewImageURL(width: 640, height: 360) broadcaster { login displayName } } }
    pageInfo { hasNextPage }
  } }
}`;
export function twitchGameSlug(game: string) {
  const name = normalizeGuideGame(game);
  return name === "counter strike 2" || name === "counter strike global offensive" ? "counter-strike" : name.replaceAll(" ", "-");
}
export function parseTwitchGuides(raw: unknown, game: string): { items: GameGuide[]; cursor?: string } {
  const response = raw as { errors?: unknown[]; data?: { game?: { name?: string; displayName?: string; streams?: { edges?: unknown[]; pageInfo?: { hasNextPage?: boolean } } } | null } } | null;
  if (response?.errors?.some(error => (error as {extensions?:{code?:string}})?.extensions?.code === "IntegrityCheckFailed")) throw new TwitchContinuationRestricted("Twitch requires its signed browser session for this page");
  if (!response || response.errors?.length || !response.data || !("game" in response.data)) throw Error("Twitch directory unavailable");
  const category = response.data.game;
  if (!category) return { items: [] };
  if (![category.name, category.displayName].some(name => typeof name === "string" && normalizeGuideGame(name) === twitchGameSlug(game).replaceAll("-", " "))) throw Error("Twitch category does not match this game");
  const edges = category.streams?.edges;
  if (!Array.isArray(edges)) throw Error("Twitch streams unavailable");
  const seen = new Set<string>();
  const items = edges.flatMap((value): GameGuide[] => {
    const node = (value as { node?: any })?.node, login = node?.broadcaster?.login;
    if (node?.type !== "live" || typeof login !== "string" || !/^[a-z\d_]{1,25}$/i.test(login) || typeof node.title !== "string" || seen.has(login.toLowerCase())) return [];
    seen.add(login.toLowerCase());
    const image = guideUrl(node.previewImageURL ?? "");
    return [{ id: login, source: "twitch", title: node.title.slice(0,400), author: String(node.broadcaster.displayName || login), image: image && /(^|\.)(ttvnw\.net|jtvnw\.net)$/.test(new URL(image).hostname) ? image : "", description: "", live: true, viewers: guideCount(node.viewersCount), url: `https://www.twitch.tv/${login}` }];
  });
  const cursor = (edges.at(-1) as { cursor?: unknown })?.cursor;
  return { items, cursor: category.streams?.pageInfo?.hasNextPage && typeof cursor === "string" ? cursor.slice(0,2048) : undefined };
}
export async function loadTwitchGuides(game: string, signal: AbortSignal, cursor?: string) {
  return readGuideSource("https://gql.twitch.tv/gql", signal, text => parseTwitchGuides(JSON.parse(text), game), 60_000, {
    method: "POST", headers: { "Client-ID": TWITCH_WEB_CLIENT, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { slug: twitchGameSlug(game), cursor: cursor ?? null } }),
  }).catch(error => {
    // Keep the public first page when further pages need Twitch's browser session.
    // The catalog offers its directory link; never attempt to bypass that check.
    if (cursor && error instanceof TwitchContinuationRestricted) return {items:[] as GameGuide[],cursor:undefined};
    throw error;
  });
}

