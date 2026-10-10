import type { WarframeWorld } from "./warframe-data";

// Original Digital Extremes art from Plains of Eidolon Remaster, Explore Venus
// and the Stars Beyond, Heart of Deimos Update29, and the Duviri hub respectively.
export const WARFRAME_ART: Partial<Record<WarframeWorld, string>> = {
  cetus: "https://www-static.warframe.com/uploads/ff6fdf064e1bfd1e3c5d434a30424e54.jpg",
  vallis: "https://www-static.warframe.com/uploads/b46930e89ac11d80be36ff35e3c299ef.jpg",
  cambion: "https://www-static.warframe.com/uploads/357d572c7fd7f8aab968e05259afab6e.jpg",
  duviri: "https://www-static.warframe.com/images/duviri-hubsite/prison-bg-desktop.png",
};

// Digital Extremes' Baro announcement art; original UI emblems from WFCD/genesis-assets.
export const WARFRAME_BARO_ART = "https://www-static.warframe.com/uploads/thumbnails/7bd48753f37eba9469c585bf2adb387a_1600x900.png";
export const WARFRAME_RELIC_ART = ["RelicLithD.png", "RelicMesoD.png", "RelicNeoD.png", "RelicAxiD.png", "RelicImmortalD.png"]
  .map(name => `https://cdn.warframestat.us/img/${name}`);

const factions: Record<string, string> = {
  Grineer: "grineer", Corpus: "corpus", Infested: "infested", Corrupted: "corrupted",
  Orokin: "corrupted", Narmer: "narmer", Sentient: "sentient", Murmur: "murmur", "The Murmur": "murmur",
};
export const warframeFactionArt = (name: string) => factions[name] ? `/games/warframe/${factions[name]}.svg` : "";
