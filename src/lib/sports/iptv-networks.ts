export type Network = {
  id: string;
  label: string;
  re: RegExp;
  leagues: string[];
  groups: string[];
  region: string | null;
};

const net = (
  id: string,
  label: string,
  re: RegExp,
  leagues = "",
  groups = "",
  region: string | null = null,
): Network => ({
  id,
  label,
  re,
  leagues: leagues ? leagues.split(" ") : [],
  groups: groups ? groups.split(" ") : [],
  region,
});

export const NETWORKS: Network[] = [
  net("bein", "beIN Sports", /\bbein|\bbe in sport|بي ان/, "EPL UCL UEL UECL ESP ITA FRA GER KSA AFC WC GULF ACLE AFCON EURO CWC CDR COPPA DFB FAC EFLC", "soccer tennis motorsport", "ARABIC"),
  net("ssc", "SSC", /\bssc|saudi sport|السعوديه الرياضيه/, "KSA AFC GULF ACLE", "soccer", "SA"),
  net("thmanyah", "Thmanyah", /thmanyah|shahid/, "KSA AFC GULF ACLE", "soccer", "SA"),
  net("adsports", "AD Sports", /\bad sport|abu dhabi sport|ابوظبي الرياضيه/, "AFC GULF ACLE", "soccer", "AE"),
  net("dubaisports", "Dubai Sports", /dubai sport|دبي الرياضيه/, "AFC GULF ACLE", "soccer", "AE"),
  net("alkass", "Alkass", /alkass|al kass|الكاس/, "AFC GULF ACLE", "soccer", "QA"),
  net("ontime", "OnTime Sports", /on ?time sport|اون تايم/, "", "soccer", "EG"),
  net("arryadia", "Arryadia", /arryadia|arriadia/, "", "soccer", "MA"),
  net("sky", "Sky Sports", /sky sport/, "EPL UCL F1 NFL ITA GER EFLC EFL1 EFL2 EFLCUP SCO", "soccer motorsport", "GB"),
  net("tntuk", "TNT Sports", /tnt sport/, "UCL UEL UECL EPL RWC", "soccer rugby", "GB"),
  net("premiersports", "Premier Sports", /premier sport/, "UCL", "soccer", "GB"),
  net("itv", "ITV", /\bitv ?[1-4]?\b/, "WC EPL FAC EURO WCQE", "soccer", "GB"),
  net("bbcsport", "BBC Sport", /bbc sport|bbc one|bbc two/, "WC EPL FAC EURO WCQE", "soccer", "GB"),
  net("canalplus", "Canal Plus", /canal ?\+|canal plus/, "FRA UCL TOP14", "soccer", "FR"),
  net("dazn", "DAZN", /\bdazn/, "ITA ESP GER UFC CWC", "soccer combat", null),
  net("movistar", "Movistar", /movistar|laliga ?tv|m ?\+ ?liga/, "ESP UCL CDR", "soccer", "ES"),
  net("sporttv", "Sport TV", /sport ?tv ?[1-6]?\b/, "POR", "soccer", "PT"),
  net("ziggo", "Ziggo Sport", /ziggo/, "NED UCL F1", "soccer motorsport", "NL"),
  net("viaplay", "Viaplay", /viaplay/, "EPL NHL F1", "soccer hockey", "NORDIC"),
  net("arenasport", "Arena Sport", /arena sport|sport ?klub/, "EPL ESP ITA", "soccer", "EXYU"),
  net("matchtv", "Match TV", /match ?(tv|premier|futbol)/, "UCL", "soccer", "RU"),
  net("polsat", "Polsat Sport", /polsat sport/, "ESP", "soccer", "PL"),
  net("digisport", "Digi Sport", /digi ?sport/, "EPL ESP", "soccer", "RO"),
  net("espn", "ESPN", /\bespn/, "NBA NFL MLB NHL NCAA NCAAF UFC ATP WTA MLS ESP ITA GER BRA ARG LIB SUD NWSL WNBA CWC", "soccer basketball football baseball hockey combat tennis", "US"),
  net("foxsports", "FOX Sports", /fox sport|\bfs ?[12]\b|fox footy/, "MLS NFL MLB NASCAR WC MEX ARG BRA LIB CWC", "soccer football baseball motorsport", "US"),
  net("cbssports", "CBS Sports", /cbs sport|golazo|paramount/, "UCL UEL UECL NFL NCAA ITA", "soccer football", "US"),
  net("nbcsports", "NBC Sports", /nbc sport|usa network|peacock/, "EPL NFL NHL PGA", "soccer football hockey golf", "US"),
  net("tntus", "TNT", /\btnt\b/, "NBA NHL NCAA", "basketball hockey", "US"),
  net("tbs", "TBS", /\btbs\b|trutv/, "NBA NCAA MLB", "basketball baseball", "US"),
  net("nflnet", "NFL Network", /nfl ?(network|redzone)|red ?zone/, "NFL", "football", "US"),
  net("nbatv", "NBA TV", /nba ?tv/, "NBA", "basketball", "US"),
  net("mlbnet", "MLB Network", /mlb ?(network|extra)/, "MLB", "baseball", "US"),
  net("nhlnet", "NHL Network", /nhl ?network/, "NHL", "hockey", "US"),
  net("tennischannel", "Tennis Channel", /tennis ?channel/, "ATP WTA", "tennis", "US"),
  net("golfchannel", "Golf Channel", /golf ?channel|golf ?tv/, "PGA", "golf", "US"),
  net("collegenets", "College Sports", /sec ?network|acc ?network|big ?ten|\bbtn\b|pac ?12/, "NCAA NCAAF", "basketball football", "US"),
  net("appletv", "Apple TV", /mls ?season ?pass|apple ?tv/, "MLS", "soccer", "US"),
  net("tudn", "TUDN", /\btudn|univision/, "MEX MLS WC CWC GOLD", "soccer", "MX"),
  net("claro", "Claro Sports", /claro ?sport/, "MEX ARG LIB SUD", "soccer", "LATINO"),
  net("premiere", "Premiere", /\bpremiere\b/, "BRA CDB LIB SUD", "soccer", "BR"),
  net("sportv", "SporTV", /sportv|\bglobo\b|band ?sport/, "BRA CDB LIB SUD", "soccer", "BR"),
  net("supersport", "SuperSport", /super ?sport/, "EPL ESP ITA UCL CAFCL CAFCC AFCON", "soccer", "ZA"),
  net("starsports", "Star Sports", /star ?sport|sony ?(ten|six)|jio ?(star|cinema)/, "EPL UCL IPL WTC", "soccer cricket", "IN"),
  net("willow", "Willow", /\bwillow\b/, "IPL WTC BBL", "cricket", "IN"),
  net("optus", "Optus Sport", /optus ?sport|stan ?sport|\bkayo\b/, "EPL UCL BBL AFL", "soccer cricket aussie", "AU"),
  net("jsports", "J Sports", /\bj ?sport/, "JPN", "soccer", "JP"),
  net("spotv", "SPOTV", /spotv/, "EPL ESP", "soccer", "KR"),
  net("astro", "Astro", /astro ?(supersport|arena)|\bunifi\b/, "EPL", "soccer", "MY"),
  net("truesport", "True Sport", /true ?sport/, "EPL", "soccer", "TH"),
  net("cctv5", "CCTV5", /cctv ?5|\bmigu\b/, "UCL", "soccer", "CN"),
  net("f1tv", "F1 TV", /f1 ?tv|formula ?1|formula ?one/, "F1", "motorsport", null),
  net("ufcfightpass", "UFC", /\bufc/, "UFC", "combat", null),
];

