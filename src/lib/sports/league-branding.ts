/** Publisher-provided league marks, verified 2026-09-14. */
export const LEAGUE_BRANDING: Readonly<Record<string, string>> = {
  NASCAR: "https://upload.wikimedia.org/wikipedia/commons/c/cb/NASCAR_Cup_Series_logo.svg",
  WPL: "/sports/logos/league-wpl.png",
  MLC: "/sports/logos/league-mlc.png",
  ILT20: "/sports/logos/league-ilt20.svg",
  WTC: "/sports/logos/league-wtc.svg",
  ICCWC: "/sports/logos/league-iccwc-2027.png",
  HUNDREDW: "/sports/logos/league-hundred.svg",
  TENNIS: "/sports/logos/league-atp-header.png",
  TENNIS_WTA: "/sports/logos/league-wta.svg",
  PGA: "/sports/logos/league-pga.svg",
  NCAAB: "/sports/logos/league-ncaa.svg",
  NCAAW: "/sports/logos/league-ncaa.svg",
  NCAAF: "/sports/logos/league-ncaa.svg",
  NCAABASE: "/sports/logos/league-ncaa.svg",
  NCAAHOCKEY: "/sports/logos/league-ncaa.svg",
  NCAAMSOCCER: "/sports/logos/league-ncaa.svg",
  NCAAWSOCCER: "/sports/logos/league-ncaa.svg",
  URC: "/sports/logos/league-urc-emblem.svg",
  TOP14: "/sports/logos/league-top14.webp",
  RUGBY: "/sports/logos/league-rwc.png",
  BELLATOR: "/sports/logos/league-bellator.webp",
  SA20: "/sports/logos/league-sa20.png",
  SUPERRUGBY: "/sports/logos/league-superrugby.png",
  NATIONALLEAGUE: "/sports/logos/league-nationalleague.png",
  NOR: "/sports/logos/league-nor.svg",
  DEN: "/sports/logos/league-den.svg",
  CCC: "/sports/logos/league-ccc.svg",
};

/** Preserve the original colors; only the supporting canvas changes. */
export const LEAGUE_LOGO_BACKGROUNDS: Readonly<Record<string, "light" | "dark">> = {
  "/sports/logos/league-wpl.png": "dark",
  "/sports/logos/league-mlc.png": "light",
  "/sports/logos/league-ilt20.svg": "dark",
  "/sports/logos/league-wtc.svg": "dark",
  "/sports/logos/league-iccwc-2027.png": "dark",
  "/sports/logos/league-hundred.svg": "dark",
  "/sports/logos/league-atp-header.png": "light",
  "/sports/logos/league-wta.svg": "light",
  "/sports/logos/league-urc-emblem.svg": "light",
  "/sports/logos/league-bellator.webp": "light",
  "/sports/logos/league-nationalleague.png": "light",
  "/sports/logos/league-ccc.svg": "light",
  "/sports/logos/league-den.svg": "light",
  "/sports/logos/league-rwc.png": "dark",
  "/sports/logos/league-sa20.png": "dark",
  "/sports/logos/league-nor.svg": "dark",
};

export interface LeagueBrandingSource {
  page: string;
  image: string;
  note?: string;
}

