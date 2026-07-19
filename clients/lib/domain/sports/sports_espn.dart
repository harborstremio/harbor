/// The ESPN sports catalog and game model, ported from `lib/sports/espn.ts`.
/// This is the foundation the live-TV sports rail and the match-detail view are
/// built on: the league table, the game/side shapes, and the pure ordering the
/// scoreboard is presented in. The network fetchers land on top of this.
library;

/// One team or athlete in a game — a name, crest, and its current score.
class SportsSide {
  const SportsSide({
    required this.name,
    required this.abbr,
    required this.logo,
    required this.score,
    required this.winner,
  });

  final String name;
  final String abbr;
  final String logo;
  final String score;
  final bool winner;

  Map<String, dynamic> toJson() => {
    'name': name,
    'abbr': abbr,
    'logo': logo,
    'score': score,
    'winner': winner,
  };

  factory SportsSide.fromJson(Map<String, dynamic> j) => SportsSide(
    name: j['name'] as String? ?? '',
    abbr: j['abbr'] as String? ?? '',
    logo: j['logo'] as String? ?? '',
    score: j['score'] as String? ?? '',
    winner: j['winner'] == true,
  );
}

/// A game's lifecycle: not started, in progress, or finished. The wire values
/// are ESPN's `pre` / `in` / `post`.
enum SportsState {
  pre('pre'),
  live('in'),
  post('post');

  const SportsState(this.wire);

  final String wire;

  static SportsState fromWire(String value) => switch (value) {
    'in' => SportsState.live,
    'post' => SportsState.post,
    _ => SportsState.pre,
  };
}

/// A single scoreboard game — the two sides, its state, and kickoff time.
class SportsGame {
  const SportsGame({
    required this.id,
    required this.league,
    required this.state,
    required this.detail,
    required this.home,
    required this.away,
    required this.startMs,
  });

  final String id;
  final String league;
  final SportsState state;
  final String detail;
  final SportsSide home;
  final SportsSide away;
  final int startMs;

  /// A JSON-encodable form so a game can ride in a navigation frame's args
  /// (the frame stack is persisted as JSON).
  Map<String, dynamic> toJson() => {
    'id': id,
    'league': league,
    'state': state.wire,
    'detail': detail,
    'home': home.toJson(),
    'away': away.toJson(),
    'startMs': startMs,
  };

  factory SportsGame.fromJson(Map<String, dynamic> j) => SportsGame(
    id: j['id'] as String? ?? '',
    league: j['league'] as String? ?? '',
    state: SportsState.fromWire(j['state'] as String? ?? 'pre'),
    detail: j['detail'] as String? ?? '',
    home: SportsSide.fromJson((j['home'] as Map).cast<String, dynamic>()),
    away: SportsSide.fromJson((j['away'] as Map).cast<String, dynamic>()),
    startMs: (j['startMs'] as num?)?.toInt() ?? 0,
  );
}

/// A league's identity and its ESPN scoreboard path.
class LeagueDef {
  const LeagueDef({
    required this.key,
    required this.label,
    required this.labelEn,
    required this.tag,
    required this.path,
    required this.logo,
    required this.group,
  });

  final String key;
  final String label;
  final String labelEn;
  final String tag;
  final String path;
  final String logo;
  final String group;
}

/// A sport grouping (soccer, basketball, …) with its glyph.
class LeagueGroup {
  const LeagueGroup({
    required this.key,
    required this.label,
    required this.labelEn,
    required this.icon,
  });

  final String key;
  final String label;
  final String labelEn;
  final String icon;
}

const _tl = 'https://a.espncdn.com/i/teamlogos/leagues/500';
const _ll = 'https://a.espncdn.com/i/leaguelogos/soccer/500';