export const NET_BY_ID = new Map(NETWORKS.map((n) => [n.id, n] as const));

export const LEAGUE_ALIASES: Record<string, string> = {
  EPL: "premier league|epl|prem|barclays",
  EFLC: "championship|efl championship|efl",
  UCL: "champions league|ucl|uefa champions",
  EURO: "euro|uefa euro",
  UEL: "europa league|uel",
  UECL: "conference league|uecl",
  ESP: "la liga|laliga|liga santander|primera",
  CDR: "copa del rey",
  ITA: "serie a|calcio",
  COPPA: "coppa italia",
  GER: "bundesliga",
  DFB: "dfb pokal|pokal",
  FRA: "ligue 1|ligue1",
  KSA: "roshn|saudi league|saudi pro",
  GULF: "gulf cup|khaleeji|arabian gulf",
  MLS: "major league soccer|mls",
  AFC: "asian cup|afc",
  ACLE: "afc champions|champions league elite",
  WC: "world cup|mondial|fifa",
  CWC: "club world cup|mundial de clubes",
  NBA: "nba|basketball",
  WNBA: "wnba",
  NFL: "nfl|football",
  NWSL: "nwsl",
  MLB: "mlb|baseball",
  IPL: "ipl|indian premier league",
  NHL: "nhl|hockey",
  BBL: "big bash",
  UFC: "ufc|mma",
  WTC: "world test championship",
  F1: "formula 1|formula one|f1|grand prix",
  URC: "united rugby|urc",
  ATP: "atp|tennis",
  SCO: "scottish premiership|spfl",
  WTA: "wta|tennis",
  TUR: "super lig",
  PGA: "pga|golf",
  FAC: "fa cup",
  BRA: "brasileirao|brasileiro|serie a brasil",
  CDB: "copa do brasil",
  MEX: "liga mx|liga bbva",
  LIB: "libertadores|copa libertadores",
  JPN: "j league|j1 league",
  SUD: "sudamericana|copa sudamericana",
  NED: "eredivisie",
  CAFCL: "caf champions|african champions",
  POR: "primeira liga|liga portugal",
  AFCON: "afcon|africa cup of nations",
};

