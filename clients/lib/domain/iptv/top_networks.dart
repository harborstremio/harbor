import 'm3u.dart';

/// A named network matched against channel text. Ports the `NetworkDef` type of
/// `iptv/top-networks.ts`.
class NetworkDef {
  const NetworkDef({
    required this.id,
    required this.displayName,
    required this.match,
    this.exclude,
  });
  final String id;
  final String displayName;
  final RegExp match;
  final RegExp? exclude;
}

/// A titled row of networks (a "top networks" shelf). Ports `NetworkRow`.
class NetworkRow {
  const NetworkRow({
    required this.id,
    required this.title,
    required this.networks,
  });
  final String id;
  final String title;
  final List<NetworkDef> networks;
}

/// A network resolved to a concrete channel. Ports `ResolvedNetwork`.
class ResolvedNetwork {
  const ResolvedNetwork({
    required this.def,
    required this.channel,
    required this.logoUrl,
  });
  final NetworkDef def;
  final IptvChannel channel;
  final String? logoUrl;
}

// A whole-word boundary using non-alphanumerics (the web `word()` helper).
String _wordP(String s) => '(?:^|[^a-z0-9])$s(?:\$|[^a-z0-9])';

NetworkDef _def(String id, String name, String match, [String? exclude]) =>
    NetworkDef(
      id: id,
      displayName: name,
      match: RegExp(match, caseSensitive: false),
      exclude: exclude == null ? null : RegExp(exclude, caseSensitive: false),
    );

