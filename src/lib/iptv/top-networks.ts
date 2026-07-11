import type { IptvChannel } from "./types";

export type NetworkDef = {
  id: string;
  displayName: string;
  match: RegExp;
  exclude?: RegExp;
};

export type NetworkRow = {
  id: string;
  title: string;
  networks: NetworkDef[];
};

const word = (s: string) => `(?:^|[^a-z0-9])${s}(?:$|[^a-z0-9])`;

export const US_NETWORK_ROWS: NetworkRow[] = [
  {
    id: "us-broadcast",
    title: "Broadcast networks",
    networks: [
      { id: "abc", displayName: "ABC", match: new RegExp(word("abc"), "i"), exclude: /family|news\s|abcn\b|spark/i },
      { id: "cbs", displayName: "CBS", match: new RegExp(word("cbs"), "i"), exclude: /sports|news\s|cbsn\b|justice/i },
      { id: "nbc", displayName: "NBC", match: new RegExp(word("nbc"), "i"), exclude: /msnbc|cnbc|sports|news\s/i },
      {
        id: "fox",
        displayName: "FOX",
        match: new RegExp(word("fox"), "i"),
        exclude: /fox\s+news|fox\s+sports|fox\s+business|news\s/i,
      },
      { id: "cw", displayName: "The CW", match: /\bcw\b/i, exclude: /cwseed|news\s/i },
      { id: "pbs", displayName: "PBS", match: /\bpbs\b/i, exclude: /kids|news\s/i },
      { id: "my-network", displayName: "MyNetwork", match: /mynetwork/i },
      { id: "telemundo", displayName: "Telemundo", match: /telemundo/i },
      { id: "univision", displayName: "Univision", match: /univision/i, exclude: /tudn/i },
      { id: "estrella", displayName: "Estrella TV", match: /estrella/i },
    ],
  },
  {
    id: "us-news",
    title: "News",
    networks: [
      { id: "cnn", displayName: "CNN", match: /\bcnn\b/i, exclude: /cnn\s+espanol/i },
      { id: "fox-news", displayName: "FOX News", match: /fox\s+news/i },
      { id: "msnbc", displayName: "MSNBC", match: /msnbc/i },
      { id: "cnbc", displayName: "CNBC", match: /\bcnbc\b/i, exclude: /world/i },
      { id: "fox-business", displayName: "FOX Business", match: /fox\s+business/i },
      { id: "newsmax", displayName: "Newsmax", match: /newsmax/i },
      { id: "oan", displayName: "OAN", match: /\boan\b|one\s+america\s+news/i },
      { id: "newsnation", displayName: "NewsNation", match: /newsnation/i },
      { id: "bbc-america", displayName: "BBC America", match: /bbc\s+america/i },
      { id: "bbc-world", displayName: "BBC World", match: /bbc\s+world/i },
      { id: "bloomberg", displayName: "Bloomberg", match: /bloomberg/i },
      { id: "weather", displayName: "Weather Channel", match: /weather\s+channel/i },
      { id: "c-span", displayName: "C-SPAN", match: /\bc[\s-]?span\b/i },
    ],
  },
  {
    id: "us-sports",
    title: "Sports",
    networks: [
      {
        id: "espn",
        displayName: "ESPN",
        match: /\bespn\b/i,
        exclude: /espn2|espnu|espn\s+news|espn\s+deportes|espn\+|espn\s+plus/i,
      },
      { id: "espn2", displayName: "ESPN2", match: /\bespn2\b/i },
      { id: "espn-u", displayName: "ESPNU", match: /\bespnu\b/i },
      { id: "espn-news", displayName: "ESPN News", match: /espn\s+news/i },
      { id: "espn-deportes", displayName: "ESPN Deportes", match: /espn\s+deportes/i },
      { id: "espn-plus", displayName: "ESPN+", match: /espn\+|espn\s+plus/i },
      { id: "fs1", displayName: "FOX Sports 1", match: /fox\s+sports\s+1|\bfs1\b/i },
      { id: "fs2", displayName: "FOX Sports 2", match: /fox\s+sports\s+2|\bfs2\b/i },
      { id: "nbc-sports", displayName: "NBC Sports", match: /nbc\s+sports/i },
      { id: "cbs-sports", displayName: "CBS Sports", match: /cbs\s+sports/i },
      { id: "nfl-network", displayName: "NFL Network", match: /\bnfl\s+network\b/i },
      { id: "nfl-redzone", displayName: "NFL RedZone", match: /redzone/i },
      { id: "nba-tv", displayName: "NBA TV", match: /\bnba\s+tv\b/i },
      { id: "mlb", displayName: "MLB Network", match: /\bmlb\s+network\b/i },
      { id: "nhl", displayName: "NHL Network", match: /\bnhl\s+network\b/i },
      { id: "tennis", displayName: "Tennis Channel", match: /tennis\s+channel/i },
      { id: "golf", displayName: "Golf Channel", match: /golf\s+channel/i },
      { id: "btn", displayName: "Big Ten Network", match: /big\s+ten\s+network|\bbtn\+?\b/i },
      { id: "sec", displayName: "SEC Network", match: /sec\s+network/i },
      { id: "acc", displayName: "ACC Network", match: /acc\s+network/i },
      { id: "olympic", displayName: "Olympic Channel", match: /olympic\s+channel/i },
      { id: "tudn", displayName: "TUDN", match: /\btudn\b/i },
    ],
  },
  {
    id: "us-premium",
    title: "Premium movies",
    networks: [
      { id: "hbo", displayName: "HBO", match: /\bhbo\b/i, exclude: /max|latino|hits/i },
      { id: "max", displayName: "Max", match: /hbo\s+max|\bmax\b/i, exclude: /cinemax|maxim/i },
      { id: "showtime", displayName: "Showtime", match: /showtime/i },
      { id: "starz", displayName: "Starz", match: /starz/i, exclude: /encore/i },
      { id: "cinemax", displayName: "Cinemax", match: /cinemax/i },
      { id: "epix", displayName: "MGM+", match: /\bepix\b|mgm\+|mgm\s+plus/i },
      { id: "paramount-plus", displayName: "Paramount+", match: /paramount\+|paramount\s+plus/i },
      { id: "peacock", displayName: "Peacock", match: /peacock/i },
      { id: "apple-tv-plus", displayName: "Apple TV+", match: /apple\s+tv\+|apple\s+tv\s+plus/i },
      { id: "disney-plus", displayName: "Disney+", match: /disney\+|disney\s+plus/i, exclude: /channel|jr|xd/i },
      { id: "netflix", displayName: "Netflix", match: /netflix/i },
      { id: "tcm", displayName: "Turner Classic Movies", match: /turner\s+classic|\btcm\b/i },
    ],
  },
  {
    id: "us-entertainment",
    title: "Entertainment",
    networks: [
      { id: "amc", displayName: "AMC", match: /\bamc\b/i, exclude: /\+|plus/i },
      { id: "fx", displayName: "FX", match: /\bfx\b/i, exclude: /fxx|fxm|fox/i },
      { id: "fxx", displayName: "FXX", match: /\bfxx\b/i },
      { id: "fxm", displayName: "FXM", match: /\bfxm\b/i },
      { id: "usa", displayName: "USA Network", match: /usa\s+network/i },
      { id: "tnt", displayName: "TNT", match: /\btnt\b/i, exclude: /sports/i },
      { id: "tbs", displayName: "TBS", match: /\btbs\b/i },
      { id: "bravo", displayName: "Bravo", match: /\bbravo\b/i },
      { id: "e", displayName: "E!", match: /\be!\s|^e!$|\be!\stv/i },
      { id: "syfy", displayName: "SyFy", match: /sy[\s-]?fy/i },
      { id: "comedy-central", displayName: "Comedy Central", match: /comedy\s+central/i },
      { id: "paramount-network", displayName: "Paramount Network", match: /paramount\s+network/i },
      { id: "ifc", displayName: "IFC", match: /\bifc\b/i },
      { id: "sundance", displayName: "Sundance", match: /sundance/i },
      { id: "pop-tv", displayName: "Pop TV", match: /\bpop\s+tv\b/i },
      { id: "we-tv", displayName: "WE tv", match: /\bwe\s+tv\b/i },
      { id: "ovation", displayName: "Ovation", match: /ovation/i },
      { id: "reelz", displayName: "Reelz", match: /reelz/i },
    ],
  },
  {
    id: "us-lifestyle",
    title: "Lifestyle & Reality",
    networks: [
      { id: "hgtv", displayName: "HGTV", match: /\bhgtv\b/i },
      { id: "food", displayName: "Food Network", match: /food\s+network/i },
      { id: "tlc", displayName: "TLC", match: /\btlc\b/i },
      { id: "lifetime", displayName: "Lifetime", match: /\blifetime\b/i, exclude: /movies/i },
      { id: "lifetime-movies", displayName: "Lifetime Movies", match: /lifetime\s+movies/i },
      { id: "own", displayName: "OWN", match: /\bown\b/i },
      { id: "ae", displayName: "A&E", match: /\ba[\s&]+e\b|a\s*&\s*e/i },
      {
        id: "investigation",
        displayName: "Investigation Discovery",
        match: /investigation\s+discovery|\bid\b\s+channel/i,
      },
      { id: "hallmark", displayName: "Hallmark", match: /hallmark/i, exclude: /movies|drama/i },
      { id: "hallmark-movies", displayName: "Hallmark Movies", match: /hallmark\s+movies/i },
      { id: "diy", displayName: "DIY", match: /\bdiy\b/i },
      { id: "magnolia", displayName: "Magnolia", match: /magnolia/i },
      { id: "fyi", displayName: "FYI", match: /\bfyi\b/i },
    ],
  },
  {
    id: "us-documentary",
    title: "Documentary & Discovery",
    networks: [
      {
        id: "discovery",
        displayName: "Discovery",
        match: /discovery/i,
        exclude: /science|family|investigation|history/i,
      },
      { id: "history", displayName: "History", match: /\bhistory\b/i, exclude: /military|vault/i },
      { id: "history2", displayName: "History 2", match: /history\s+2|h2\b/i },
      { id: "natgeo", displayName: "Nat Geo", match: /nat\s*geo|national\s+geographic/i, exclude: /wild|mundo/i },
      { id: "natgeo-wild", displayName: "Nat Geo Wild", match: /nat\s*geo\s+wild/i },
      { id: "smithsonian", displayName: "Smithsonian", match: /smithsonian/i },
      { id: "science", displayName: "Science Channel", match: /science\s+channel/i },
      { id: "animal-planet", displayName: "Animal Planet", match: /animal\s+planet/i },
      { id: "travel", displayName: "Travel Channel", match: /travel\s+channel/i },
      { id: "destination", displayName: "Destination America", match: /destination\s+america/i },
      { id: "motortrend", displayName: "MotorTrend", match: /motor\s*trend/i },
    ],
  },
  {
    id: "us-kids",
    title: "Kids & Family",
    networks: [
      { id: "disney", displayName: "Disney Channel", match: /disney\s+channel/i },
      { id: "disney-jr", displayName: "Disney Jr", match: /disney\s+jr/i },
      { id: "disney-xd", displayName: "Disney XD", match: /disney\s+xd/i },
      { id: "nickelodeon", displayName: "Nickelodeon", match: /nickelodeon/i, exclude: /jr|nicktoons/i },
      { id: "nick-jr", displayName: "Nick Jr", match: /nick\s+jr/i },
      { id: "nicktoons", displayName: "Nicktoons", match: /nicktoons/i },
      { id: "cartoon-network", displayName: "Cartoon Network", match: /cartoon\s+network/i },
      { id: "boomerang", displayName: "Boomerang", match: /boomerang/i },
      { id: "pbs-kids", displayName: "PBS Kids", match: /pbs\s+kids/i },
      { id: "universal-kids", displayName: "Universal Kids", match: /universal\s+kids/i },
      { id: "cartoonito", displayName: "Cartoonito", match: /cartoonito/i },
      { id: "baby-tv", displayName: "Baby TV", match: /baby\s*tv/i },
    ],
  },
  {
    id: "us-music",
    title: "Music",
    networks: [
      { id: "mtv", displayName: "MTV", match: /\bmtv\b/i, exclude: /mtv2|live|classic/i },
      { id: "mtv2", displayName: "MTV2", match: /\bmtv2\b/i },
      { id: "mtv-classic", displayName: "MTV Classic", match: /mtv\s+classic/i },
      { id: "mtv-live", displayName: "MTV Live", match: /mtv\s+live/i },
      { id: "vh1", displayName: "VH1", match: /\bvh1\b/i },
      { id: "bet", displayName: "BET", match: /\bbet\b/i, exclude: /her/i },
      { id: "bet-her", displayName: "BET Her", match: /bet\s+her/i },
      { id: "cmt", displayName: "CMT", match: /\bcmt\b/i },
      { id: "revolt", displayName: "Revolt", match: /revolt/i },
      { id: "axs", displayName: "AXS TV", match: /\baxs\s+tv\b/i },
    ],
  },
];