/// The full ESPN league table, ported 1:1 from `LEAGUES`.
const List<LeagueDef> kLeagues = [
  // Soccer
  LeagueDef(
    key: 'ROSHN',
    label: 'الدوري السعودي',
    labelEn: 'Saudi Pro League',
    tag: 'KSA',
    path: 'soccer/ksa.1',
    logo: '$_ll/2488.png',
    group: 'soccer',
  ),
  LeagueDef(
    key: 'EPL',
    label: 'الدوري الإنجليزي',
    labelEn: 'Premier League',
    tag: 'EPL',
    path: 'soccer/eng.1',
    logo: '$_ll/23.png',
    group: 'soccer',
  ),
  LeagueDef(
    key: 'UCL',
    label: 'دوري الأبطال',
    labelEn: 'Champions League',
    tag: 'UCL',
    path: 'soccer/uefa.champions',
    logo: '$_ll/2.png',
    group: 'soccer',
  ),
  LeagueDef(
    key: 'LALIGA',
    label: 'الدوري الإسباني',
    labelEn: 'La Liga',
    tag: 'ESP',
    path: 'soccer/esp.1',
    logo: '$_ll/15.png',
    group: 'soccer',
  ),
  LeagueDef(
    key: 'SERIEA',
    label: 'الدوري الإيطالي',
    labelEn: 'Serie A',
    tag: 'ITA',
    path: 'soccer/ita.1',
    logo: '$_ll/12.png',
    group: 'soccer',
  ),
  LeagueDef(
    key: 'BUNDESLIGA',
    label: 'الدوري الألماني',
    labelEn: 'Bundesliga',
    tag: 'GER',
    path: 'soccer/ger.1',
    logo: '$_ll/10.png',
    group: 'soccer',
  ),
  LeagueDef(
    key: 'LIGUE1',
    label: 'الدوري الفرنسي',
    labelEn: 'Ligue 1',
    tag: 'FRA',
    path: 'soccer/fra.1',
    logo: '$_ll/9.png',
    group: 'soccer',
  ),
  LeagueDef(
    key: 'MLS',
    label: 'دوري MLS',
    labelEn: 'MLS',
    tag: 'MLS',
    path: 'soccer/usa.1',
    logo: '$_ll/19.png',
    group: 'soccer',
  ),
  LeagueDef(
    key: 'UEL',
    label: 'الدوري الأوروبي',
    labelEn: 'Europa League',
    tag: 'UEL',
    path: 'soccer/uefa.europa',
    logo: '$_ll/2310.png',
    group: 'soccer',
  ),
  LeagueDef(
    key: 'UECLUE',
    label: 'دوري المؤتمر',
    labelEn: 'Conference League',
    tag: 'UECL',
    path: 'soccer/uefa.europa.conf',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png',
    group: 'soccer',
  ),
  LeagueDef(
    key: 'WORLDCUP',
    label: 'كأس العالم',
    labelEn: 'World Cup',
    tag: 'WC',
    path: 'soccer/fifa.world',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/4.png',
    group: 'soccer',
  ),
  LeagueDef(
    key: 'ARABIANGCC',
    label: 'كأس آسيا / الخليج',
    labelEn: 'AFC Asian Cup',
    tag: 'AFC',
    path: 'soccer/afc.asian.cup',
    logo:
        'https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/2243.png',
    group: 'soccer',
  ),
  // Basketball
  LeagueDef(
    key: 'NBA',
    label: 'NBA',
    labelEn: 'NBA',
    tag: 'NBA',
    path: 'basketball/nba',
    logo: '$_tl/nba.png',
    group: 'basketball',
  ),
  LeagueDef(
    key: 'NCAAB',
    label: 'NCAA كرة السلة',
    labelEn: 'NCAA Basketball',
    tag: 'NCAA',
    path: 'basketball/mens-college-basketball',
    logo: '$_tl/ncaa.png',
    group: 'basketball',
  ),
  // American football
  LeagueDef(
    key: 'NFL',
    label: 'NFL',
    labelEn: 'NFL',
    tag: 'NFL',
    path: 'football/nfl',
    logo: '$_tl/nfl.png',
    group: 'football',
  ),
  LeagueDef(
    key: 'NCAAF',
    label: 'NCAA أمريكية',
    labelEn: 'NCAA Football',
    tag: 'NCAAF',
    path: 'football/college-football',
    logo: '$_tl/ncaa.png',
    group: 'football',
  ),
  // Baseball
  LeagueDef(
    key: 'MLB',
    label: 'MLB',
    labelEn: 'MLB',
    tag: 'MLB',
    path: 'baseball/mlb',
    logo: '$_tl/mlb.png',
    group: 'baseball',
  ),
  // Hockey
  LeagueDef(
    key: 'NHL',
    label: 'NHL',
    labelEn: 'NHL',
    tag: 'NHL',
    path: 'hockey/nhl',
    logo: '$_tl/nhl.png',
    group: 'hockey',
  ),
  // Combat
  LeagueDef(
    key: 'UFC',
    label: 'UFC / MMA',
    labelEn: 'UFC / MMA',
    tag: 'UFC',
    path: 'mma/ufc',
    logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/ufc.png',
    group: 'combat',
  ),
  // Motorsport
  LeagueDef(
    key: 'F1',
    label: 'فورمولا 1',
    labelEn: 'Formula 1',
    tag: 'F1',
    path: 'racing/f1',
    logo:
        'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/f1.png',
    group: 'motorsport',
  ),
  LeagueDef(
    key: 'NASCAR',
    label: 'NASCAR',
    labelEn: 'NASCAR',
    tag: 'NASCAR',
    path: 'racing/nascar-premier',
    logo:
        'https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-NASCAR.png',
    group: 'motorsport',
  ),
  // Tennis
  LeagueDef(
    key: 'TENNIS',
    label: 'التنس (ATP/WTA)',
    labelEn: 'Tennis (ATP/WTA)',
    tag: 'ATP',
    path: 'tennis/atp',
    logo:
        'https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-tennis.png',
    group: 'tennis',
  ),
  // Golf
  LeagueDef(
    key: 'PGA',
    label: 'بطولة PGA',
    labelEn: 'PGA Tour',
    tag: 'PGA',
    path: 'golf/pga',
    logo: 'https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-golf.png',
    group: 'golf',
  ),
  // Rugby
  LeagueDef(
    key: 'RUGBY',
    label: 'كأس العالم للرغبي',
    labelEn: 'Rugby World Cup',
    tag: 'RWC',
    path: 'rugby/164205',
    logo: 'https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-rugby.png',
    group: 'rugby',
  ),
];