/// The US "top networks" shelves. Ports `US_NETWORK_ROWS`.
final List<NetworkRow> usNetworkRows = [
  NetworkRow(
    id: 'us-broadcast',
    title: 'Broadcast networks',
    networks: [
      _def('abc', 'ABC', _wordP('abc'), r'family|news\s|abcn\b|spark'),
      _def('cbs', 'CBS', _wordP('cbs'), r'sports|news\s|cbsn\b|justice'),
      _def('nbc', 'NBC', _wordP('nbc'), r'msnbc|cnbc|sports|news\s'),
      _def(
        'fox',
        'FOX',
        _wordP('fox'),
        r'fox\s+news|fox\s+sports|fox\s+business|news\s',
      ),
      _def('cw', 'The CW', r'\bcw\b', r'cwseed|news\s'),
      _def('pbs', 'PBS', r'\bpbs\b', r'kids|news\s'),
      _def('my-network', 'MyNetwork', r'mynetwork'),
      _def('telemundo', 'Telemundo', r'telemundo'),
      _def('univision', 'Univision', r'univision', r'tudn'),
      _def('estrella', 'Estrella TV', r'estrella'),
    ],
  ),
  NetworkRow(
    id: 'us-news',
    title: 'News',
    networks: [
      _def('cnn', 'CNN', r'\bcnn\b', r'cnn\s+espanol'),
      _def('fox-news', 'FOX News', r'fox\s+news'),
      _def('msnbc', 'MSNBC', r'msnbc'),
      _def('cnbc', 'CNBC', r'\bcnbc\b', r'world'),
      _def('fox-business', 'FOX Business', r'fox\s+business'),
      _def('newsmax', 'Newsmax', r'newsmax'),
      _def('oan', 'OAN', r'\boan\b|one\s+america\s+news'),
      _def('newsnation', 'NewsNation', r'newsnation'),
      _def('bbc-america', 'BBC America', r'bbc\s+america'),
      _def('bbc-world', 'BBC World', r'bbc\s+world'),
      _def('bloomberg', 'Bloomberg', r'bloomberg'),
      _def('weather', 'Weather Channel', r'weather\s+channel'),
      _def('c-span', 'C-SPAN', r'\bc[\s-]?span\b'),
    ],
  ),
  NetworkRow(
    id: 'us-sports',
    title: 'Sports',
    networks: [
      _def(
        'espn',
        'ESPN',
        r'\bespn\b',
        r'espn2|espnu|espn\s+news|espn\s+deportes|espn\+|espn\s+plus',
      ),
      _def('espn2', 'ESPN2', r'\bespn2\b'),
      _def('espn-u', 'ESPNU', r'\bespnu\b'),
      _def('espn-news', 'ESPN News', r'espn\s+news'),
      _def('espn-deportes', 'ESPN Deportes', r'espn\s+deportes'),
      _def('espn-plus', 'ESPN+', r'espn\+|espn\s+plus'),
      _def('fs1', 'FOX Sports 1', r'fox\s+sports\s+1|\bfs1\b'),
      _def('fs2', 'FOX Sports 2', r'fox\s+sports\s+2|\bfs2\b'),
      _def('nbc-sports', 'NBC Sports', r'nbc\s+sports'),
      _def('cbs-sports', 'CBS Sports', r'cbs\s+sports'),
      _def('nfl-network', 'NFL Network', r'\bnfl\s+network\b'),
      _def('nfl-redzone', 'NFL RedZone', r'redzone'),
      _def('nba-tv', 'NBA TV', r'\bnba\s+tv\b'),
      _def('mlb', 'MLB Network', r'\bmlb\s+network\b'),
      _def('nhl', 'NHL Network', r'\bnhl\s+network\b'),
      _def('tennis', 'Tennis Channel', r'tennis\s+channel'),
      _def('golf', 'Golf Channel', r'golf\s+channel'),
      _def('btn', 'Big Ten Network', r'big\s+ten\s+network|\bbtn\+?\b'),
      _def('sec', 'SEC Network', r'sec\s+network'),
      _def('acc', 'ACC Network', r'acc\s+network'),
      _def('olympic', 'Olympic Channel', r'olympic\s+channel'),
      _def('tudn', 'TUDN', r'\btudn\b'),
    ],
  ),
  NetworkRow(
    id: 'us-premium',
    title: 'Premium movies',
    networks: [
      _def('hbo', 'HBO', r'\bhbo\b', r'max|latino|hits'),
      _def('max', 'Max', r'hbo\s+max|\bmax\b', r'cinemax|maxim'),
      _def('showtime', 'Showtime', r'showtime'),
      _def('starz', 'Starz', r'starz', r'encore'),
      _def('cinemax', 'Cinemax', r'cinemax'),
      _def('epix', 'MGM+', r'\bepix\b|mgm\+|mgm\s+plus'),
      _def('paramount-plus', 'Paramount+', r'paramount\+|paramount\s+plus'),
      _def('peacock', 'Peacock', r'peacock'),
      _def('apple-tv-plus', 'Apple TV+', r'apple\s+tv\+|apple\s+tv\s+plus'),
      _def(
        'disney-plus',
        'Disney+',
        r'disney\+|disney\s+plus',
        r'channel|jr|xd',
      ),
      _def('netflix', 'Netflix', r'netflix'),
      _def('tcm', 'Turner Classic Movies', r'turner\s+classic|\btcm\b'),
    ],
  ),
  NetworkRow(
    id: 'us-entertainment',
    title: 'Entertainment',
    networks: [
      _def('amc', 'AMC', r'\bamc\b', r'\+|plus'),
      _def('fx', 'FX', r'\bfx\b', r'fxx|fxm|fox'),
      _def('fxx', 'FXX', r'\bfxx\b'),
      _def('fxm', 'FXM', r'\bfxm\b'),
      _def('usa', 'USA Network', r'usa\s+network'),
      _def('tnt', 'TNT', r'\btnt\b', r'sports'),
      _def('tbs', 'TBS', r'\btbs\b'),
      _def('bravo', 'Bravo', r'\bbravo\b'),
      _def('e', 'E!', r'\be!\s|^e!$|\be!\stv'),
      _def('syfy', 'SyFy', r'sy[\s-]?fy'),
      _def('comedy-central', 'Comedy Central', r'comedy\s+central'),
      _def('paramount-network', 'Paramount Network', r'paramount\s+network'),
      _def('ifc', 'IFC', r'\bifc\b'),
      _def('sundance', 'Sundance', r'sundance'),
      _def('pop-tv', 'Pop TV', r'\bpop\s+tv\b'),
      _def('we-tv', 'WE tv', r'\bwe\s+tv\b'),
      _def('ovation', 'Ovation', r'ovation'),
      _def('reelz', 'Reelz', r'reelz'),
    ],
  ),
  NetworkRow(
    id: 'us-lifestyle',
    title: 'Lifestyle & Reality',
    networks: [
      _def('hgtv', 'HGTV', r'\bhgtv\b'),
      _def('food', 'Food Network', r'food\s+network'),
      _def('tlc', 'TLC', r'\btlc\b'),
      _def('lifetime', 'Lifetime', r'\blifetime\b', r'movies'),
      _def('lifetime-movies', 'Lifetime Movies', r'lifetime\s+movies'),
      _def('own', 'OWN', r'\bown\b'),
      _def('ae', 'A&E', r'\ba[\s&]+e\b|a\s*&\s*e'),
      _def(
        'investigation',
        'Investigation Discovery',
        r'investigation\s+discovery|\bid\b\s+channel',
      ),
      _def('hallmark', 'Hallmark', r'hallmark', r'movies|drama'),
      _def('hallmark-movies', 'Hallmark Movies', r'hallmark\s+movies'),
      _def('diy', 'DIY', r'\bdiy\b'),
      _def('magnolia', 'Magnolia', r'magnolia'),
      _def('fyi', 'FYI', r'\bfyi\b'),
    ],
  ),
  NetworkRow(
    id: 'us-documentary',
    title: 'Documentary & Discovery',
    networks: [
      _def(
        'discovery',
        'Discovery',
        r'discovery',
        r'science|family|investigation|history',
      ),
      _def('history', 'History', r'\bhistory\b', r'military|vault'),
      _def('history2', 'History 2', r'history\s+2|h2\b'),
      _def(
        'natgeo',
        'Nat Geo',
        r'nat\s*geo|national\s+geographic',
        r'wild|mundo',
      ),
      _def('natgeo-wild', 'Nat Geo Wild', r'nat\s*geo\s+wild'),
      _def('smithsonian', 'Smithsonian', r'smithsonian'),
      _def('science', 'Science Channel', r'science\s+channel'),
      _def('animal-planet', 'Animal Planet', r'animal\s+planet'),
      _def('travel', 'Travel Channel', r'travel\s+channel'),
      _def('destination', 'Destination America', r'destination\s+america'),
      _def('motortrend', 'MotorTrend', r'motor\s*trend'),
    ],
  ),
  NetworkRow(
    id: 'us-kids',
    title: 'Kids & Family',
    networks: [
      _def('disney', 'Disney Channel', r'disney\s+channel'),
      _def('disney-jr', 'Disney Jr', r'disney\s+jr'),
      _def('disney-xd', 'Disney XD', r'disney\s+xd'),
      _def('nickelodeon', 'Nickelodeon', r'nickelodeon', r'jr|nicktoons'),
      _def('nick-jr', 'Nick Jr', r'nick\s+jr'),
      _def('nicktoons', 'Nicktoons', r'nicktoons'),
      _def('cartoon-network', 'Cartoon Network', r'cartoon\s+network'),
      _def('boomerang', 'Boomerang', r'boomerang'),
      _def('pbs-kids', 'PBS Kids', r'pbs\s+kids'),
      _def('universal-kids', 'Universal Kids', r'universal\s+kids'),
      _def('cartoonito', 'Cartoonito', r'cartoonito'),
      _def('baby-tv', 'Baby TV', r'baby\s*tv'),
    ],
  ),
  NetworkRow(
    id: 'us-music',
    title: 'Music',
    networks: [
      _def('mtv', 'MTV', r'\bmtv\b', r'mtv2|live|classic'),
      _def('mtv2', 'MTV2', r'\bmtv2\b'),
      _def('mtv-classic', 'MTV Classic', r'mtv\s+classic'),
      _def('mtv-live', 'MTV Live', r'mtv\s+live'),
      _def('vh1', 'VH1', r'\bvh1\b'),
      _def('bet', 'BET', r'\bbet\b', r'her'),
      _def('bet-her', 'BET Her', r'bet\s+her'),
      _def('cmt', 'CMT', r'\bcmt\b'),
      _def('revolt', 'Revolt', r'revolt'),
      _def('axs', 'AXS TV', r'\baxs\s+tv\b'),
    ],
  ),
];

