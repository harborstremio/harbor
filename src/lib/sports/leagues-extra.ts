import type { LeagueDef, LeagueGroupDef } from "./espn";

const LL = "https://a.espncdn.com/i/leaguelogos/soccer/500";
const CL = "https://a.espncdn.com/i/leaguelogos/cricket/500";
const TL = "https://a.espncdn.com/i/teamlogos/leagues/500";
const EL = "https://a.espncdn.com/i/espn/teamlogos/500";
const IC = "https://a.espncdn.com/redesign/assets/img/icons";

const SOCCER_ICON = `${IC}/ESPN-icon-soccer.png`;
const RUGBY_ICON = `${IC}/ESPN-icon-rugby.png`;

export const EXTRA_LEAGUES: LeagueDef[] = [
  { key: "KINGSCUP", label: "كأس الملك السعودي", labelEn: "Saudi King's Cup", tag: "KCUP", path: "soccer/ksa.kings.cup", logo: SOCCER_ICON, group: "soccer" },
  { key: "GULFCUP", label: "كأس الخليج العربي", labelEn: "Arabian Gulf Cup", tag: "GULF", path: "soccer/global.gulf_cup", logo: SOCCER_ICON, group: "soccer" },
  { key: "ACLE", label: "دوري أبطال آسيا للنخبة", labelEn: "AFC Champions League Elite", labelRu: "Лига чемпионов АФК", tag: "ACLE", path: "soccer/afc.champions", logo: `${LL}/2200.png`, group: "soccer" },
  { key: "ACL2", label: "دوري أبطال آسيا 2", labelEn: "AFC Champions League Two", tag: "ACL2", path: "soccer/afc.cup", logo: `${LL}/2243.png`, group: "soccer" },
  { key: "ACLQ", label: "تصفيات دوري أبطال آسيا", labelEn: "AFC Champions League Qualifying", tag: "ACLQ", path: "soccer/afc.champions_qual", logo: SOCCER_ICON, group: "soccer" },
  { key: "CAFCL", label: "دوري أبطال أفريقيا", labelEn: "CAF Champions League", tag: "CAFCL", path: "soccer/caf.champions", logo: `${LL}/2391.png`, group: "soccer" },
  { key: "CAFCC", label: "كأس الاتحاد الأفريقي", labelEn: "CAF Confederation Cup", tag: "CAFCC", path: "soccer/caf.confed", logo: SOCCER_ICON, group: "soccer" },
  { key: "AFCON", label: "كأس الأمم الأفريقية", labelEn: "Africa Cup of Nations", tag: "AFCON", path: "soccer/caf.nations", logo: `${LL}/76.png`, group: "soccer" },
  { key: "RSA", label: "الدوري الجنوب أفريقي", labelEn: "South African Premiership", tag: "RSA", path: "soccer/rsa.1", logo: SOCCER_ICON, group: "soccer" },

  { key: "BRASILEIRAO", label: "الدوري البرازيلي", labelEn: "Brasileirao Serie A", labelRu: "Серия А Бразилии", tag: "BRA", path: "soccer/bra.1", logo: `${LL}/85.png`, group: "soccer" },
  { key: "BRASILEIRAOB", label: "الدوري البرازيلي الثاني", labelEn: "Brasileirao Serie B", tag: "BRA2", path: "soccer/bra.2", logo: `${LL}/2299.png`, group: "soccer" },
  { key: "COPADOBRASIL", label: "كأس البرازيل", labelEn: "Copa do Brasil", tag: "CDB", path: "soccer/bra.copa_do_brazil", logo: `${LL}/528.png`, group: "soccer" },
  { key: "PAULISTA", label: "بطولة باوليستا", labelEn: "Campeonato Paulista", tag: "PAU", path: "soccer/bra.camp.paulista", logo: `${LL}/2322.png`, group: "soccer" },
  { key: "CARIOCA", label: "بطولة كاريوكا", labelEn: "Campeonato Carioca", tag: "CAR", path: "soccer/bra.camp.carioca", logo: `${LL}/2265.png`, group: "soccer" },
  { key: "MINEIRO", label: "بطولة مينيرو", labelEn: "Campeonato Mineiro", tag: "MIN", path: "soccer/bra.camp.mineiro", logo: `${LL}/2360.png`, group: "soccer" },
  { key: "GAUCHO", label: "بطولة غاوتشو", labelEn: "Campeonato Gaucho", tag: "GAU", path: "soccer/bra.camp.gaucho", logo: `${LL}/2272.png`, group: "soccer" },
  { key: "LIBERTADORES", label: "كأس ليبرتادوريس", labelEn: "Copa Libertadores", labelRu: "Кубок Либертадорес", tag: "LIB", path: "soccer/conmebol.libertadores", logo: `${LL}/58.png`, group: "soccer" },
  { key: "SUDAMERICANA", label: "كأس سودأمريكانا", labelEn: "Copa Sudamericana", tag: "SUD", path: "soccer/conmebol.sudamericana", logo: `${LL}/1208.png`, group: "soccer" },
  { key: "COPAAMERICA", label: "كوبا أمريكا", labelEn: "Copa America", tag: "CAM", path: "soccer/conmebol.america", logo: `${LL}/83.png`, group: "soccer" },
  { key: "ARG", label: "الدوري الأرجنتيني", labelEn: "Argentine Primera", tag: "ARG", path: "soccer/arg.1", logo: `${LL}/1.png`, group: "soccer" },
  { key: "COPAARG", label: "كأس الأرجنتين", labelEn: "Copa Argentina", tag: "CARG", path: "soccer/arg.copa", logo: `${LL}/2320.png`, group: "soccer" },
  { key: "URU", label: "الدوري الأوروغوياني", labelEn: "Uruguayan Primera", tag: "URU", path: "soccer/uru.1", logo: `${LL}/1592.png`, group: "soccer" },
  { key: "COL", label: "الدوري الكولومبي", labelEn: "Colombian Primera A", tag: "COL", path: "soccer/col.1", logo: `${LL}/1543.png`, group: "soccer" },
  { key: "CHI", label: "الدوري التشيلي", labelEn: "Chilean Primera", tag: "CHI", path: "soccer/chi.1", logo: `${LL}/86.png`, group: "soccer" },
  { key: "PER", label: "الدوري البيروفي", labelEn: "Peruvian Liga 1", tag: "PER", path: "soccer/per.1", logo: `${LL}/1813.png`, group: "soccer" },
  { key: "PAR", label: "الدوري الباراغوياني", labelEn: "Paraguayan Primera", tag: "PAR", path: "soccer/par.1", logo: `${LL}/1892.png`, group: "soccer" },
  { key: "ECU", label: "الدوري الإكوادوري", labelEn: "LigaPro Ecuador", tag: "ECU", path: "soccer/ecu.1", logo: `${LL}/1944.png`, group: "soccer" },
  { key: "VEN", label: "الدوري الفنزويلي", labelEn: "Venezuelan Primera", tag: "VEN", path: "soccer/ven.1", logo: `${LL}/1947.png`, group: "soccer" },
  { key: "BOL", label: "الدوري البوليفي", labelEn: "Bolivian Primera", tag: "BOL", path: "soccer/bol.1", logo: `${LL}/1949.png`, group: "soccer" },

  { key: "LIGAMX", label: "الدوري المكسيكي", labelEn: "Liga MX", tag: "MEX", path: "soccer/mex.1", logo: `${LL}/22.png`, group: "soccer" },
  { key: "LIGAEXP", label: "دوري التوسعة المكسيكي", labelEn: "Liga de Expansion MX", tag: "MEX2", path: "soccer/mex.2", logo: `${LL}/2306.png`, group: "soccer" },
  { key: "CCC", label: "دوري أبطال الكونكاكاف", labelEn: "CONCACAF Champions Cup", tag: "CCC", path: "soccer/concacaf.champions_cup", logo: SOCCER_ICON, group: "soccer" },
  { key: "LEAGUESCUP", label: "كأس الدوريات", labelEn: "Leagues Cup", tag: "LGC", path: "soccer/concacaf.leagues.cup", logo: `${LL}/2410.png`, group: "soccer" },
  { key: "GOLDCUP", label: "الكأس الذهبية", labelEn: "CONCACAF Gold Cup", tag: "GOLD", path: "soccer/concacaf.gold", logo: `${LL}/59.png`, group: "soccer" },
  { key: "NWSL", label: "الدوري الأمريكي للسيدات", labelEn: "NWSL", tag: "NWSL", path: "soccer/usa.nwsl", logo: `${LL}/2323.png`, group: "soccer" },
  { key: "USOPENCUP", label: "كأس أمريكا المفتوحة", labelEn: "U.S. Open Cup", tag: "USOC", path: "soccer/usa.open", logo: `${LL}/69.png`, group: "soccer" },
  { key: "USL", label: "دوري USL", labelEn: "USL Championship", tag: "USL", path: "soccer/usa.usl.1", logo: `${LL}/2292.png`, group: "soccer" },

  { key: "CHAMPIONSHIP", label: "دوري البطولة الإنجليزية", labelEn: "EFL Championship", labelRu: "Чемпионшип", tag: "EFLC", path: "soccer/eng.2", logo: `${LL}/24.png`, group: "soccer" },
  { key: "LEAGUEONE", label: "الدرجة الأولى الإنجليزية", labelEn: "EFL League One", tag: "EFL1", path: "soccer/eng.3", logo: `${LL}/25.png`, group: "soccer" },
  { key: "LEAGUETWO", label: "الدرجة الثانية الإنجليزية", labelEn: "EFL League Two", tag: "EFL2", path: "soccer/eng.4", logo: `${LL}/26.png`, group: "soccer" },
  { key: "NATIONALLEAGUE", label: "الدوري الوطني الإنجليزي", labelEn: "National League", tag: "ENL", path: "soccer/eng.5", logo: SOCCER_ICON, group: "soccer" },
  { key: "FACUP", label: "كأس الاتحاد الإنجليزي", labelEn: "FA Cup", tag: "FAC", path: "soccer/eng.fa", logo: `${LL}/40.png`, group: "soccer" },
  { key: "CARABAO", label: "كأس الرابطة الإنجليزية", labelEn: "Carabao Cup", tag: "EFLCUP", path: "soccer/eng.league_cup", logo: `${LL}/41.png`, group: "soccer" },
  { key: "LALIGA2", label: "الدوري الإسباني الثاني", labelEn: "LaLiga 2", tag: "ESP2", path: "soccer/esp.2", logo: `${LL}/107.png`, group: "soccer" },
  { key: "COPADELREY", label: "كأس ملك إسبانيا", labelEn: "Copa del Rey", tag: "CDR", path: "soccer/esp.copa_del_rey", logo: `${LL}/80.png`, group: "soccer" },
  { key: "SERIEB", label: "الدوري الإيطالي الثاني", labelEn: "Serie B", tag: "ITA2", path: "soccer/ita.2", logo: `${LL}/99.png`, group: "soccer" },
  { key: "COPPAITALIA", label: "كأس إيطاليا", labelEn: "Coppa Italia", tag: "COPPA", path: "soccer/ita.coppa_italia", logo: `${LL}/2192.png`, group: "soccer" },
  { key: "BUNDESLIGA2", label: "الدوري الألماني الثاني", labelEn: "2. Bundesliga", tag: "GER2", path: "soccer/ger.2", logo: `${LL}/97.png`, group: "soccer" },
  { key: "DFBPOKAL", label: "كأس ألمانيا", labelEn: "DFB-Pokal", tag: "DFB", path: "soccer/ger.dfb_pokal", logo: `${LL}/2061.png`, group: "soccer" },
  { key: "LIGUE2", label: "الدوري الفرنسي الثاني", labelEn: "Ligue 2", tag: "FRA2", path: "soccer/fra.2", logo: `${LL}/96.png`, group: "soccer" },
  { key: "COUPEDEFRANCE", label: "كأس فرنسا", labelEn: "Coupe de France", tag: "CDF", path: "soccer/fra.coupe_de_france", logo: `${LL}/182.png`, group: "soccer" },
  { key: "EREDIVISIE", label: "الدوري الهولندي", labelEn: "Eredivisie", labelRu: "Эредивизи", tag: "NED", path: "soccer/ned.1", logo: `${LL}/11.png`, group: "soccer" },
  { key: "EERSTE", label: "الدوري الهولندي الثاني", labelEn: "Eerste Divisie", tag: "NED2", path: "soccer/ned.2", logo: `${LL}/105.png`, group: "soccer" },
  { key: "KNVB", label: "كأس هولندا", labelEn: "KNVB Beker", tag: "KNVB", path: "soccer/ned.cup", logo: `${LL}/2196.png`, group: "soccer" },
  { key: "PRIMEIRA", label: "الدوري البرتغالي", labelEn: "Primeira Liga", labelRu: "Примейра-лига", tag: "POR", path: "soccer/por.1", logo: `${LL}/14.png`, group: "soccer" },
  { key: "TACAPORTUGAL", label: "كأس البرتغال", labelEn: "Taca de Portugal", tag: "TACA", path: "soccer/por.taca.portugal", logo: SOCCER_ICON, group: "soccer" },
  { key: "SCO", label: "الدوري الاسكتلندي", labelEn: "Scottish Premiership", tag: "SCO", path: "soccer/sco.1", logo: `${LL}/45.png`, group: "soccer" },
  { key: "TUR", label: "الدوري التركي", labelEn: "Turkish Super Lig", labelRu: "Суперлига Турции", tag: "TUR", path: "soccer/tur.1", logo: `${LL}/18.png`, group: "soccer" },
  { key: "GRE", label: "الدوري اليوناني", labelEn: "Greek Super League", tag: "GRE", path: "soccer/gre.1", logo: `${LL}/98.png`, group: "soccer" },
  { key: "BEL", label: "الدوري البلجيكي", labelEn: "Belgian Pro League", tag: "BEL", path: "soccer/bel.1", logo: `${LL}/6.png`, group: "soccer" },
  { key: "AUT", label: "الدوري النمساوي", labelEn: "Austrian Bundesliga", tag: "AUT", path: "soccer/aut.1", logo: `${LL}/5.png`, group: "soccer" },
  { key: "SUI", label: "الدوري السويسري", labelEn: "Swiss Super League", tag: "SUI", path: "soccer/sui.1", logo: `${LL}/17.png`, group: "soccer" },
  { key: "SWE", label: "الدوري السويدي", labelEn: "Allsvenskan", tag: "SWE", path: "soccer/swe.1", logo: `${LL}/16.png`, group: "soccer" },
  { key: "DEN", label: "الدوري الدنماركي", labelEn: "Danish Superliga", tag: "DEN", path: "soccer/den.1", logo: SOCCER_ICON, group: "soccer" },
  { key: "NOR", label: "الدوري النرويجي", labelEn: "Eliteserien", tag: "NOR", path: "soccer/nor.1", logo: SOCCER_ICON, group: "soccer" },
  { key: "RUS", label: "الدوري الروسي", labelEn: "Russian Premier League", labelRu: "РПЛ", tag: "RUS", path: "soccer/rus.1", logo: `${LL}/106.png`, group: "soccer" },
  { key: "NATIONSLEAGUE", label: "دوري الأمم الأوروبية", labelEn: "UEFA Nations League", labelRu: "Лига наций", tag: "UNL", path: "soccer/uefa.nations", logo: `${LL}/2395.png`, group: "soccer" },
  { key: "EURO", label: "كأس أمم أوروبا", labelEn: "UEFA Euro", labelRu: "Евро", tag: "EURO", path: "soccer/uefa.euro", logo: `${LL}/74.png`, group: "soccer" },
  { key: "CLUBWORLDCUP", label: "كأس العالم للأندية", labelEn: "FIFA Club World Cup", labelRu: "Клубный чемпионат мира", tag: "CWC", path: "soccer/fifa.cwc", logo: `${LL}/1932.png`, group: "soccer" },

  { key: "WCQUEFA", label: "تصفيات كأس العالم - أوروبا", labelEn: "World Cup Qualifying: UEFA", labelRu: "Отбор ЧМ: Европа", tag: "WCQE", path: "soccer/fifa.worldq.uefa", logo: `${LL}/67.png`, group: "soccer" },
  { key: "WCQCONMEBOL", label: "تصفيات كأس العالم - أمريكا الجنوبية", labelEn: "World Cup Qualifying: CONMEBOL", tag: "WCQS", path: "soccer/fifa.worldq.conmebol", logo: `${LL}/65.png`, group: "soccer" },
  { key: "WCQCAF", label: "تصفيات كأس العالم - أفريقيا", labelEn: "World Cup Qualifying: CAF", tag: "WCQA", path: "soccer/fifa.worldq.caf", logo: `${LL}/63.png`, group: "soccer" },
  { key: "WCQAFC", label: "تصفيات كأس العالم - آسيا", labelEn: "World Cup Qualifying: AFC", tag: "WCQC", path: "soccer/fifa.worldq.afc", logo: `${LL}/62.png`, group: "soccer" },

  { key: "JLEAGUE", label: "الدوري الياباني", labelEn: "J1 League", tag: "JPN", path: "soccer/jpn.1", logo: `${LL}/2199.png`, group: "soccer" },
  { key: "CSL", label: "الدوري الصيني", labelEn: "Chinese Super League", tag: "CHN", path: "soccer/chn.1", logo: `${LL}/2350.png`, group: "soccer" },
  { key: "ISL", label: "الدوري الهندي", labelEn: "Indian Super League", tag: "IND", path: "soccer/ind.1", logo: `${LL}/2334.png`, group: "soccer" },
  { key: "ALEAGUE", label: "الدوري الأسترالي", labelEn: "A-League Men", tag: "AUS", path: "soccer/aus.1", logo: `${LL}/1308.png`, group: "soccer" },

  { key: "WNBA", label: "الدوري الأمريكي للسيدات للسلة", labelEn: "WNBA", labelRu: "WNBA", tag: "WNBA", path: "basketball/wnba", logo: `${TL}/wnba.png`, group: "basketball" },
  { key: "GLEAGUE", label: "دوري التطوير NBA", labelEn: "NBA G League", tag: "GLG", path: "basketball/nba-development", logo: `${TL}/nba_gleague.png`, group: "basketball" },
  { key: "NCAAW", label: "NCAA كرة السلة للسيدات", labelEn: "NCAA Women's Basketball", tag: "NCAAW", path: "basketball/womens-college-basketball", logo: `${IC}/ESPN-icon-basketball.png`, group: "basketball" },
  { key: "FIBA", label: "كأس العالم لكرة السلة", labelEn: "FIBA World Cup", labelRu: "Чемпионат мира ФИБА", tag: "FIBA", path: "basketball/fiba", logo: `${TL}/fiba.png`, group: "basketball" },
  { key: "NBL", label: "الدوري الأسترالي للسلة", labelEn: "NBL Australia", tag: "NBL", path: "basketball/nbl", logo: `${TL}/nbl.png`, group: "basketball" },

  { key: "NCAABASE", label: "NCAA البيسبول", labelEn: "NCAA Baseball", tag: "NCAABSB", path: "baseball/college-baseball", logo: `${IC}/ESPN-icon-baseball.png`, group: "baseball" },

  { key: "NCAAHOCKEY", label: "NCAA الهوكي", labelEn: "NCAA Ice Hockey", tag: "NCAAH", path: "hockey/mens-college-hockey", logo: `${IC}/ESPN-icon-hockey.png`, group: "hockey" },

  { key: "PFL", label: "دوري المقاتلين المحترفين", labelEn: "Professional Fighters League", labelRu: "PFL", tag: "PFL", path: "mma/pfl", logo: `${TL}/pfl.png`, group: "combat" },
  { key: "BELLATOR", label: "بيلاتور", labelEn: "Bellator MMA", labelRu: "Bellator", tag: "BELL", path: "mma/bellator", logo: `${IC}/ESPN-icon-mma.png`, group: "combat" },

  { key: "INDYCAR", label: "إندي كار", labelEn: "IndyCar Series", labelRu: "IndyCar", tag: "INDY", path: "racing/irl", logo: `${EL}/indycar_series.png`, group: "motorsport" },
  { key: "XFINITY", label: "ناسكار إكسفينيتي", labelEn: "NASCAR Xfinity Series", tag: "NXS", path: "racing/nascar-secondary", logo: `${IC}/ESPN-icon-NASCAR.png`, group: "motorsport" },
  { key: "TRUCKSERIES", label: "ناسكار الشاحنات", labelEn: "NASCAR Truck Series", tag: "NCTS", path: "racing/nascar-truck", logo: `${IC}/ESPN-icon-NASCAR.png`, group: "motorsport" },

  { key: "LPGA", label: "جولف LPGA", labelEn: "LPGA Tour", tag: "LPGA", path: "golf/lpga", logo: `${TL}/lpga.png`, group: "golf" },
  { key: "CHAMPIONSTOUR", label: "جولة PGA للمخضرمين", labelEn: "PGA Tour Champions", tag: "PGAC", path: "golf/champions-tour", logo: `${EL}/pga_champions_tour.png`, group: "golf" },
  { key: "LIVGOLF", label: "ليف جولف", labelEn: "LIV Golf", tag: "LIV", path: "golf/liv", logo: `${TL}/livgolf.png`, group: "golf" },

  { key: "URC", label: "البطولة الموحدة للرغبي", labelEn: "United Rugby Championship", tag: "URC", path: "rugby/270557", logo: RUGBY_ICON, group: "rugby" },
  { key: "TOP14", label: "توب 14 الفرنسي", labelEn: "French Top 14", tag: "TOP14", path: "rugby/270559", logo: RUGBY_ICON, group: "rugby" },
  { key: "SUPERRUGBY", label: "سوبر رغبي باسيفيك", labelEn: "Super Rugby Pacific", tag: "SRP", path: "rugby/242041", logo: RUGBY_ICON, group: "rugby" },
  { key: "RUGBYTEST", label: "مباريات الرغبي الدولية", labelEn: "Rugby Internationals", tag: "RTEST", path: "rugby/289234", logo: RUGBY_ICON, group: "rugby" },

  { key: "IPL", label: "الدوري الهندي الممتاز", labelEn: "Indian Premier League", tag: "IPL", path: "cricket/8048", logo: `${CL}/8048.png`, group: "cricket" },
  { key: "BIGBASH", label: "بيغ باش", labelEn: "Big Bash League", tag: "BBL", path: "cricket/8044", logo: `${CL}/8044.png`, group: "cricket" },
  { key: "SA20", label: "دوري SA20", labelEn: "SA20", tag: "SA20", path: "cricket/21275", logo: `${CL}/21275.png`, group: "cricket" },
  { key: "ILT20", label: "الدوري الدولي T20", labelEn: "International League T20", tag: "ILT20", path: "cricket/20921", logo: `${CL}/20921.png`, group: "cricket" },
  { key: "MLC", label: "دوري الكريكيت الأمريكي", labelEn: "Major League Cricket", tag: "MLC", path: "cricket/21266", logo: `${CL}/21266.png`, group: "cricket" },
  { key: "WPL", label: "الدوري الهندي للسيدات", labelEn: "Women's Premier League", tag: "WPL", path: "cricket/21282", logo: `${CL}/21282.png`, group: "cricket" },
  { key: "HUNDREDW", label: "بطولة المئة للسيدات", labelEn: "The Hundred Women's", tag: "H100W", path: "cricket/21376", logo: `${CL}/21376.png`, group: "cricket" },
  { key: "ASHES", label: "سلسلة الرماد", labelEn: "The Ashes", tag: "ASHES", path: "cricket/22975", logo: `${CL}/22975.png`, group: "cricket" },
  { key: "WTC", label: "بطولة العالم للاختبارات", labelEn: "ICC World Test Championship", tag: "WTC", path: "cricket/19430", logo: `${CL}/19430.png`, group: "cricket" },
  { key: "ICCWC", label: "كأس العالم للكريكيت", labelEn: "ICC Cricket World Cup", tag: "ICCWC", path: "cricket/8039", logo: `${CL}/8039.png`, group: "cricket" },
  { key: "COUNTY", label: "بطولة المقاطعات الإنجليزية", labelEn: "County Championship", tag: "CCH", path: "cricket/8052", logo: `${CL}/8052.png`, group: "cricket" },
  { key: "SHEFFIELD", label: "درع شيفيلد", labelEn: "Sheffield Shield", tag: "SHFD", path: "cricket/8043", logo: `${CL}/8043.png`, group: "cricket" },
  { key: "RANJI", label: "كأس رانجي", labelEn: "Ranji Trophy", tag: "RANJI", path: "cricket/8050", logo: `${CL}/8050.png`, group: "cricket" },

  { key: "AFL", label: "الدوري الأسترالي للكرة", labelEn: "AFL", tag: "AFL", path: "australian-football/afl", logo: `${TL}/afl.png`, group: "aussie" },

  { key: "PLL", label: "دوري اللاكروس الممتاز", labelEn: "Premier Lacrosse League", tag: "PLL", path: "lacrosse/pll", logo: `${TL}/pll.png`, group: "lacrosse" },
];

export const EXTRA_LEAGUE_GROUPS: LeagueGroupDef[] = [
  { key: "cricket", label: "الكريكيت", labelEn: "Cricket", labelRu: "Крикет", icon: "🏏" },
  { key: "aussie", label: "الكرة الأسترالية", labelEn: "Aussie Rules", labelRu: "Австралийский футбол", icon: "🏉" },
  { key: "lacrosse", label: "اللاكروس", labelEn: "Lacrosse", labelRu: "Лакросс", icon: "🥍" },
];