/** Source provenance is not a claim of a redistribution license. */
export const LEAGUE_BRANDING_SOURCES: Readonly<Record<string, LeagueBrandingSource>> = {
  WPL: {
    page: "https://www.wplt20.com/",
    image:
      "https://images.ctfassets.net/vnnp2s7xqnss/5Rrr3JCyZX3v3BN2hRpDfj/2c9861fb306bac6217d21592ca695e7c/WPL_Logo.png",
  },
  MLC: {
    page: "https://www.majorleaguecricket.com/",
    image: "https://www.majorleaguecricket.com/assets/images/MLC_Logo_RGB.png",
  },
  ILT20: {
    page: "https://www.ilt20.ae/",
    image: "https://www.ilt20.ae/static-assets/images/ilt20-desktop.svg?v=1.55",
  },
  WTC: {
    page: "https://www.icc-cricket.com/tournaments/world-test-championship",
    image:
      "https://images.icc-cricket.com/image/private/t_q-best/v1723568183/prd/assets/tournaments/worldtestchampionship/2023-2025/Logo_Light_dvrowv.svg",
    note: "Undated competition wordmark currently published by ICC; source asset path retains an earlier cycle.",
  },
  ICCWC: {
    page: "https://www.icc-cricket.com/",
    image:
      "https://images.icc-cricket.com/image/private/t_q-best/v1786347505/prd/assets/app-nav-dropdown/cwc27-logo.png",
    note: "Official current 2027 tournament brand from ICC navigation; does not imply a live event.",
  },
  HUNDREDW: {
    page: "https://www.thehundred.com/",
    image: "https://www.thehundred.com/#navigation-logo",
    note: "Original inline tournament wordmark, shared by the men’s and women’s competition; extracted without recoloring.",
  },
  TENNIS: {
    page: "https://www.atptour.com/",
    image: "https://www.atptour.com/-/media/sites/atp-tour/header/logo-atptour-dark_1.png",
  },
  TENNIS_WTA: {
    page: "https://www.wtatennis.com/",
    image:
      "https://photoresources.wtatennis.com/wta/document/2025/12/04/5da42b69-828e-4814-9ef9-daa4c8f68b2e/WTA_Logo_Core_Purple_RGB.svg",
  },
  PGA: {
    page: "https://www.pgatour.com/",
    image: "https://static-assets.pgatour.com/svg-assets/logos/pga-tour-logo.svg",
  },
  NCAAB: {
    page: "https://www.ncaa.org/",
    image: "https://www.ncaa.org/wp-content/uploads/2026/02/ncaa-logo-1.svg",
    note: "NCAA organization mark; not a sport-specific championship badge.",
  },
  NCAAW: {
    page: "https://www.ncaa.org/",
    image: "https://www.ncaa.org/wp-content/uploads/2026/02/ncaa-logo-1.svg",
    note: "NCAA organization mark; not a sport-specific championship badge.",
  },
  NCAAF: {
    page: "https://www.ncaa.org/",
    image: "https://www.ncaa.org/wp-content/uploads/2026/02/ncaa-logo-1.svg",
    note: "NCAA organization mark; not a sport-specific championship badge.",
  },
  NCAABASE: {
    page: "https://www.ncaa.org/",
    image: "https://www.ncaa.org/wp-content/uploads/2026/02/ncaa-logo-1.svg",
    note: "NCAA organization mark; not a sport-specific championship badge.",
  },
  NCAAHOCKEY: {
    page: "https://www.ncaa.org/",
    image: "https://www.ncaa.org/wp-content/uploads/2026/02/ncaa-logo-1.svg",
    note: "NCAA organization mark; not a sport-specific championship badge.",
  },
  NCAAMSOCCER: {
    page: "https://www.ncaa.org/",
    image: "https://www.ncaa.org/wp-content/uploads/2026/02/ncaa-logo-1.svg",
    note: "NCAA organization mark; not a sport-specific championship badge.",
  },
  NCAAWSOCCER: {
    page: "https://www.ncaa.org/",
    image: "https://www.ncaa.org/wp-content/uploads/2026/02/ncaa-logo-1.svg",
    note: "NCAA organization mark; not a sport-specific championship badge.",
  },
  URC: {
    page: "https://www.unitedrugby.com/",
    image:
      "https://www.unitedrugby.com/wp-content/uploads/2025/09/URC_LOGO_EMBLEM_GENERIC_WHITE_NEG_RGB-1.svg",
  },
  TOP14: {
    page: "https://top14.lnr.fr/",
    image: "https://assets.lnr.fr/1/1/1/8/0/7/conversions/logo-top14.e32e7e9a-logo.webp",
  },
  RUGBY: {
    page: "https://www.rugbyworldcup.com/",
    image:
      "https://resources.worldrugby-rims.pulselive.com/worldrugby/photo/2024/07/24/cc8f4523-b404-4991-aac2-8849f3c99d62/RWC_MASTERBRAND_HORIZONTAL_LOCKUP_LOGO_GREEN_RGB.png",
  },
  BELLATOR: {
    page: "https://pflmma.com/",
    image: "https://pflmma.com/assets/img/Bellator_Logo_m.webp",
    note: "Legacy Bellator mark retained on PFL’s Champions Series navigation; does not imply a current independent schedule.",
  },
  SA20: {
    page: "https://www.sa20.co.za/",
    image:
      "https://www.sa20.co.za/_next/static/media/logo-vertical.5110e5db.png?width=256&quality=100&format=webp",
  },
  SUPERRUGBY: {
    page: "https://super.rugby/superrugby/",
    image: "https://super.rugby/themes/MuraBootstrap4/images/logo-srp25-default.png",
  },
  NATIONALLEAGUE: {
    page: "https://www.thenationalleague.org.uk/",
    image:
      "https://images.gc.nationalleagueservices.co.uk/fit-in/350x350/c64a92f0-2748-11f0-956a-2f0bc148c6f8.png",
  },
  NOR: {
    page: "https://www.eliteserien.no/",
    image:
      "https://www.eliteserien.no/_/asset/no.seeds.app.football:0000019ff15f3380/img/eliteserien-white.svg",
  },
  DEN: {
    page: "https://superliga.dk/",
    image: "https://superliga.dk/#Logo_symbol",
    note: "Published inline Logo_symbol SVG, extracted without recoloring.",
  },
  CCC: {
    page: "https://www.concacaf.com/champions-cup/",
    image:
      "https://images.concacaf.com/image/private/t_q_good/v1748245386/prd/assets/logos/champions-cup/CCC_Icon_Secondary_Color_RGB_fk2wi0.svg",
  },
};

/** Local copies are used only after a remote brand image fails. */
export const LEAGUE_LOGO_FALLBACKS: Readonly<Record<string, string>> = {
  "https://upload.wikimedia.org/wikipedia/commons/c/cb/NASCAR_Cup_Series_logo.svg":
    "/sports/logos/league-nascar-cup.svg",
};
