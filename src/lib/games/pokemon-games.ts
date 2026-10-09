/** Retail identities stay edition-specific; a hack never inherits retail encounter data. */
export type PokemonEdition = { key: string; version?: string; group?: string; region?: string; generation?: number; guide: string; guideTitle?: string; maps?: string; mascots: number[]; hack?: boolean };
const editions: PokemonEdition[] = [];
function add(keys: string[], group: string, region: string, generation: number, guide: string, maps: string | undefined, mascots: number[]) {
  for (const key of keys) editions.push({ key, version: key, group, region, generation, guide, maps, mascots });
}
add(["red", "blue"], "red-blue", "kanto", 1, "Red and Blue", "Red, Green, Blue, and Yellow maps", [1, 4, 7]);
add(["yellow"], "yellow", "kanto", 1, "Yellow", "Red, Green, Blue, and Yellow maps", [25, 133, 151]);
add(["gold", "silver"], "gold-silver", "johto", 2, "Gold and Silver", "Gold, Silver, and Crystal maps", [152, 155, 158]);
add(["crystal"], "crystal", "johto", 2, "Crystal", "Gold, Silver, and Crystal maps", [245, 251, 155]);
add(["ruby", "sapphire"], "ruby-sapphire", "hoenn", 3, "Ruby and Sapphire", "Ruby, Sapphire, and Emerald maps", [252, 255, 258]);
add(["emerald"], "emerald", "hoenn", 3, "Emerald", "Ruby, Sapphire, and Emerald maps", [384, 252, 258]);
add(["firered", "leafgreen"], "firered-leafgreen", "kanto", 3, "FireRed and LeafGreen", "FireRed and LeafGreen maps", [6, 3, 9]);
add(["diamond", "pearl"], "diamond-pearl", "sinnoh", 4, "Diamond and Pearl", "Diamond, Pearl, and Platinum maps", [387, 390, 393]);
add(["platinum"], "platinum", "sinnoh", 4, "Platinum", "Diamond, Pearl, and Platinum maps", [487, 393, 448]);
add(["heartgold", "soulsilver"], "heartgold-soulsilver", "johto", 4, "HeartGold and SoulSilver", "HeartGold and SoulSilver maps", [250, 249, 152]);
add(["black", "white"], "black-white", "unova", 5, "Black and White", "Black, White, Black 2, and White 2 maps", [495, 498, 501]);
add(["black-2", "white-2"], "black-2-white-2", "unova", 5, "Black 2 and White 2", "Black, White, Black 2, and White 2 maps", [646, 448, 501]);
add(["x", "y"], "x-y", "kalos", 6, "X and Y", "X and Y maps", [650, 653, 656]);
add(["omega-ruby", "alpha-sapphire"], "omega-ruby-alpha-sapphire", "hoenn", 6, "Omega Ruby and Alpha Sapphire", "Omega Ruby and Alpha Sapphire maps", [383, 382, 384]);
add(["sun", "moon"], "sun-moon", "alola", 7, "Sun and Moon", "Sun, Moon, Ultra Sun, and Ultra Moon maps", [722, 725, 728]);
add(["ultra-sun", "ultra-moon"], "ultra-sun-ultra-moon", "alola", 7, "Ultra Sun and Ultra Moon", "Sun, Moon, Ultra Sun, and Ultra Moon maps", [800, 791, 792]);
add(["lets-go-pikachu", "lets-go-eevee"], "lets-go-pikachu-lets-go-eevee", "kanto", 7, "Let's Go, Pikachu! and Let's Go, Eevee!", "Let's Go, Pikachu! and Let's Go, Eevee! maps", [25, 133, 151]);
add(["sword", "shield"], "sword-shield", "galar", 8, "Sword and Shield", "Sword and Shield maps", [810, 813, 816]);
add(["brilliant-diamond", "shining-pearl"], "brilliant-diamond-and-shining-pearl", "sinnoh", 8, "Brilliant Diamond and Shining Pearl", "Brilliant Diamond and Shining Pearl maps", [483, 484, 393]);
add(["legends-arceus"], "legends-arceus", "hisui", 8, "Legends: Arceus", "Legends: Arceus maps", [493, 501, 722]);
add(["scarlet", "violet"], "scarlet-violet", "paldea", 9, "Scarlet and Violet", "Scarlet and Violet maps", [906, 909, 912]);
add(["legends-za"], "legends-za", "kalos", 9, "Legends: Z-A", "Legends: Z-A maps", [718, 152, 498]);
add(["colosseum"], "colosseum", "orre", 3, "Colosseum", undefined, [196, 197, 243]);
add(["xd"], "xd", "orre", 3, "XD: Gale of Darkness", undefined, [249, 133, 373]);
const sideGames: { names: string[]; guide: string; title?: string; maps?: string; mascots: number[] }[] = [
  { names:["Mystery Dungeon: Red Rescue Team","Mystery Dungeon: Blue Rescue Team"],guide:"Mystery Dungeon: Red Rescue Team and Blue Rescue Team",mascots:[25,133,4] },
  { names:["Mystery Dungeon: Explorers of Time","Mystery Dungeon: Explorers of Darkness"],guide:"Mystery Dungeon: Explorers of Time and Explorers of Darkness",mascots:[252,393,390] },
  { names:["Mystery Dungeon: Explorers of Sky"],guide:"Mystery Dungeon: Explorers of Sky",mascots:[492,253,448] },
  { names:["Ranger"],guide:"Ranger",mascots:[311,312,386] },
  { names:["Ranger: Shadows of Almia"],guide:"Ranger: Shadows of Almia",mascots:[417,447,490] },
  { names:["Ranger: Guardian Signs"],guide:"Ranger: Guardian Signs",mascots:[172,243,244] },
  { names:["Snap"],guide:"Snap",mascots:[25,7,151] },
  { names:["New Pokémon Snap"],guide:"New Pokémon Snap",title:"Walkthrough:New Pokémon Snap",mascots:[154,131,83] },
  { names:["Conquest"],guide:"Conquest",mascots:[133,493,150] },
  { names:["Trading Card Game"],guide:"Trading Card Game (video game)",maps:"Pokémon Card GB maps",mascots:[6,3,9] },
  { names:["Pinball"],guide:"Pinball",mascots:[25,35,39] },
  { names:["Stadium"],guide:"Stadium",mascots:[25,6,9] },
  { names:["Battle Revolution"],guide:"Battle Revolution",mascots:[466,467,490] },
  { names:["Detective Pikachu"],guide:"Detective Pikachu",title:"Walkthrough:Detective Pikachu",mascots:[25,54,122] },
  { names:["Hey You, Pikachu!"],guide:"Hey You, Pikachu!",title:"Walkthrough:Hey You, Pikachu!",mascots:[25,1,60] },
  { names:["PokéPark Wii: Pikachu's Adventure"],guide:"PokéPark Wii: Pikachu's Adventure",title:"Walkthrough:PokéPark Wii: Pikachu's Adventure",mascots:[25,152,393] },
  { names:["PokéPark 2: Wonders Beyond"],guide:"PokéPark 2: Wonders Beyond",title:"Walkthrough:PokéPark 2: Wonders Beyond",mascots:[25,495,498] },
];
export const POKEMON_EDITIONS = editions;
export const pokemonGuideTitle = (edition: PokemonEdition) => edition.guideTitle ?? `Walkthrough:Pokémon ${edition.guide}`;
export const pokemonNameKey = (name: string) => name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/pok[eé]mon|pocket monsters|version/g, "").replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string> = { xdgaleofdarkness: "xd", redversion: "red", blueversion: "blue", yellowspecialpikachuedition: "yellow" };
export function pokemonEdition(name: string, gameType?: number): PokemonEdition | null {
  // IGDB mods must not inherit retail tools even when their title matches a base game.
  if (gameType === 5) return null;
  if (!/pok[eé]mon|pocket monsters/i.test(name) && !/^(pokepark|pokken|detectivepikachu|heyyoupikachu|pokemmo|pokerogue|pokopia)/.test(pokemonNameKey(name))) return null;
  const key = pokemonNameKey(name), alias = aliases[key];
  const match = editions.find(item => pokemonNameKey(item.key) === (alias ?? key));
  if (match) return match;
  const side=sideGames.find(game=>game.names.some(title=>pokemonNameKey(title)===key));
  if(side)return {key,guide:side.guide,guideTitle:side.title,maps:side.maps,mascots:side.mascots};
  // A Pokémon name alone does not establish guide, encounter or save compatibility.
  return null;
}
export function pokemonArt(id: number) { return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`; }
export function pokemonSprite(id: number, shiny = false) { return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? "shiny/" : ""}${id}.png`; }
