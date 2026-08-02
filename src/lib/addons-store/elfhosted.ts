export type ElfProduct = {
  slug: string;
  label: string;
  monthlyUsd: number;
  match: string[];
};

const STORE = "https://store.elfhosted.com/product";

const PRODUCTS: ElfProduct[] = [
  { slug: "comet", label: "Comet", monthlyUsd: 9, match: ["comet"] },
  { slug: "mediafusion", label: "MediaFusion", monthlyUsd: 9, match: ["mediafusion"] },
  { slug: "aiostreams", label: "AIOStreams", monthlyUsd: 9, match: ["aiostreams"] },
  { slug: "aiometadata", label: "AIOMetadata", monthlyUsd: 9, match: ["aiometadata"] },
  { slug: "stremthru", label: "StremThru", monthlyUsd: 9, match: ["stremthru"] },
  { slug: "jackettio", label: "Jackettio", monthlyUsd: 9, match: ["jackettio"] },
  {
    slug: "nuvio-streams",
    label: "Nuvio Streams",
    monthlyUsd: 9,
    match: ["nuviostreams", "nuvio"],
  },
  { slug: "streamvix", label: "StreamViX", monthlyUsd: 9, match: ["streamvix"] },
  { slug: "webstreamr", label: "WebStreamr", monthlyUsd: 9, match: ["webstreamr"] },
  { slug: "tvvoo", label: "TVVoo", monthlyUsd: 9, match: ["tvvoo"] },
  { slug: "plexio", label: "Plexio", monthlyUsd: 9, match: ["plexio"] },
  { slug: "usenet-streamer", label: "Usenet Streamer", monthlyUsd: 9, match: ["usenetstreamer"] },
  { slug: "chillibridge", label: "ChilliBridge", monthlyUsd: 9, match: ["chillibridge"] },
  { slug: "mediastorm-4k", label: "MediaStorm", monthlyUsd: 9, match: ["mediastorm"] },
  { slug: "rpdb", label: "RatingPosterDB", monthlyUsd: 9, match: ["rpdb", "ratingposterdb"] },
  { slug: "youriptv", label: "YourIPTV", monthlyUsd: 9, match: ["youriptv"] },
  { slug: "agregarr", label: "Agregarr", monthlyUsd: 9, match: ["agregarr"] },
];

function fold(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hostTokens(url: string | null | undefined): string[] {
  if (!url) return [];
  try {
    const u = new URL(url);
    return tokens(u.hostname + " " + u.pathname);
  } catch {
    return tokens(url);
  }
}

export function elfProductFor(input: {
  id?: string | null;
  name?: string | null;
  url?: string | null;
}): ElfProduct | null {
  const id = fold(input.id ?? "");
  const name = fold(input.name ?? "");
  const parts = [
    ...tokens(input.id ?? ""),
    ...tokens(input.name ?? ""),
    ...hostTokens(input.url),
  ];
  if (!id && !name && parts.length === 0) return null;
  for (const p of PRODUCTS) {
    for (const key of p.match) {
      if (id === key || name === key) return p;
      for (const part of parts) {
        if (part === key) return p;
        if (key.length >= 5 && part.startsWith(key)) return p;
      }
    }
  }
  return null;
}

export function elfProductUrl(slug: string): string {
  return `${STORE}/${slug}/`;
}

export const ELF_BUNDLE = {
  url: `${STORE}/stremio-addons-bundle/`,
  monthlyUsd: 29,
  trialUsd: 1,
  trialDays: 7,
  addonCount: 15,
  singleUsd: 9,
};

export function isElfHostedInstance(transportUrl: string | null | undefined): boolean {
  if (!transportUrl) return false;
  try {
    const host = new URL(transportUrl).hostname.toLowerCase();
    return host === "elfhosted.com" || host.endsWith(".elfhosted.com");
  } catch {
    return false;
  }
}