final Map<String, LeagueDef> _byKey = {for (final l in kLeagues) l.key: l};

/// The league with this [key], or null when unknown.
LeagueDef? leagueByKey(String key) => _byKey[key];

/// The league whose ESPN [tag] matches, or null. Used to resolve a game's
/// league back to its definition (the match summary keys off the tag).
LeagueDef? leagueByTag(String tag) {
  for (final l in kLeagues) {
    if (l.tag == tag) return l;
  }
  return null;
}

/// The leagues shown by default before the user customizes their sports rail.
const List<String> kDefaultSportsLeagues = [
  'ROSHN',
  'EPL',
  'UCL',
  'NBA',
  'NFL',
];

/// The sport groupings, ported 1:1 from `LEAGUE_GROUPS`.
const List<LeagueGroup> kLeagueGroups = [
  LeagueGroup(key: 'soccer', label: 'كرة القدم', labelEn: 'Soccer', icon: '⚽'),
  LeagueGroup(
    key: 'basketball',
    label: 'كرة السلة',
    labelEn: 'Basketball',
    icon: '🏀',
  ),
  LeagueGroup(
    key: 'football',
    label: 'الأمريكية',
    labelEn: 'Football',
    icon: '🏈',
  ),
  LeagueGroup(
    key: 'baseball',
    label: 'البيسبول',
    labelEn: 'Baseball',
    icon: '⚾',
  ),
  LeagueGroup(key: 'hockey', label: 'الهوكي', labelEn: 'Hockey', icon: '🏒'),
  LeagueGroup(
    key: 'combat',
    label: 'فنون قتالية',
    labelEn: 'Combat',
    icon: '🥊',
  ),
  LeagueGroup(
    key: 'motorsport',
    label: 'السباقات',
    labelEn: 'Motorsport',
    icon: '🏎',
  ),
  LeagueGroup(key: 'tennis', label: 'التنس', labelEn: 'Tennis', icon: '🎾'),
  LeagueGroup(key: 'golf', label: 'الغولف', labelEn: 'Golf', icon: '🏌'),
  LeagueGroup(key: 'rugby', label: 'الرغبي', labelEn: 'Rugby', icon: '🏉'),
];

/// The league's display label. Ported from `getLeagueLabel`; clientv2 is
/// English-only for now, so the English name is used (the Arabic [label] rides
/// along for when localization lands).
String getLeagueLabel(LeagueDef league) => league.labelEn;

/// The group's display label. Ported from `getGroupLabel`.
String getGroupLabel(LeagueGroup group) => group.labelEn;

int _rank(SportsState s) => switch (s) {
  SportsState.live => 0,
  SportsState.pre => 1,
  SportsState.post => 2,
};

/// Orders the scoreboard: live games first, then upcoming, then finished.
/// Within a state, upcoming/live sort by soonest kickoff and finished by most
/// recent. Ported 1:1 from `sortGames`.
List<SportsGame> sortGames(List<SportsGame> games) {
  final out = List<SportsGame>.of(games);
  out.sort((a, b) {
    final r = _rank(a.state) - _rank(b.state);
    if (r != 0) return r;
    return a.state == SportsState.post
        ? b.startMs - a.startMs
        : a.startMs - b.startMs;
  });
  return out;
}

/// How many of [games] are in progress. Ported 1:1 from `liveCount`.
int liveCount(List<SportsGame> games) =>
    games.where((g) => g.state == SportsState.live).length;
