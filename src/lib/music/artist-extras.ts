import { safeFetchBytes } from "@/lib/safe-fetch";
import type { MusicArtistProfile } from "./artist-profile";

export type ArtistProduct = {
  name: string;
  url: string;
  image: string;
  price?: number;
  currency?: string;
  sourceUrl: string;
};
export type ArtistEvent = {
  name: string;
  url: string;
  date: string;
  venue: string;
  city: string;
  sourceUrl: string;
};
export type ArtistExtraLink = {
  url: string;
  kind: "store" | "tour" | "official";
};
export type ArtistExtras = {
  products: ArtistProduct[];
  events: ArtistEvent[];
  links: ArtistExtraLink[];
};
type Obj = Record<string, unknown>;
const MAX_BYTES = 2_000_000;
const cache = new Map<string, { until: number; data: ArtistExtras }>();
const obj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
const list = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];
const text = (value: unknown, limit = 240) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";
const key = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const mentions = (value: unknown, name: string) =>
  ` ${key(text(value, 2000))} `.includes(` ${key(name)} `);

/** Public web destinations only; never turn provider data into a local/network URL. */
export function artistExtraUrl(value: unknown, base?: string): string | null {
  try {
    const raw = text(value, 1800);
    if (!raw) return null;
    const u = new URL(raw, base);
    const host = u.hostname.toLowerCase();
    if (
      !/^https?:$/.test(u.protocol) ||
      u.username ||
      u.password ||
      !host.includes(".") ||
      host.endsWith(".local") ||
      host.endsWith(".localhost") ||
      host === "localhost" ||
      /^[\d.]+$/.test(host) ||
      host.includes(":")
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}

const entityText = (value: string) =>
  value.replace(
    /&(?:amp|quot|apos|lt|gt|#39|#x27);/gi,
    (match) =>
      ({
        "&amp;": "&",
        "&quot;": '"',
        "&apos;": "'",
        "&#39;": "'",
        "&#x27;": "'",
        "&lt;": "<",
        "&gt;": ">",
      })[match.toLowerCase()] ?? match,
  );
function attribute(html: string, name: string) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(html);
  return entityText(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}
function imageUrl(value: unknown, base: string): string | null {
  const first = list(value)[0];
  const resolved = artistExtraUrl(
    typeof first === "string" ? first : (obj(first).url ?? obj(first).contentUrl),
    base,
  );
  if (!resolved) return null;
  const url = new URL(resolved);
  // Shopify's documented CDN width parameter preserves the original composition.
  if (url.hostname === "cdn.shopify.com") url.searchParams.set("width", "640");
  return url.href;
}
function schemaNodes(value: unknown): Obj[] {
  const pending = [value];
  const result: Obj[] = [];
  // JSON-LD may be an array, @graph, ItemList or nested mainEntity. Never execute scripts.
  for (let count = 0; pending.length && count < 500; count++) {
    const node = pending.shift();
    if (Array.isArray(node)) {
      pending.push(...node.slice(0, 100));
      continue;
    }
    const item = obj(node);
    if (!Object.keys(item).length) continue;
    result.push(item);
    for (const field of ["@graph", "itemListElement", "item", "mainEntity", "subEvent"])
      if (item[field]) pending.push(item[field]);
  }
  return result;
}
function types(node: Obj) {
  return list(node["@type"]).map((value) => text(value).split(/[/#]/).pop());
}

export function parseArtistExtraPage(
  html: string,
  sourceUrl: string,
  profile: Pick<MusicArtistProfile, "name" | "id" | "links">,
  now = Date.now(),
  trustedStore = false,
) {
  const products: ArtistProduct[] = [];
  const events: ArtistEvent[] = [];
  const tourLinks: string[] = [];
  const bounded = html.slice(0, MAX_BYTES);
  const pageTitle = entityText(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(bounded)?.[1] ?? "");
  const artistStore = trustedStore || mentions(pageTitle, profile.name);
  let scripts = 0;
  for (const match of bounded.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (
      attribute(match[1], "type").toLowerCase() !== "application/ld+json" ||
      match[2].length > 200_000 ||
      scripts++ >= 12
    )
      continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[2]);
    } catch {
      continue;
    }
    for (const node of schemaNodes(parsed)) {
      const kind = types(node);
      const name = text(node.name);
      if (kind.includes("Product") && name && products.length < 8) {
        if (
          !artistStore &&
          !mentions(name, profile.name) &&
          !mentions(obj(node.brand).name ?? node.brand, profile.name)
        )
          continue;
        const offer = obj(list(node.offers)[0]);
        const url = artistExtraUrl(node.url ?? offer.url ?? node["@id"], sourceUrl);
        const image = imageUrl(node.image, sourceUrl);
        if (!url || !image || /OutOfStock|Discontinued|SoldOut/i.test(text(offer.availability)))
          continue;
        const amount =
          typeof offer.price === "number"
            ? offer.price
            : /^\d+(?:\.\d+)?$/.test(text(offer.price))
              ? Number(offer.price)
              : undefined;
        const currency = /^[A-Z]{3}$/.test(text(offer.priceCurrency))
          ? text(offer.priceCurrency)
          : undefined;
        products.push({
          name,
          url,
          image,
          ...(amount !== undefined && Number.isFinite(amount) && amount >= 0 && currency
            ? { price: amount, currency }
            : {}),
          sourceUrl,
        });
      }
      if (
        kind.some((type) => type === "Event" || type === "MusicEvent") &&
        name &&
        events.length < 12
      ) {
        const performer = list(node.performer).some(
          (value) =>
            key(text(obj(value).name ?? value)) === key(profile.name) ||
            (!!profile.id && text(obj(value)["@id"]).endsWith(profile.id)),
        );
        if (!performer && !mentions(name, profile.name)) continue;
        if (/EventCancelled|EventPostponed/i.test(text(node.eventStatus))) continue;
        const date = text(node.startDate);
        const stamp = Date.parse(date);
        if (
          !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(date) ||
          !Number.isFinite(stamp) ||
          new Date(`${date.slice(0, 10)}T12:00:00Z`).toISOString().slice(0, 10) !==
            date.slice(0, 10) ||
          (date.length === 10 ? date < new Date(now).toISOString().slice(0, 10) : stamp < now)
        )
          continue;
        const place = obj(list(node.location)[0]);
        const address = obj(place.address);
        const venue = text(place.name);
        const city = text(address.addressLocality);
        const url = artistExtraUrl(node.url ?? obj(list(node.offers)[0]).url, sourceUrl);
        if (!url || (!venue && !city)) continue;
        events.push({ name, url, date, venue, city, sourceUrl });
      }
    }
  }
  let anchors = 0;
  for (const match of bounded.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    if (anchors++ > 500 || tourLinks.length >= 2) break;
    const label = entityText(match[2].replace(/<[^>]+>/g, " ")).trim();
    if (!/^(?:tour(?: dates)?|shows|live dates|concerts|events)$/i.test(label)) continue;
    const url = artistExtraUrl(attribute(match[1], "href"), sourceUrl);
    if (
      url &&
      (new URL(url).origin === new URL(sourceUrl).origin ||
        /(^|\.)(bandsintown|songkick|ticketmaster|axs)\.com$/.test(new URL(url).hostname)) &&
      !tourLinks.includes(url)
    )
      tourLinks.push(url);
  }
  const shopify =
    /\bShopify\.shop\s*=\s*["'][^"']+\.myshopify\.com["']/i.test(bounded) &&
    /cdn\.shopify\.com\//i.test(bounded);
  // Storefront currency is used only when the actual page declares it.
  const currency = /Shopify\.currency\s*=\s*\{[^}]*["']active["']\s*:\s*["']([A-Z]{3})["']/i.exec(
    bounded,
  )?.[1];
  return { products, events, tourLinks, shopify, artistStore, currency };
}

export function parseArtistShopify(
  value: unknown,
  sourceUrl: string,
  artist: string,
  artistStore: boolean,
  currency?: string,
): ArtistProduct[] {
  return list(obj(value).products)
    .slice(0, 16)
    .flatMap((value) => {
      const product = obj(value);
      const name = text(product.title);
      const handle = text(product.handle);
      if (
        !name ||
        !/^[a-z\d-]+$/i.test(handle) ||
        (!artistStore && !mentions(name, artist) && key(text(product.vendor)) !== key(artist))
      )
        return [];
      const image = imageUrl(obj(list(product.images)[0]).src, sourceUrl);
      if (!image) return [];
      const variants = list(product.variants)
        .map(obj)
        .filter((variant) => variant.available === true);
      if (!variants.length) return [];
      const amounts = variants.map((variant) =>
        /^\d+(?:\.\d+)?$/.test(String(variant.price)) ? Number(variant.price) : NaN,
      );
      // Varying variant prices are omitted rather than represented as a single exact price.
      const price =
        amounts.length &&
        amounts.every((amount) => Number.isFinite(amount) && amount >= 0 && amount === amounts[0])
          ? amounts[0]
          : undefined;
      return [
        {
          name,
          image,
          url: new URL(`/products/${handle}`, sourceUrl).href,
          ...(price !== undefined && currency ? { price, currency } : {}),
          sourceUrl,
        },
      ];
    })
    .slice(0, 8);
}

async function pageText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await safeFetchBytes(
    url,
    { signal, headers: { Accept: "text/html,application/json" } },
    8_000,
    MAX_BYTES,
  );
  if (
    !response.ok ||
    Number(response.headers.get("content-length") ?? 0) > MAX_BYTES ||
    (response.url && !artistExtraUrl(response.url))
  )
    throw new Error("Artist page unavailable");
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, MAX_BYTES);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) throw new Error("Artist page exceeds limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}

export async function loadArtistExtras(
  profile: MusicArtistProfile,
  signal?: AbortSignal,
): Promise<ArtistExtras> {
  signal?.throwIfAborted();
  const relevant = profile.links.filter(
    (link) =>
      ["official", "store", "merch", "tour"].includes(link.kind) &&
      !/(^|\.)(qobuz|7digital|beatport|deezer|spotify|bandcamp)\.com$/.test(
        new URL(link.url).hostname,
      ) &&
      artistExtraUrl(link.url),
  );
  const cacheKey = `${profile.id}:${relevant.map((link) => link.url).join("|")}`;
  const saved = cache.get(cacheKey);
  if (saved && saved.until > Date.now()) return saved.data;
  const links: ArtistExtraLink[] = relevant.slice(0, 4).map((link) => ({
    url: link.url,
    kind: link.kind === "official" ? "official" : link.kind === "tour" ? "tour" : "store",
  }));
  const products: ArtistProduct[] = [];
  const events: ArtistEvent[] = [];
  const sources = [
    ...new Set(
      [
        relevant.find((link) => link.kind === "merch")?.url ??
          relevant.find((link) => link.kind === "store")?.url,
        relevant.find((link) => link.kind === "official")?.url,
        relevant.find((link) => link.kind === "tour")?.url,
      ].filter((url): url is string => !!url),
    ),
  ];
  let requests = 0;
  for (const url of sources) {
    if (requests >= 4) break;
    try {
      requests++;
      const html = await pageText(url, signal);
      const trustedStore = relevant.some(
        (link) =>
          ["merch", "official"].includes(link.kind) &&
          link.url === url &&
          new URL(url).pathname === "/",
      );
      const parsed = parseArtistExtraPage(html, url, profile, Date.now(), trustedStore);
      products.push(...parsed.products);
      events.push(...parsed.events);
      for (const tour of parsed.tourLinks)
        if (!links.some((link) => link.url === tour)) links.push({ url: tour, kind: "tour" });
      if (parsed.shopify && !products.length && requests < 4) {
        requests++;
        try {
          products.push(
            ...parseArtistShopify(
              JSON.parse(await pageText(new URL("/products.json?limit=8", url).href, signal)),
              url,
              profile.name,
              parsed.artistStore &&
                /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/?)?$/i.test(new URL(url).pathname),
              parsed.currency,
            ),
          );
        } catch {
          signal?.throwIfAborted();
        }
      }
      const tour = parsed.tourLinks.find((link) => link !== url && !sources.includes(link));
      if (tour && requests < 4 && !events.length) {
        requests++;
        try {
          events.push(...parseArtistExtraPage(await pageText(tour, signal), tour, profile).events);
        } catch {
          signal?.throwIfAborted();
        }
      }
    } catch {
      signal?.throwIfAborted();
    }
  }
  const result = {
    products: [...new Map(products.map((product) => [product.url, product])).values()].slice(0, 8),
    events: [
      ...new Map(
        events.map((event) => [`${event.date}:${key(event.venue)}:${key(event.city)}`, event]),
      ).values(),
    ]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8),
    links: [...new Map(links.map((link) => [`${link.kind}:${link.url}`, link])).values()].slice(
      0,
      6,
    ),
  };
  cache.set(cacheKey, { until: Date.now() + 20 * 60_000, data: result });
  while (cache.size > 24) cache.delete(cache.keys().next().value!);
  return result;
}