/// The Brazil "top networks" shelves. Ports `BR_NETWORK_ROWS`.
final List<NetworkRow> brNetworkRows = [
  NetworkRow(
    id: 'br-broadcast',
    title: 'Rede aberta',
    networks: [
      _def('globo', 'Globo', r'\bglobo\b', r'news|esporte'),
      _def('globonews', 'GloboNews', r'globo\s*news'),
      _def('sbt', 'SBT', r'\bsbt\b'),
      _def('record', 'Record', r'\brecord\b', r'news'),
      _def('record-news', 'Record News', r'record\s+news'),
      _def('band', 'Band', r'\bband\b', r'sports|news'),
      _def('redetv', 'RedeTV!', r'redetv'),
      _def('cnn-brasil', 'CNN Brasil', r'cnn\s+brasil'),
    ],
  ),
  NetworkRow(
    id: 'br-sports',
    title: 'Esportes',
    networks: [
      _def('sportv', 'SporTV', r'sportv'),
      _def('espn-br', 'ESPN Brasil', r'espn\s+brasil'),
      _def('premiere', 'Premiere', r'premiere'),
      _def('combate', 'Combate', r'combate'),
      _def('esporte-interativo', 'Esporte Interativo', r'esporte\s+interativo'),
    ],
  ),
];

