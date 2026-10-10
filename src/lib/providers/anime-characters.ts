import { anilistRequest } from "@/lib/anilist/client";
import { kitsuToAnilist } from "@/lib/providers/anime-mapping";
import { lruSet } from "@/lib/cache";
import { registerEvictable } from "@/lib/maintenance";

const CHARACTERS_QUERY = `query ($id: Int) {
  Media(id: $id) {
    characters(sort: [ROLE, FAVOURITES_DESC], perPage: 25, page: 1) {
      edges {
        role
        node { id name { full native } image { large medium } favourites }
      }
    }
  }
}`;

const ROLE_LABELS: Record<string, string> = {
  MAIN: "Main",
  SUPPORTING: "Supporting",
  BACKGROUND: "Background",
};

type RawCharacterNode = {
  id: number;
  name: { full: string | null; native: string | null };
  image: { large: string | null; medium: string | null } | null;
  favourites: number | null;
};

type RawEdge = { role: string | null; node: RawCharacterNode | null };

type CharactersResponse = {
  Media: { characters: { edges: RawEdge[] } | null } | null;
};

export type AnimeCharacter = {
  id: number;
  name: string;
  nativeName?: string;
  image?: string;
  role?: string;
  favourites?: number;
};

function toCharacter(edge: RawEdge): AnimeCharacter | null {
  const node = edge.node;
  if (!node || node.id == null) return null;
  const name = (node.name.full ?? "").trim();
  if (!name) return null;
  return {
    id: node.id,
    name,
    nativeName: node.name.native ?? undefined,
    image: node.image?.medium ?? node.image?.large ?? undefined,
    role: edge.role ? ROLE_LABELS[edge.role] ?? undefined : undefined,
    favourites:
      typeof node.favourites === "number" && node.favourites > 0 ? node.favourites : undefined,
  };
}

const cache = new Map<number, AnimeCharacter[]>();
const CACHE_MAX = 250;
registerEvictable("anime-characters", (aggressive) => {
  if (aggressive) cache.clear();
});

export async function fetchAnimeCharacters(anilistId: number): Promise<AnimeCharacter[]> {
  const cached = cache.get(anilistId);
  if (cached) return cached;
  try {
    const data = await anilistRequest<CharactersResponse>(
      CHARACTERS_QUERY,
      { id: anilistId },
      undefined,
      true,
    );
    const edges = data?.Media?.characters?.edges ?? [];
    const result: AnimeCharacter[] = [];
    for (const edge of edges) {
      const character = toCharacter(edge);
      if (character) result.push(character);
    }
    lruSet(cache, anilistId, result, CACHE_MAX);
    return result;
  } catch {
    lruSet(cache, anilistId, [], CACHE_MAX);
    return [];
  }
}

export async function fetchAnimeCharactersByKitsu(kitsuId: number): Promise<AnimeCharacter[]> {
  const anilistId = await kitsuToAnilist(kitsuId).catch(() => null);
  if (!anilistId) return [];
  return fetchAnimeCharacters(anilistId);
}
