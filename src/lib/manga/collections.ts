import { searchManga, type MangaSummary } from "@/lib/manga/api";
import { activeMangaSourceId } from "@/lib/manga/sources";

export type MangaCollection = {
  id: string;
  name: string;
  subtitle?: string;
  badge: string;
  award?: boolean;
  titles: string[];
};

export const MANGA_COLLECTIONS: MangaCollection[] = [
  {
    id: "popular",
    name: "Most Popular",
    subtitle: "What everyone is reading",
    badge: "Most Popular",
    titles: [
      "One Piece",
      "Jujutsu Kaisen",
      "My Dress-Up Darling",
      "Bleach",
      "Black Clover",
      "The Apothecary Diaries",
      "Naruto",
      "My Hero Academia",
      "Kaiju No. 8",
      "Chainsaw Man",
      "Spy x Family",
      "Blue Lock",
      "Sakamoto Days",
      "One Punch Man",
      "Solo Leveling",
      "Dandadan",
      "Oshi no Ko",
      "Hell's Paradise",
      "Wind Breaker",
      "Kagurabachi",
    ],
  },
  {
    id: "acclaimed",
    name: "Critically Acclaimed",
    subtitle: "Beloved by readers and critics",
    badge: "Critically Acclaimed",
    titles: [
      "Vinland Saga",
      "Berserk",
      "Monster",
      "20th Century Boys",
      "Pluto",
      "Vagabond",
      "Slam Dunk",
      "Fullmetal Alchemist",
      "Frieren: Beyond Journey's End",
      "Chainsaw Man",
      "Goodnight Punpun",
      "A Silent Voice",
      "Blade of the Immortal",
      "Nausicaa of the Valley of the Wind",
      "Fire Punch",
      "Dorohedoro",
      "Made in Abyss",
      "Witch Hat Atelier",
      "Delicious in Dungeon",
      "A Bride's Story",
      "Golden Kamuy",
      "March Comes in Like a Lion",
      "Ashita no Joe",
      "The Rose of Versailles",
      "Kingdom",
      "Fist of the North Star",
      "Akira",
      "Death Note",
      "Phoenix",
      "Mushishi",
      "Solanin",
      "Planetes",
      "Real",
      "Homunculus",
      "GTO: Great Teacher Onizuka",
      "Chihayafuru",
      "The Climber",
      "Uzumaki",
      "Ping Pong",
      "Sunny",
      "Nana",
      "Beastars",
      "Look Back",
      "Medalist",
      "Hirayasumi",
    ],
  },
  {
    id: "anime-expo",
    name: "Featured at Anime Expo",
    subtitle: "Spotlighted at the show",
    badge: "Anime Expo",
    titles: [
      "Jujutsu Kaisen",
      "Haikyu!!",
      "Attack on Titan",
      "The Apothecary Diaries",
      "Bungo Stray Dogs",
      "My Dress-Up Darling",
      "My Hero Academia",
      "Black Clover",
      "The Seven Deadly Sins",
      "Fire Force",
      "Tokyo Revengers",
      "Lycoris Recoil",
    ],
  },
  {
    id: "eisner",
    name: "Eisner Award Winners",
    subtitle: "The comics industry's highest honor",
    badge: "Eisner Winner",
    award: true,
    titles: [
      "Old Boy",
      "Tekkonkinkreet",
      "Dororo",
      "A Drifting Life",
      "20th Century Boys",
      "Onward Towards Our Noble Deaths",
      "The Mysterious Underground Men",
      "Showa: A History of Japan",
      "My Brother's Husband",
      "Tokyo Tarareba Girls",
      "Cats of the Louvre",
      "Witch Hat Atelier",
      "Remina",
      "Lovesickness",
      "Shuna's Journey",
      "My Picture Diary",
      "Tokyo These Days",
    ],
  },
  {
    id: "harvey",
    name: "Harvey Award Winners",
    subtitle: "Best Manga honorees",
    badge: "Harvey Winner",
    award: true,
    titles: [
      "Attack on Titan",
      "My Lesbian Experience with Loneliness",
      "My Hero Academia",
      "Witch Hat Atelier",
      "Chainsaw Man",
      "Delicious in Dungeon",
    ],
  },
  {
    id: "seiun",
    name: "Seiun Award Winners",
    subtitle: "Japan's top science-fiction comic honor",
    badge: "Seiun Winner",
    award: true,
    titles: [
      "To Terra...",
      "Domu: A Child's Dream",
      "Appleseed",
      "Urusei Yatsura",
      "Mermaid Saga",
      "Nausicaa of the Valley of the Wind",
      "Parasyte",
      "Ushio and Tora",
      "Cardcaptor Sakura",
      "Planetes",
      "From Far Away",
      "Yokohama Kaidashi Kikou",
      "20th Century Boys",
      "Trigun Maximum",
      "Pluto",
      "Fullmetal Alchemist",
      "Mobile Suit Gundam: The Origin",
      "The World of Narue",
      "Moyashimon",
      "Knights of Sidonia",
      "KochiKame",
      "And Yet the Town Moves",
      "Girls' Last Tour",
      "Hozuki's Coolheadedness",
      "Zettai Karen Children",
      "Orb: On the Movements of the Earth",
      "Delicious in Dungeon",
      "Land of the Lustrous",
    ],
  },
];

function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(manga|the)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TITLE_INDEX: Array<{ key: string; collection: MangaCollection }> = MANGA_COLLECTIONS.flatMap(
  (collection) => collection.titles.map((title) => ({ key: normalize(title), collection })),
);

export function collectionsForTitle(title?: string): MangaCollection[] {
  if (!title) return [];
  const key = normalize(title);
  if (!key) return [];
  const out: MangaCollection[] = [];
  const seen = new Set<string>();
  for (const entry of TITLE_INDEX) {
    if (seen.has(entry.collection.id)) continue;
    if (entry.key === key || entry.key.includes(key) || key.includes(entry.key)) {
      seen.add(entry.collection.id);
      out.push(entry.collection);
    }
  }
  return out;
}

const resolveCache = new Map<string, MangaSummary[]>();

async function poolEach<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      await fn(items[cursor++]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

export async function streamCollection(
  collection: MangaCollection,
  onChunk: (items: MangaSummary[]) => void,
): Promise<void> {
  const cacheKey = `${activeMangaSourceId()}::${collection.id}`;
  const cached = resolveCache.get(cacheKey);
  if (cached) {
    onChunk(cached);
    return;
  }
  const out: MangaSummary[] = [];
  const seen = new Set<string>();
  await poolEach(collection.titles, 5, async (title) => {
    const hit = (await searchManga(title, 0).catch(() => []))[0];
    if (hit && hit.cover && !seen.has(hit.id)) {
      seen.add(hit.id);
      out.push(hit);
      onChunk([hit]);
    }
  });
  if (out.length) resolveCache.set(cacheKey, out);
}