/// The UK "top networks" shelves. Ports `UK_NETWORK_ROWS`.
final List<NetworkRow> ukNetworkRows = [
  NetworkRow(
    id: 'uk-broadcast',
    title: 'Broadcast',
    networks: [
      _def('bbc-one', 'BBC One', r'bbc\s+one'),
      _def('bbc-two', 'BBC Two', r'bbc\s+two'),
      _def('bbc-three', 'BBC Three', r'bbc\s+three'),
      _def('bbc-four', 'BBC Four', r'bbc\s+four'),
      _def('itv', 'ITV', r'\bitv\b'),
      _def('channel-4', 'Channel 4', r'channel\s+4'),
      _def('channel-5', 'Channel 5', r'channel\s+5'),
      _def('sky-news', 'Sky News', r'sky\s+news'),
    ],
  ),
  NetworkRow(
    id: 'uk-sports',
    title: 'Sports',
    networks: [
      _def('sky-sports', 'Sky Sports', r'sky\s+sports'),
      _def('bt-sport', 'BT Sport', r'\bbt\s+sport\b'),
      _def('tnt-sports-uk', 'TNT Sports', r'tnt\s+sports'),
      _def('eurosport', 'Eurosport', r'eurosport'),
    ],
  ),
];

/// The network shelves for a region (US/BR/GB), or empty. Ports
/// `rowsForRegion`.
List<NetworkRow> rowsForRegion(String region) {
  final r = region.toUpperCase();
  if (r == 'US' || r == 'USA') return usNetworkRows;
  if (r == 'BR' || r == 'BRA') return brNetworkRows;
  if (r == 'GB' || r == 'UK') return ukNetworkRows;
  return const [];
}

const Map<String, List<String>> _regionGroupTokens = {
  'US': ['US', 'USA', 'AMERICAN'],
  'USA': ['US', 'USA', 'AMERICAN'],
  'BR': ['BR', 'BRA', 'BRASIL', 'BRAZIL'],
  'BRA': ['BR', 'BRA', 'BRASIL', 'BRAZIL'],
  'GB': ['UK', 'GB', 'BRITAIN', 'BRITISH', 'ENGLAND'],
  'UK': ['UK', 'GB', 'BRITAIN', 'BRITISH', 'ENGLAND'],
};

/// Filters channels to those whose group names a region token; a region with
/// no token table returns the channels unchanged. Ports
/// `filterChannelsByRegion`.
List<IptvChannel> filterChannelsByRegion(
  List<IptvChannel> channels,
  String region,
) {
  final tokens = _regionGroupTokens[region.toUpperCase()];
  if (tokens == null) return channels;
  final tokenRes = [for (final t in tokens) RegExp('\\b$t\\b')];
  return [
    for (final ch in channels)
      if (_regionMatch(ch, tokenRes)) ch,
  ];
}

bool _regionMatch(IptvChannel ch, List<RegExp> tokenRes) {
  final group = (ch.group ?? '').toUpperCase();
  if (group.isEmpty) return false;
  return tokenRes.any((re) => re.hasMatch(group));
}

