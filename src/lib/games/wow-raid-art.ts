// Original Blizzard artwork, verified against the named encounters in the
// official raid overview on 2026-10-01. Join by raid and encounter identity,
// never translated display names or the current season number.
const source = "https://news.blizzard.com/en-us/article/24294062/curse-of-ulatek-the-venomous-abyss-raid-finder-wing-3-now-live";
const asset = (file: string) => `https://bnetcmsus-a.akamaihd.net/cms/content_entry_media/${file}.png`;
const encounters: Record<string, { id: number; image: string }> = {
  "nekzali-the-soulcoiler": { id: 197163, image: asset("8I2TB0943KH41785170425628") },
  "entombed-sentinels": { id: 197164, image: asset("OGY3E4QOPMGM1785170425675") },
  "the-lost-explorers": { id: 197166, image: asset("07LOV1FQZA8U1785170427744") },
  "vashnik-the-malignant": { id: 197165, image: asset("1JPXPRUFBTVD1785170425727") },
  "sszorak": { id: 197167, image: asset("jm/JM6UI92TKUGN1785170646735") },
  "the-twin-fangs": { id: 197168, image: asset("LGZY63UNHBIR1785170427943") },
  "the-coiled-altar": { id: 197169, image: asset("KAG9F71K9QHH1785170428925") },
  "ulatek": { id: 197170, image: asset("ec/ECNJHYP6XUCH1785170798414") },
};

export function wowRaidArt(raid: string) {
  if (raid === "the-tidebound-grotto") return {
    image: asset("X0MQBJPBDS5J1781742460649"),
    source: "https://news.blizzard.com/en-us/article/24295085/step-into-lairs-and-face-the-foes-inside",
  };
  return raid === "the-venomous-abyss" ? { image: asset("SSA6NR4LD1VX1785170429186"), source } : null;
}

export function wowEncounterArt(raid: string, encounter: { id: number | null; slug: string }) {
  if (raid === "the-tidebound-grotto" && encounter.id === 197188 && encounter.slug === "nymrissa-wavecaller") return asset("X0MQBJPBDS5J1781742460649");
  if (raid !== "the-venomous-abyss") return "";
  const art = Object.hasOwn(encounters, encounter.slug) ? encounters[encounter.slug] : undefined;
  return art?.id === encounter.id ? art.image : "";
}
