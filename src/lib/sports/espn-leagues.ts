import { getUiLanguage } from "@/lib/i18n/store";
import { EXTRA_LEAGUES, EXTRA_LEAGUE_GROUPS } from "./leagues-extra";
import type { LeagueDef, LeagueGroupDef } from "./espn-types";

export const SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports";

function pickLabel(item: { label: string; labelEn: string; labelRu?: string }): string {
  const lang = getUiLanguage();
  if (lang === "ar") return item.label;
  if (lang === "ru" && item.labelRu) return item.labelRu;
  return item.labelEn;
}

export function getLeagueLabel(league: LeagueDef): string {
  return pickLabel(league);
}

export function getGroupLabel(group: { label: string; labelEn: string; labelRu?: string }): string {
  return pickLabel(group);
}

const TL = "https://a.espncdn.com/i/teamlogos/leagues/500";
const LL = "https://a.espncdn.com/i/leaguelogos/soccer/500";
export const LEAGUES: LeagueDef[] = [
  { key: "ROSHN", label: "الدوري السعودي", labelEn: "Saudi Pro League", labelRu: "Саудовская Про-лига", tag: "KSA", path: "soccer/ksa.1", logo: `${LL}/2488.png`, group: "soccer" },
  { key: "EPL", label: "الدوري الإنجليزي", labelEn: "Premier League", labelRu: "АПЛ", tag: "EPL", path: "soccer/eng.1", logo: `${LL}/23.png`, group: "soccer" },
  { key: "UCL", label: "دوري الأبطال", labelEn: "Champions League", labelRu: "Лига чемпионов", tag: "UCL", path: "soccer/uefa.champions", logo: `${LL}/2.png`, group: "soccer" },
  { key: "LALIGA", label: "الدوري الإسباني", labelEn: "La Liga", labelRu: "Ла Лига", tag: "ESP", path: "soccer/esp.1", logo: `${LL}/15.png`, group: "soccer" },
  { key: "SERIEA", label: "الدوري الإيطالي", labelEn: "Serie A", labelRu: "Серия А", tag: "ITA", path: "soccer/ita.1", logo: `${LL}/12.png`, group: "soccer" },
  { key: "BUNDESLIGA", label: "الدوري الألماني", labelEn: "Bundesliga", labelRu: "Бундеслига", tag: "GER", path: "soccer/ger.1", logo: `${LL}/10.png`, group: "soccer" },
  { key: "LIGUE1", label: "الدوري الفرنسي", labelEn: "Ligue 1", labelRu: "Лига 1", tag: "FRA", path: "soccer/fra.1", logo: `${LL}/9.png`, group: "soccer" },
  { key: "MLS", label: "دوري MLS", labelEn: "MLS", labelRu: "MLS", tag: "MLS", path: "soccer/usa.1", logo: `${LL}/19.png`, group: "soccer" },
  { key: "UEL", label: "الدوري الأوروبي", labelEn: "Europa League", labelRu: "Лига Европы", tag: "UEL", path: "soccer/uefa.europa", logo: `${LL}/2310.png`, group: "soccer" },
  { key: "UECLUE", label: "دوري المؤتمر", labelEn: "Conference League", labelRu: "Лига конференций", tag: "UECL", path: "soccer/uefa.europa.conf", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png", group: "soccer" },
  { key: "WORLDCUP", label: "كأس العالم", labelEn: "World Cup", labelRu: "Чемпионат мира", tag: "WC", path: "soccer/fifa.world", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png", group: "soccer" },
  { key: "ARABIANGCC", label: "كأس آسيا / الخليج", labelEn: "AFC Asian Cup", labelRu: "Кубок Азии", tag: "AFC", path: "soccer/afc.asian.cup", logo: "https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/2243.png", group: "soccer" },

  { key: "NBA", label: "NBA", labelEn: "NBA", labelRu: "НБА", tag: "NBA", path: "basketball/nba", logo: `${TL}/nba.png`, group: "basketball" },
  { key: "NCAAB", label: "NCAA كرة السلة", labelEn: "NCAA Basketball", labelRu: "NCAA баскетбол", tag: "NCAA", path: "basketball/mens-college-basketball", logo: `${TL}/ncaa.png`, group: "basketball" },

  { key: "NFL", label: "NFL", labelEn: "NFL", labelRu: "НФЛ", tag: "NFL", path: "football/nfl", logo: `${TL}/nfl.png`, group: "football" },
  { key: "NCAAF", label: "NCAA أمريكية", labelEn: "NCAA Football", labelRu: "NCAA футбол", tag: "NCAAF", path: "football/college-football", logo: `${TL}/ncaa.png`, group: "football" },

  { key: "MLB", label: "MLB", labelEn: "MLB", labelRu: "МЛБ", tag: "MLB", path: "baseball/mlb", logo: `${TL}/mlb.png`, group: "baseball" },

  { key: "NHL", label: "NHL", labelEn: "NHL", labelRu: "НХЛ", tag: "NHL", path: "hockey/nhl", logo: `${TL}/nhl.png`, group: "hockey" },

  { key: "UFC", label: "UFC / MMA", labelEn: "UFC / MMA", labelRu: "UFC / MMA", tag: "UFC", path: "mma/ufc", logo: "https://a.espncdn.com/i/teamlogos/leagues/500/ufc.png", group: "combat" },

  { key: "F1", label: "فورمولا 1", labelEn: "Formula 1", labelRu: "Формула-1", tag: "F1", path: "racing/f1", logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/f1.png", group: "motorsport" },
  { key: "NASCAR", label: "NASCAR", labelEn: "NASCAR", labelRu: "NASCAR", tag: "NASCAR", path: "racing/nascar-premier", logo: "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-NASCAR.png", group: "motorsport" },

  { key: "TENNIS", label: "التنس (ATP)", labelEn: "Tennis (ATP)", labelRu: "Теннис (ATP)", tag: "ATP", path: "tennis/atp", logo: "https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-tennis.png", group: "tennis" },
  { key: "TENNIS_WTA", label: "التنس (WTA)", labelEn: "Tennis (WTA)", labelRu: "Теннис (WTA)", tag: "WTA", path: "tennis/wta", logo: "https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-tennis.png", group: "tennis" },

  { key: "PGA", label: "بطولة PGA", labelEn: "PGA Tour", labelRu: "PGA Tour", tag: "PGA", path: "golf/pga", logo: "https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-golf.png", group: "golf" },

  { key: "RUGBY", label: "كأس العالم للرغبي", labelEn: "Rugby World Cup", labelRu: "Кубок мира по регби", tag: "RWC", path: "rugby/164205", logo: "https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-rugby.png",group: "rugby" },

  ...EXTRA_LEAGUES,
];
const BY_KEY = new Map(LEAGUES.map((l) => [l.key, l] as const));
export const DEFAULT_SPORTS_LEAGUES = ["ROSHN", "EPL", "UCL", "NBA", "NFL"];

export const LEAGUE_GROUPS: LeagueGroupDef[] = [
  { key: "soccer", label: "كرة القدم", labelEn: "Soccer", labelRu: "Футбол", icon: "⚽" },
  { key: "basketball", label: "كرة السلة", labelEn: "Basketball", labelRu: "Баскетбол", icon: "🏀" },
  { key: "football", label: "الأمريكية", labelEn: "Football", labelRu: "Американский футбол", icon: "🏈" },
  { key: "baseball", label: "البيسبول", labelEn: "Baseball", labelRu: "Бейсбол", icon: "⚾" },
  { key: "hockey", label: "الهوكي", labelEn: "Hockey", labelRu: "Хоккей", icon: "🏒" },
  { key: "combat", label: "فنون قتالية", labelEn: "Combat", labelRu: "Единоборства", icon: "🥊" },
  { key: "motorsport", label: "السباقات", labelEn: "Motorsport", labelRu: "Автоспорт", icon: "🏎" },
  { key: "tennis", label: "التنس", labelEn: "Tennis", labelRu: "Теннис", icon: "🎾" },
  { key: "golf", label: "الغولف", labelEn: "Golf", labelRu: "Гольф", icon: "🏌" },
  { key: "rugby", label: "الرغبي", labelEn: "Rugby", labelRu: "Регби", icon: "🏉" },
  ...EXTRA_LEAGUE_GROUPS,
];

export function leagueByKey(key: string): LeagueDef | undefined {
  return BY_KEY.get(key);
}

export function leagueByTag(tag: string): LeagueDef | undefined {
  return LEAGUES.find((l) => l.tag === tag);
}
