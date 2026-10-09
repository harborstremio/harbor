/** Exact identities only; original publisher marks are documented with the assets. */
export function launcherTitleLogo(igdbId?: number): string | undefined {
  return igdbId === 1595 ? "/games/launchers/star-citizen-logo.svg"
    : igdbId === 19128 ? "/games/launchers/squadron-42-logo.svg"
    : igdbId === 1905 ? "/games/publisher/fortnite-logo.svg"
    : igdbId === 115 ? "/games/publisher/league-logo.png"
    : igdbId === 120176 ? "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/d0fa540f2c0e641c4bef56ddf0adb86dcf0b5ab0-368x118.svg"
    : igdbId === 17269 ? "/games/publisher/roblox-logo.svg"
    : igdbId === 126459 ? "/games/valorant/wordmark.png"
    : igdbId === 260 ? "https://app-images.ea.com/ps9x41qn6x3c/54nXOJmoe3ufGPsrGbLs0T/ebaef673f7e5cce7d653963ab829c7fb/the-sims-3-ce-m-keyart-logo-en.png"
    : igdbId === 135400 ? "/games/minecraft/wordmark.svg" : undefined;
}

// Lead scenes inspected October 1, 2026; avoid provider title cards on white.
// Exact IGDB image identities and visual evidence: docs/games/LAUNCHER-ART.md.
const scenes: Readonly<Record<number, string>> = {
  115: "ar6dj", // League of Legends — text-free publisher artwork
  123: "jxrygijnsvlyv0nu03mg", // World of Warcraft
  1020: "sc10f91", // Grand Theft Auto V
  1595: "sczzus", // Star Citizen
  1877: "quphnww1axg2mmsvxfux", // Cyberpunk 2077
  1905: "sc105bo", // Fortnite
  1942: "ar3lze", // The Witcher 3: Wild Hunt
  3212: "wtx5s2uilqiajechlwjk", // The Sims 4
  15536: "p835hnwoshqosredxeir", // Escape from Tarkov
  19128: "ar4d4p", // Squadron 42
  26226: "loakfrjghok9fxnh59lt", // Celeste
  119277: "sco94h", // Genshin Impact
  120176: "ar6rs", // Teamfight Tactics
  126459: "ar5iqn", // Valorant — text-free publisher artwork
  141503: "scahho", // Forza Horizon 5
  242408: "scoqi3", // Counter-Strike 2
  300976: "scs6j4", // Assassin's Creed Shadows
  305027: "scso0g", // New World: Aeternum
};
export function launcherSceneArtwork(igdbId?: number): string | undefined {
  // EA's exact Sims3 offer supplies text-free key art; IGDB's first art is a logo card.
  if (igdbId === 260) return "https://app-images.ea.com/ps9x41qn6x3c/osNEUuWLs4zrlZCYjbl75/78558e20a8dbe733814a543b0e729fa5/the-sims-3-ce-m-keyart-16x9-en.jpg";
  const image = igdbId === undefined ? undefined : scenes[igdbId];
  return image ? `https://images.igdb.com/igdb/image/upload/t_screenshot_huge/${image}.jpg` : undefined;
}