export const BR_NETWORK_ROWS: NetworkRow[] = [
  {
    id: "br-broadcast",
    title: "Rede aberta",
    networks: [
      { id: "globo", displayName: "Globo", match: /\bglobo\b/i, exclude: /news|esporte/i },
      { id: "globonews", displayName: "GloboNews", match: /globo\s*news/i },
      { id: "sbt", displayName: "SBT", match: /\bsbt\b/i },
      { id: "record", displayName: "Record", match: /\brecord\b/i, exclude: /news/i },
      { id: "record-news", displayName: "Record News", match: /record\s+news/i },
      { id: "band", displayName: "Band", match: /\bband\b/i, exclude: /sports|news/i },
      { id: "redetv", displayName: "RedeTV!", match: /redetv/i },
      { id: "cnn-brasil", displayName: "CNN Brasil", match: /cnn\s+brasil/i },
    ],
  },
  {
    id: "br-sports",
    title: "Esportes",
    networks: [
      { id: "sportv", displayName: "SporTV", match: /sportv/i },
      { id: "espn-br", displayName: "ESPN Brasil", match: /espn\s+brasil/i },
      { id: "premiere", displayName: "Premiere", match: /premiere/i },
      { id: "combate", displayName: "Combate", match: /combate/i },
      { id: "esporte-interativo", displayName: "Esporte Interativo", match: /esporte\s+interativo/i },
    ],
  },
];

