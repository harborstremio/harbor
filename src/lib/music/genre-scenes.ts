import { MUSIC_GENRES, relatedMusicGenres, type MusicDiscoveryGenre } from "./genre-catalog";

// Editorial relationships, not country-based guesses: rap should lead to rap scenes.
const SCENES: Record<string, string[]> = {
  "hip-hop": ["chicago-drill","new-york-drill","east-coast-hip-hop","west-coast-hip-hop","southern-hip-hop","atlanta-rap","houston-rap","memphis-rap","detroit-rap","bay-area-rap","g-funk","boom-bap","jazz-rap","conscious-hip-hop","alternative-hip-hop","crunk","miami-bass","chopped-and-screwed", "trap", "russian-rap", "ukrainian-rap", "horrorcore", "uk-drill", "grime", "phonk", "lofi", "french-rap", "brazilian-trap", "german-rap", "latin-trap", "turkish-rap"],
  'russian-rap': ['russian-hyperpop','trap','phonk'],
  'russian-hyperpop': ['hyperpop','russian-rap','nightcore','phonk'],
  'ukrainian-rap': ['ukrainian-wartime','hip-hop','trap'],
  'ukrainian-wartime': ['ukrainian-rap','hip-hop','alternative'],
  'internet-classics': ['nightcore','vocaloid','anime','hyperpop'],
  'goth': ['post-punk','new-wave','emo','shoegaze','alternative'],
  'hyperpop': ['russian-hyperpop','internet-classics','nightcore'],
  pop: ["indie-pop", "hyperpop", "k-pop", "j-pop", "city-pop", "mandopop", "cantopop", "v-pop", "thai-pop", "opm"],
  rnb: ["neo-soul", "soul-funk", "gospel", "afrobeats"],
  rock: ["alternative", "punk", "pop-punk", "emo", "goth", "shoegaze", "progressive-rock", "j-rock", "metal"],
  alternative: ["indie-pop", "shoegaze", "emo", "punk", "progressive-rock"],
  metal: ["metalcore", "death-metal", "black-metal", "hardcore", "progressive-rock"],
  electronic: ["house", "techno", "drum-and-bass", "trance", "dubstep", "breakbeat", "ambient", "synthwave", "uk-garage", "hardstyle"],
  dance: ["house", "eurodance", "hands-up", "jumpstyle", "hardstyle", "happy-hardcore", "disco", "trance"],
  house: ["deep-house", "tech-house", "afro-house", "amapiano", "uk-garage"],
  hardstyle: ["jumpstyle", "hardcore", "frenchcore", "happy-hardcore", "hands-up"],
  nightcore: ["hands-up", "eurodance", "happy-hardcore", "vocaloid", "hyperpop"],
  jazz: ["bossa-nova", "soul-funk", "blues", "lofi", "neo-soul"],
  "soul-funk": ["neo-soul", "rnb", "disco", "gospel", "afrobeat"],
  reggae: ["dub", "dancehall", "reggae-en-espanol", "soca"],
  brazilian: ["funk-carioca", "pagode", "samba", "bossa-nova", "mpb", "sertanejo", "forro", "piseiro", "axe", "brazilian-trap"],
  latin: ["reggaeton", "latin-trap", "salsa", "cumbia", "bachata", "merengue", "dembow", "regional-mexican", "brazilian"],
  "regional-mexican": ["corridos-tumbados", "banda", "norteno", "mariachi"],
  african: ["afrobeats", "amapiano", "gqom", "kwaito", "highlife", "afrobeat", "bongo-flava", "singeli", "soukous", "kuduro", "kizomba", "rai", "gnawa", "mbalax"],
  asian: ["k-pop", "j-pop", "j-rock", "city-pop", "mandopop", "cantopop", "v-pop", "thai-pop", "opm", "dangdut", "indian"],
  indian: ["bollywood", "punjabi", "bhangra", "qawwali", "carnatic", "hindustani"],
};

export function genreSceneBranches(genre: MusicDiscoveryGenre): MusicDiscoveryGenre[] {
  const direct = SCENES[genre.slug];
  const siblings = direct ?? Object.entries(SCENES).find(([, children]) => children.includes(genre.slug))?.[1];
  if (!siblings) return relatedMusicGenres(genre);
  return siblings.flatMap(slug => {
    const entry = MUSIC_GENRES.find(item => item.slug === slug && item.id !== genre.id);
    return entry ? [entry] : [];
  });
}