export const PATH_REGION: Record<string, string> = {
  eng: "GB", sco: "GB", wal: "GB", esp: "ES", ita: "IT", ger: "DE", fra: "FR", ned: "NL",
  por: "PT", ksa: "SA", uae: "AE", qat: "QA", egy: "EG", rsa: "ZA", usa: "US", mex: "MX",
  bra: "BR", arg: "AR", col: "CO", chi: "CL", per: "PE", ven: "VE", jpn: "JP", kor: "KR",
  chn: "CN", ind: "IN", aus: "AU", tur: "TR", gre: "GR", bel: "BE", aut: "AT", swe: "SE",
  den: "DK", nor: "NO", rus: "RU", pol: "PL", sui: "CH", conmebol: "LATINO",
  concacaf: "LATINO", caf: "AFRICA", global: "ARABIC", nba: "US", nfl: "US", mlb: "US", nhl: "US", wnba: "US",
  ufc: "US", pga: "US",
};

export const BLOC: Record<string, string> = {
  SA: "ARABIC", AE: "ARABIC", QA: "ARABIC", EG: "ARABIC", MA: "ARABIC", DZ: "ARABIC",
  BR: "LATINO", MX: "LATINO", AR: "LATINO", CO: "LATINO", CL: "LATINO", PE: "LATINO",
  VE: "LATINO", SE: "NORDIC", NO: "NORDIC", DK: "NORDIC", FI: "NORDIC", RS: "EXYU",
  HR: "EXYU", ZA: "AFRICA", NG: "AFRICA",
};

export const NEUTRAL_PREFIX = new Set([
  "en", "eng", "int", "intl", "world", "global", "sport", "sports", "event", "events",
  "ppv", "live", "vip", "tv", "channel", "backup", "extra",
]);

export const COMMON_TEAM_WORDS = new Set([
  "united", "city", "real", "sport", "sports", "sporting", "athletic", "atletico",
  "national", "america", "racing", "rangers", "county", "town", "olympic", "wanderers",
  "rovers", "albion", "state", "eagles", "lions", "tigers", "giants", "kings", "sharks",
]);

export const TEAM_STOP = new Set([
  "club", "futbol", "football", "soccer", "calcio", "deportivo", "team", "women",
  "womens", "reserves", "under", "academy", "sports",
]);

export const SPORTY_RE = /sport|deporte|calcio|futbol|football|soccer|tennis|golf|racing|fight|boxing|cricket|rugby|hockey|basket|baseball|bein|espn|dazn|\bnba\b|\bnfl\b|\bmlb\b|\bnhl\b|\bufc\b|\bppv\b|\bevent|رياض|دوري|مباراه|كوره|كاس|بي ان/;
export const JUNK_RE = /\b24 ?7\b|\bs\d{1,3} ?e\d{1,3}\b|\bradio\b|\bvod\b|\bseries\b|\bmovies?\b/;
export const QUALITY_RE = /\b(?:fhd|uhd|hevc|h ?26[45]|10 ?bit|1080[pi]?|720[pi]?|576[pi]?|480[pi]?|4k|hd|sd|raw|alt|alternate|backup|vip|multi|feed|source|mono|stereo|dual)\b/g;
export const RAW_QUALITY_RE = /\b(?:FHD|UHD|HEVC|H\.?26[45]|1080[pi]?|720[pi]?|576[pi]?|480[pi]?|4K|HD|SD|RAW|VIP|MULTI|BACKUP)\b/gi;
export const MARKS_RE = /[\u0300-\u036f]/g;
export const FLAG_RE = /^(?:[\u{1F1E6}-\u{1F1FF}]{2}\s*)+/u;
export const BRACKET_PREFIX = /^\s*[[({]\s*([\p{L}]{2,9})\s*[\])}]\s*/u;
export const SEP_PREFIX = /^\s*([\p{L}]{2,9})\s*[:|>\-\u2022\u25b6\u00bb\u2013\u2014]+\s*/u;
export const LABEL_SEP_RE = /[|_\u2013\u2014]+/g;