export const UK_NETWORK_ROWS: NetworkRow[] = [
  {
    id: "uk-broadcast",
    title: "Broadcast",
    networks: [
      { id: "bbc-one", displayName: "BBC One", match: /bbc\s+one/i },
      { id: "bbc-two", displayName: "BBC Two", match: /bbc\s+two/i },
      { id: "bbc-three", displayName: "BBC Three", match: /bbc\s+three/i },
      { id: "bbc-four", displayName: "BBC Four", match: /bbc\s+four/i },
      { id: "itv", displayName: "ITV", match: /\bitv\b/i },
      { id: "channel-4", displayName: "Channel 4", match: /channel\s+4/i },
      { id: "channel-5", displayName: "Channel 5", match: /channel\s+5/i },
      { id: "sky-news", displayName: "Sky News", match: /sky\s+news/i },
    ],
  },
  {
    id: "uk-sports",
    title: "Sports",
    networks: [
      { id: "sky-sports", displayName: "Sky Sports", match: /sky\s+sports/i },
      { id: "bt-sport", displayName: "BT Sport", match: /\bbt\s+sport\b/i },
      { id: "tnt-sports-uk", displayName: "TNT Sports", match: /tnt\s+sports/i },
      { id: "eurosport", displayName: "Eurosport", match: /eurosport/i },
    ],
  },
];

