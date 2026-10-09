// Blizzard's expansion-neutral Warcraft identity from the new-player guide:
// https://worldofwarcraft.blizzard.com/en-us/start (verified 2026-10-01).
// It remains useful before the season feed loads or when that feed is unavailable.
export const WOW_RETAIL_ART = {
  name: "World of Warcraft",
  logo: "https://blz-contentstack-images.akamaized.net/v3/assets/blt3452e3b114fab0cd/bltac1f1c5ba0d0ba9b/5f45696f8ea4aa55f232a4dd/logo_wow_na.png?width=480&format=webp",
  backdrop: "https://blz-contentstack-images.akamaized.net/v3/assets/blt3452e3b114fab0cd/bltbf61e005140cd7ea/6924cea68393be62205b1738/new_BG.jpg?width=1600&format=webp&quality=85",
};

// Blizzard's original Midnight logo and Silvermoon artwork, from
// https://worldofwarcraft.blizzard.com/en-us/midnight (verified 2026-09-30).
// Keep expansion art tied to the observed season; never label a future pool Midnight.
export function wowSeasonArt(season: string | undefined) {
  if (!season?.startsWith("season-mn-")) return null;
  return {
    name: "World of Warcraft: Midnight",
    logo: "https://blz-contentstack-images.akamaized.net/v3/assets/blt3452e3b114fab0cd/blt8d3cecf84f200ed6/68a4ed936a17f5492299906f/midnight-logo-1.png?width=480&format=webp",
    backdrop: "https://blz-contentstack-images.akamaized.net/v3/assets/blt3452e3b114fab0cd/blt4162b8d6819d074d/688a758c55c3d6c21ebdd399/Silvermoon.png?width=1600&format=webp&quality=85",
  };
}

// Original publisher art from /en-us/classic, verified 2026-09-30. Expansion
// branding is shown only while the live GameVersions entry still identifies it.
const classicAsset = (path: string, width: number) => `https://blz-contentstack-images.akamaized.net/v3/assets/blt9c12f249ac15c7ec/${path}?width=${width}&format=webp&quality=85`;
export const WOW_CLASSIC_ART = {
  name: "World of Warcraft Classic",
  logo: classicAsset("blt4393bf5a7c485d27/6a8e0ea02437eda295d4864e/classic-logo.png", 520),
  backdrop: classicAsset("bltdb388a4abd197586/6a86a1886cec0d30e9b13fe8/classic-masthead-lg.png", 1600),
};
export function wowClassicArt(edition: string, providerName: string) {
  if (edition === "classicann" && providerName === "Burning Crusade Classic") return {
    name: "Burning Crusade Classic Anniversary Edition",
    logo: classicAsset("blte4c0e27d03065f99/6a8921ab1deff340d1438f68/classic-bcc-logo.png", 520),
    backdrop: classicAsset("blt9637c72b4c27eb66/6a86c058c751e17dc40c4de7/classic-bcc-bg.png", 1100),
  };
  if (edition === "classic" && providerName === "Mists of Pandaria Classic") return {
    name: providerName,
    logo: classicAsset("blt18ffd520906ba5e0/6a89224a2c0580a337273b2c/classic-mop-logo.png", 520),
    backdrop: classicAsset("blta9c3baa4bc31dfd9/6a86c0667ec8fea6920002f9/classic-mop-bg.png", 1100),
  };
  if (edition === "classic1x") return { ...WOW_CLASSIC_ART, backdrop: classicAsset("bltd7f3db63b41b3f73/6a86c0659b942ed84ef740cf/classic-bg.png", 1100) };
  return WOW_CLASSIC_ART;
}
