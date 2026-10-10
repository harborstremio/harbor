import { LEAGUE_BRANDING } from "./league-branding";

// Verified unavailable on 2026-09-14. Match exact URLs so a future provider replacement can render.
const UNAVAILABLE_LOGOS = new Set([
  "https://a.espncdn.com/i/leaguelogos/cricket/500/22975.png", // Ashes: 404
  "https://a.espncdn.com/i/leaguelogos/cricket/500/8052.png", // County Championship: 404
  "https://a.espncdn.com/i/leaguelogos/cricket/500/8050.png", // Ranji Trophy: 404
  "https://www.nascar.com/wp-content/uploads/sites/7/2025/10/26/NASCAR_Cup_Series_logo.svg",
  "https://www.nascar.com/wp-content/uploads/sites/7/2025/09/30/NOAPS-Primary_FullColor-RGB.svg",
  "https://www.nascar.com/wp-content/uploads/sites/7/2026/02/13/nascar-craftman-truck-series-1.svg",
]);

/** A generic ball/glove is a sport icon, never a competition's brand. */
export function leagueLogoSource(league: { key?: string; logo: string }): string {
  const verified = league.key && LEAGUE_BRANDING[league.key];
  if (verified) return verified;
  const generic =
    !league.logo ||
    UNAVAILABLE_LOGOS.has(league.logo) ||
    /ESPN-icon-|^data:image/i.test(league.logo);
  if (generic && league.key?.startsWith("NCAA")) return LEAGUE_BRANDING.NCAAB;
  return generic ? "" : league.logo;
}

/** Dark publisher wordmarks need a neutral light canvas in Harbor's dark themes. */
export const LEAGUE_KEY_LOGO_BACKGROUNDS: Readonly<Record<string, "light" | "dark">> = {
  EPL: "light",
  UCL: "light",
  LPGA: "light",
};