/// Resolves each network definition to its single best-scoring, unclaimed
/// channel. Ports `resolveNetworks`.
List<ResolvedNetwork> resolveNetworks(
  List<IptvChannel> channels,
  List<NetworkDef> defs,
) {
  final out = <ResolvedNetwork>[];
  final claimed = <String>{};
  for (final def in defs) {
    IptvChannel? bestChannel;
    var bestScore = double.negativeInfinity;
    for (final ch in channels) {
      if (claimed.contains(ch.id)) continue;
      final haystack = '${ch.name} ${ch.group ?? ''}';
      if (def.exclude != null && def.exclude!.hasMatch(haystack)) continue;
      if (!def.match.hasMatch(haystack)) continue;
      final score = _scoreChannel(ch, def);
      if (score > bestScore) {
        bestScore = score;
        bestChannel = ch;
      }
    }
    if (bestChannel == null) continue;
    claimed.add(bestChannel.id);
    out.add(
      ResolvedNetwork(
        def: def,
        channel: bestChannel,
        logoUrl: bestChannel.logo,
      ),
    );
  }
  return out;
}

/// Moves the region's resolved top-network channels to the front, in row order.
/// Ports `promoteTopChannelsToFront`.
List<IptvChannel> promoteTopChannelsToFront(
  List<IptvChannel> channels,
  List<NetworkRow> rows, {
  List<IptvChannel>? candidates,
}) {
  if (rows.isEmpty) return channels;
  final allDefs = [for (final r in rows) ...r.networks];
  final resolved = resolveNetworks(candidates ?? channels, allDefs);
  if (resolved.isEmpty) return channels;
  final promotedIds = {for (final r in resolved) r.channel.id};
  final rest = [
    for (final c in channels)
      if (!promotedIds.contains(c.id)) c,
  ];
  return [for (final r in resolved) r.channel, ...rest];
}

final RegExp _scoreParen = RegExp(r'\(');
final RegExp _scoreAbbr = RegExp(r'\s[A-Z]{2}\s'); // case-sensitive
final RegExp _scoreHd = RegExp(r'\b(HD|FHD|UHD|4K)\b', caseSensitive: false);
final RegExp _scoreCoast = RegExp(
  r'east\s+coast|west\s+coast|east|west',
  caseSensitive: false,
);
final RegExp _score247 = RegExp(r'24/7', caseSensitive: false);
final RegExp _scoreNy = RegExp(r'\b(NEW YORK|NYC)\b', caseSensitive: false);
final RegExp _scoreNational = RegExp(r'\bNATIONAL\b', caseSensitive: false);
final RegExp _scoreLa = RegExp(r'\b(LOS ANGELES|LA)\b', caseSensitive: false);
final RegExp _scoreLiveNow = RegExp(r'\blive\s+now\b', caseSensitive: false);
final RegExp _scoreJunk = RegExp(
  r'\b(raw|backup|feed|mirror|secondary)\b',
  caseSensitive: false,
);
final RegExp _scoreAlt = RegExp(r'\balt\b|\baltern', caseSensitive: false);
final RegExp _scoreStreamNum = RegExp(
  r'\bstream\s*\d+\b|\bs\d+\b',
  caseSensitive: false,
);
final RegExp _scoreTest = RegExp(r'\b(test|tmp|temp)\b', caseSensitive: false);

double _scoreChannel(IptvChannel ch, NetworkDef def) {
  final name = ch.name;
  var score = 100.0;
  if (def.match.hasMatch(name)) score += 30;
  if (_scoreParen.hasMatch(name)) score -= 25;
  if (_scoreAbbr.hasMatch(name)) score -= 12;
  if (_scoreHd.hasMatch(name)) score += 5;
  if (_scoreCoast.hasMatch(name)) score += 3;
  if (_score247.hasMatch(name)) score -= 8;
  if (_scoreNy.hasMatch(name)) score += 22;
  if (_scoreNational.hasMatch(name)) score += 30;
  if (_scoreLa.hasMatch(name)) score += 12;
  if (_scoreLiveNow.hasMatch(name)) score -= 30;
  if (_scoreJunk.hasMatch(name)) score -= 25;
  if (_scoreAlt.hasMatch(name)) score -= 20;
  if (_scoreStreamNum.hasMatch(name)) score -= 15;
  if (_scoreTest.hasMatch(name)) score -= 30;
  score -= name.length * 0.05;
  return score;
}