export function rowsForRegion(region: string): NetworkRow[] {
  const r = region.toUpperCase();
  if (r === "US" || r === "USA") return US_NETWORK_ROWS;
  if (r === "BR" || r === "BRA") return BR_NETWORK_ROWS;
  if (r === "GB" || r === "UK") return UK_NETWORK_ROWS;
  return [];
}

const REGION_GROUP_TOKENS: Record<string, string[]> = {
  US: ["US", "USA", "AMERICAN"],
  USA: ["US", "USA", "AMERICAN"],
  BR: ["BR", "BRA", "BRASIL", "BRAZIL"],
  BRA: ["BR", "BRA", "BRASIL", "BRAZIL"],
  GB: ["UK", "GB", "BRITAIN", "BRITISH", "ENGLAND"],
  UK: ["UK", "GB", "BRITAIN", "BRITISH", "ENGLAND"],
};

export function filterChannelsByRegion(channels: IptvChannel[], region: string): IptvChannel[] {
  const tokens = REGION_GROUP_TOKENS[region.toUpperCase()];
  if (!tokens) return channels;
  const tokenRes = tokens.map((t) => new RegExp(`\\b${t}\\b`));
  return channels.filter((ch) => {
    const group = (ch.group ?? "").toUpperCase();
    if (!group) return false;
    return tokenRes.some((re) => re.test(group));
  });
}

export type ResolvedNetwork = {
  def: NetworkDef;
  channel: IptvChannel;
  logoUrl: string | null;
};

export function resolveNetworks(channels: IptvChannel[], defs: NetworkDef[]): ResolvedNetwork[] {
  const out: ResolvedNetwork[] = [];
  const claimed = new Set<string>();
  for (const def of defs) {
    let bestChannel: IptvChannel | null = null;
    let bestScore = -Infinity;
    for (const ch of channels) {
      if (claimed.has(ch.id)) continue;
      const haystack = `${ch.name} ${ch.group ?? ""}`;
      if (def.exclude && def.exclude.test(haystack)) continue;
      if (!def.match.test(haystack)) continue;
      const score = scoreChannel(ch, def);
      if (score > bestScore) {
        bestScore = score;
        bestChannel = ch;
      }
    }
    if (!bestChannel) continue;
    claimed.add(bestChannel.id);
    out.push({
      def,
      channel: bestChannel,
      logoUrl: bestChannel.logo,
    });
  }
  return out;
}

export function promoteTopChannelsToFront(
  channels: IptvChannel[],
  rows: NetworkRow[],
  candidates?: IptvChannel[],
): IptvChannel[] {
  if (rows.length === 0) return channels;
  const allDefs = rows.flatMap((r) => r.networks);
  const resolved = resolveNetworks(candidates ?? channels, allDefs);
  if (resolved.length === 0) return channels;
  const promotedIds = new Set(resolved.map((r) => r.channel.id));
  const rest = channels.filter((c) => !promotedIds.has(c.id));
  return [...resolved.map((r) => r.channel), ...rest];
}

function scoreChannel(ch: IptvChannel, def: NetworkDef): number {
  const name = ch.name;
  let score = 100;
  if (def.match.test(name)) score += 30;
  if (/\(/.test(name)) score -= 25;
  if (/\s[A-Z]{2}\s/.test(name)) score -= 12;
  if (/\b(HD|FHD|UHD|4K)\b/i.test(name)) score += 5;
  if (/east\s+coast|west\s+coast|east|west/i.test(name)) score += 3;
  if (/24\/7/i.test(name)) score -= 8;
  if (/\b(NEW YORK|NYC)\b/i.test(name)) score += 22;
  if (/\bNATIONAL\b/i.test(name)) score += 30;
  if (/\b(LOS ANGELES|LA)\b/i.test(name)) score += 12;
  if (/\blive\s+now\b/i.test(name)) score -= 30;
  if (/\b(raw|backup|feed|mirror|secondary)\b/i.test(name)) score -= 25;
  if (/\balt\b|\baltern/i.test(name)) score -= 20;
  if (/\bstream\s*\d+\b|\bs\d+\b/i.test(name)) score -= 15;
  if (/\b(test|tmp|temp)\b/i.test(name)) score -= 30;
  score -= name.length * 0.05;
  return score;
}
