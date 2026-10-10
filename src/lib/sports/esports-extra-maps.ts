/** Reference layouts only: these never establish the map or live coordinates of a match. */
export type ExtraEsportsGameKind =
  | "rocketleague"
  | "r6"
  | "overwatch"
  | "cod"
  | "apex"
  | "pubg"
  | "fortnite"
  | "starcraft2";
export type ExtraEsportsMap = {
  id: string;
  name: string;
  image?: string;
  imageBytes?: number;
  sourceUrl: string;
  sourceLabel: string;
  kind: "map" | "arena" | "schematic";
  blueprintUrl?: string;
  blueprintBytes?: number;
  notes?: string;
};

const r6Names = [
  "Calypso Casino",
  "Chalet",
  "Bank",
  "Kafe Dostoyevsky",
  "Border",
  "Clubhouse",
  "Stadium Alpha",
  "Stadium Bravo",
  "Lair",
  "Nighthaven Labs",
  "Close Quarter",
  "Emerald Plains",
  "Coastline",
  "Consulate",
  "Favela",
  "Fortress",
  "Hereford Base",
  "House",
  "Kanal",
  "Oregon",
  "Outback",
  "Presidential Plane",
  "Skyscraper",
  "Theme Park",
  "Tower",
  "Villa",
  "Yacht",
];
// Filenames and byte lengths verified from each Ubisoft map page and archive HEAD.
// Keep exceptional names/version suffixes: these are not derived from map slugs.
const r6Blueprints: Record<string, [string, number]> = {
  "calypso-casino": ["calypso-casino-blueprints.zip", 43130289],
  chalet: ["chalet-blueprints.zip", 2775703],
  bank: ["bank-blueprints.zip", 1817539],
  "kafe-dostoyevsky": ["kafe-blueprints.zip", 1270247],
  border: ["border-blueprints.zip", 1787748],
  clubhouse: ["clubhouse-blueprints.zip", 1860163],
  "stadium-alpha": ["stadiumalpha-blueprints.zip", 1973380],
  "stadium-bravo": ["stadiumbravo-blueprints.zip", 957740],
  lair: ["lair-blueprints.zip", 3247118],
  "nighthaven-labs": ["nighthavenlabs-blueprints.zip", 2270788],
  "close-quarter": ["closequarter-blueprints_june22.zip", 1638497],
  "emerald-plains": ["emeraldplains-blueprints.zip", 1757138],
  coastline: ["coastline-blueprints.zip", 1378068],
  consulate: ["consulate-blueprints_may23.zip", 2795059],
  favela: ["favela-blueprints.zip", 4395142],
  fortress: ["fortress-blueprints.zip", 1204048],
  "hereford-base": ["hereford-blueprints.zip", 1547729],
  house: ["house-blueprints.zip", 2684055],
  kanal: ["kanal-blueprints.zip", 1333002],
  oregon: ["oregon-blueprints.zip", 3339075],
  outback: ["outback-blueprints.zip", 1905578],
  "presidential-plane": ["plane-blueprints.zip", 1114627],
  skyscraper: ["skyscraper-blueprints.zip", 2452152],
  "theme-park": ["themepark-blueprints.zip", 2041837],
  tower: ["tower-blueprints.zip", 1045420],
  villa: ["villa-blueprints.zip", 1689912],
  yacht: ["yacht-blueprints.zip", 1102009],
};
const pubgNames = [
  "Erangel",
  "Miramar",
  "Sanhok",
  "Vikendi",
  "Karakin",
  "Paramo",
  "Haven",
  "Taego",
  "Deston",
  "Rondo",
  "Camp_Jackal",
  "Training",
];

export const EXTRA_ESPORTS_MAPS: Record<ExtraEsportsGameKind, ExtraEsportsMap[]> = {
  rocketleague: [
    {
      id: "standard-arena",
      name: "Standard competitive arena",
      sourceUrl: "https://www.rocketleague.com/news/starbase-arc-wasteland-standard-arenas",
      sourceLabel: "Psyonix · standard arenas",
      kind: "schematic",
      notes:
        "Competitive arenas share standard geometry. This is a layout reference, not arena artwork.",
    },
  ],
  r6: r6Names.map((name) => {
    const id = name.toLowerCase().replaceAll(" ", "-");
    const [archive, blueprintBytes] = r6Blueprints[id];
    return {
      id,
      name,
      sourceUrl: `https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/maps/${name.toLowerCase().replaceAll(" ", "-")}`,
      sourceLabel: "Ubisoft · map blueprints",
      kind: "map",
      blueprintUrl: `https://ubistatic-a.ubisoft.com/0106/gamesites/rainbow6/blueprints/r6-maps-${archive}`,
      blueprintBytes,
      notes:
        "Official map reference. Blueprint downloads are not embedded images; floors and map revisions vary.",
    };
  }),
  overwatch: [
    {
      id: "blizzard-world",
      name: "Blizzard World · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1IHQyMYsm9_Tz6F4NqiRxe8wfbm-W9eXW",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "dorado",
      name: "Dorado · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1yz09tpSGZ31oWeAFFq5rNbAPR-esZ7S3",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "eichenwalde",
      name: "Eichenwalde · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1KTP34BeJ_7QQnH5oRERcPhDW5Y8x-o_f",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "busan",
      name: "Busan · legacy layout",
      image: "https://lh3.googleusercontent.com/d/19egQ_j8q83OauiG-Y_Y2kXwn27XZVohT",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "hanamura",
      name: "Hanamura · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1zk_Dqj5T5s294crdjV2ogJoFix3NFtpB",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "hollywood",
      name: "Hollywood · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1YDf5te0F546qE_-gDouMCPP3r3w2su9n",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "ilios",
      name: "Ilios · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1brKnmjy9HK7jyq_Gn16fgm2wbKEM7LjF",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "horizon-lunar-colony",
      name: "Horizon Lunar Colony · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1f56wRNA597msHI8RILBhp4dDxr1WbWsw",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "junkertown",
      name: "Junkertown · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1u9qLIrJ0AU54punlSZXIGo8Zh1reXB7O",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "kings-row",
      name: "King's Row · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1pskvTj33hpqgtTvcqTNi_EIfjCc0dAkq",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "nepal",
      name: "Nepal · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1SrRj33MkWldq2gWFf1nZ17OQ57qZ_nzf",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "oasis",
      name: "Oasis · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1oTu63pYR3FtlrYQA43898ZLcrXdOAzV0",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "numbani",
      name: "Numbani · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1gMfY5tXi-30QuyTNDn2KGMdTy7turxWa",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "lijiang-tower",
      name: "Lijiang Tower · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1J5FcpgmjrFhXvXIjFU6vGe9IK96uuHn8",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "route-66",
      name: "Route 66 · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1PuJfaqCkcv2cbNyQQGlPCVasJx5n_ega",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "paris",
      name: "Paris · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1JEyVTHVO0GOrCLUkyoVDExBNLpBuaiUc",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "temple-of-anubis",
      name: "Temple of Anubis · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1W2WFSOqnjqp0N5pnsudPDJAs4napNF_K",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "volskaya",
      name: "Volskaya · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1xvQS6xr5Tw8sl-AzZB5bsntIjk5_DfKl",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
    {
      id: "watchpoint:-gibraltar",
      name: "Watchpoint: Gibraltar · legacy layout",
      image: "https://lh3.googleusercontent.com/d/1-w09SeRfOSeJTMF2nPFB_h-4r7m9tRWL",
      sourceUrl: "https://overwatch.statbanana.com/images",
      sourceLabel: "Overhead map courtesy of Statbanana",
      kind: "map",
      notes:
        "Overhead map courtesy of https://statbanana.com/ — Coggle screenshot composite. Legacy layout may differ from current Overwatch. Preserve attribution/logo; free annotated analysis only, not unaltered redistribution.",
    },
  ],
  cod: [
    {
      id: "mwiii-departures",
      name: "Departures · Modern Warfare III",
      image:
        "https://www.callofduty.com/content/dam/atvi/callofduty/cod-touchui/blog/guides/mwiii/tacmap/departures/Departures_Tac_Map_BLANK.jpg",
      sourceUrl:
        "https://www.callofduty.com/guides/multiplayer-maps/call-of-duty-guides-modern-warfare-iii-multiplayer-map-guide-departures",
      sourceLabel: "Activision · tactical guide",
      kind: "map",
      notes:
        "Official Modern Warfare III reference map, not the current competitive pool. Map artwork © Activision; linked from the publisher's guide.",
    },
  ],
  apex: [
    {
      id: "mp_rr_arena_phase_runner",
      name: "Phase Runner",
      image:
        "https://apexlegendsstatus.com/systems/interactive-map/imgs/mp_rr_arena_phase_runner.png",
      imageBytes: 22037086,
      sourceUrl: "https://apexlegendsstatus.com/interactive-map/mp_rr_arena_phase_runner",
      sourceLabel: "Apex Legends Status · overhead map",
      kind: "map",
      notes:
        "Extracted game map served by Apex Legends Status. Artwork © EA/Respawn. Reference revision from the source catalog; not live player telemetry or a confirmed event map.",
    },
    {
      id: "mp_rr_aqueduct",
      name: "Overflow",
      image: "https://apexlegendsstatus.com/systems/interactive-map/imgs/mp_rr_aqueduct.png",
      imageBytes: 22976505,
      sourceUrl: "https://apexlegendsstatus.com/interactive-map/mp_rr_aqueduct",
      sourceLabel: "Apex Legends Status · overhead map",
      kind: "map",
      notes:
        "Extracted game map served by Apex Legends Status. Artwork © EA/Respawn. Reference revision from the source catalog; not live player telemetry or a confirmed event map.",
    },
    {
      id: "mp_rr_arena_skygarden",
      name: "Encore",
      image: "https://apexlegendsstatus.com/systems/interactive-map/imgs/mp_rr_arena_skygarden.png",
      imageBytes: 12913859,
      sourceUrl: "https://apexlegendsstatus.com/interactive-map/mp_rr_arena_skygarden",
      sourceLabel: "Apex Legends Status · overhead map",
      kind: "map",
      notes:
        "Extracted game map served by Apex Legends Status. Artwork © EA/Respawn. Reference revision from the source catalog; not live player telemetry or a confirmed event map.",
    },
    {
      id: "mp_rr_arena_habitat",
      name: "Habitat 4",
      image: "https://apexlegendsstatus.com/systems/interactive-map/imgs/mp_rr_arena_habitat.png",
      imageBytes: 16792039,
      sourceUrl: "https://apexlegendsstatus.com/interactive-map/mp_rr_arena_habitat",
      sourceLabel: "Apex Legends Status · overhead map",
      kind: "map",
      notes:
        "Extracted game map served by Apex Legends Status. Artwork © EA/Respawn. Reference revision from the source catalog; not live player telemetry or a confirmed event map.",
    },
    {
      id: "mp_rr_desertlands_mu5",
      name: "Worlds Edge",
      image: "https://apexlegendsstatus.com/systems/interactive-map/imgs/mp_rr_desertlands_mu5.png",
      imageBytes: 14299365,
      sourceUrl: "https://apexlegendsstatus.com/interactive-map/mp_rr_desertlands_mu5",
      sourceLabel: "Apex Legends Status · overhead map",
      kind: "map",
      notes:
        "Extracted game map served by Apex Legends Status. Artwork © EA/Respawn. Reference revision from the source catalog; not live player telemetry or a confirmed event map.",
    },
    {
      id: "mp_rr_canyonlands_hu",
      name: "Kings Canyon",
      image: "https://apexlegendsstatus.com/systems/interactive-map/imgs/mp_rr_canyonlands_hu.png",
      imageBytes: 16088650,
      sourceUrl: "https://apexlegendsstatus.com/interactive-map/mp_rr_canyonlands_hu",
      sourceLabel: "Apex Legends Status · overhead map",
      kind: "map",
      notes:
        "Extracted game map served by Apex Legends Status. Artwork © EA/Respawn. Reference revision from the source catalog; not live player telemetry or a confirmed event map.",
    },
    {
      id: "mp_rr_district",
      name: "E-District",
      image: "https://apexlegendsstatus.com/systems/interactive-map/imgs/mp_rr_district.png",
      imageBytes: 14184414,
      sourceUrl: "https://apexlegendsstatus.com/interactive-map/mp_rr_district",
      sourceLabel: "Apex Legends Status · overhead map",
      kind: "map",
      notes:
        "Extracted game map served by Apex Legends Status. Artwork © EA/Respawn. Reference revision from the source catalog; not live player telemetry or a confirmed event map.",
    },
    {
      id: "mp_rr_divided_moon_mu1",
      name: "Broken Moon",
      image:
        "https://apexlegendsstatus.com/systems/interactive-map/imgs/mp_rr_divided_moon_mu1.png",
      imageBytes: 15867206,
      sourceUrl: "https://apexlegendsstatus.com/interactive-map/mp_rr_divided_moon_mu1",
      sourceLabel: "Apex Legends Status · overhead map",
      kind: "map",
      notes:
        "Extracted game map served by Apex Legends Status. Artwork © EA/Respawn. Reference revision from the source catalog; not live player telemetry or a confirmed event map.",
    },
    {
      id: "mp_rr_tropic_island_mu2",
      name: "Storm Point",
      image: "https://apexlegendsstatus.com/systems/interactive-map/imgs/0x84c6b147c0e512c8.png",
      imageBytes: 16292288,
      sourceUrl: "https://apexlegendsstatus.com/interactive-map/mp_rr_tropic_island_mu2",
      sourceLabel: "Apex Legends Status · overhead map",
      kind: "map",
      notes:
        "Extracted game map served by Apex Legends Status. Artwork © EA/Respawn. Reference revision from the source catalog; not live player telemetry or a confirmed event map.",
    },
    {
      id: "mp_rr_olympus_mu3",
      name: "Olympus",
      image: "https://apexlegendsstatus.com/systems/interactive-map/imgs/mp_rr_olympus_mu3.png",
      imageBytes: 12397196,
      sourceUrl: "https://apexlegendsstatus.com/interactive-map/mp_rr_olympus_mu3",
      sourceLabel: "Apex Legends Status · overhead map",
      kind: "map",
      notes:
        "Extracted game map served by Apex Legends Status. Artwork © EA/Respawn. Reference revision from the source catalog; not live player telemetry or a confirmed event map.",
    },
    {
      id: "mp_rr_party_crasher",
      name: "Party Crasher",
      image: "https://apexlegendsstatus.com/systems/interactive-map/imgs/mp_rr_party_crasher.png",
      imageBytes: 18604831,
      sourceUrl: "https://apexlegendsstatus.com/interactive-map/mp_rr_party_crasher",
      sourceLabel: "Apex Legends Status · overhead map",
      kind: "map",
      notes:
        "Extracted game map served by Apex Legends Status. Artwork © EA/Respawn. Reference revision from the source catalog; not live player telemetry or a confirmed event map.",
    },
  ],
  pubg: pubgNames.map((name) => ({
    id: name.toLowerCase().replaceAll("_", "-"),
    name: name.replaceAll("_", " "),
    image: `https://raw.githubusercontent.com/pubg/api-assets/master/Assets/Maps/${name}_Main_Low_Res.png`,
    sourceUrl: "https://github.com/pubg/api-assets/tree/master/Assets/Maps",
    sourceLabel: "KRAFTON · PUBG API assets",
    kind: "map",
    notes:
      "Official reference asset, not a guarantee of the current match revision. Subject to PUBG API Terms and Content Creation Guideline.",
  })),
  fortnite: [
    {
      id: "fortnite-current-br",
      name: "Current Battle Royale island",
      image: "https://fortnite-api.com/images/map.png",
      sourceUrl: "https://fortnite-api.com/v1/map",
      sourceLabel: "Fortnite-API · current minimap",
      kind: "map",
      notes:
        "Provider-updated current Battle Royale reference map, not historical tournaments or every creator island. Map artwork © Epic Games; Fortnite-API is an independent community service. No player telemetry is supplied by this endpoint.",
    },
    {
      id: "fortnite-islands",
      name: "Fortnite island directory",
      sourceUrl: "https://www.fortnite.com/categories/br",
      sourceLabel: "Epic Games · islands",
      kind: "map",
      notes:
        "Islands and seasonal layouts change. No complete licensed overhead catalog verified; do not substitute an old island for a current match.",
    },
  ],
  starcraft2: [
    {
      id: "dusk-towers",
      name: "Dusk Towers · 2015 layout",
      image: "https://bnetcmsus-a.akamaihd.net/cms/gallery/MM4PLVEEA6M11447268339153.jpg",
      sourceUrl:
        "https://news.blizzard.com/en-us/article/19956941/legacy-of-the-void-ladder-map-pool",
      sourceLabel: "Blizzard · Legacy of the Void map",
      kind: "map",
      notes:
        "Official overhead artwork © Blizzard Entertainment. Historical 2015 reference, not the current competitive pool or live unit positions.",
    },
    {
      id: "prion-terraces",
      name: "Prion Terraces · 2015 layout",
      image: "https://bnetcmsus-a.akamaihd.net/cms/gallery/93NA1NQLN2BE1447268339162.jpg",
      sourceUrl:
        "https://news.blizzard.com/en-us/article/19956941/legacy-of-the-void-ladder-map-pool",
      sourceLabel: "Blizzard · Legacy of the Void map",
      kind: "map",
      notes:
        "Official overhead artwork © Blizzard Entertainment. Historical 2015 reference, not the current competitive pool or live unit positions.",
    },
    {
      id: "ulrena",
      name: "Ulrena · 2015 layout",
      image: "https://bnetcmsus-a.akamaihd.net/cms/gallery/CACE4XSULNQK1447268339540.jpg",
      sourceUrl:
        "https://news.blizzard.com/en-us/article/19956941/legacy-of-the-void-ladder-map-pool",
      sourceLabel: "Blizzard · Legacy of the Void map",
      kind: "map",
      notes:
        "Official overhead artwork © Blizzard Entertainment. Historical 2015 reference, not the current competitive pool or live unit positions.",
    },
    {
      id: "central-protocol",
      name: "Central Protocol · 2015 layout",
      image: "https://bnetcmsus-a.akamaihd.net/cms/gallery/4D9ZZXAHUXVC1447268339646.jpg",
      sourceUrl:
        "https://news.blizzard.com/en-us/article/19956941/legacy-of-the-void-ladder-map-pool",
      sourceLabel: "Blizzard · Legacy of the Void map",
      kind: "map",
      notes:
        "Official overhead artwork © Blizzard Entertainment. Historical 2015 reference, not the current competitive pool or live unit positions.",
    },
    {
      id: "fields-of-death",
      name: "Fields of Death · 2015 layout",
      image: "https://bnetcmsus-a.akamaihd.net/cms/gallery/GIUIYYZOF3L51447268339829.jpg",
      sourceUrl:
        "https://news.blizzard.com/en-us/article/19956941/legacy-of-the-void-ladder-map-pool",
      sourceLabel: "Blizzard · Legacy of the Void map",
      kind: "map",
      notes:
        "Official overhead artwork © Blizzard Entertainment. Historical 2015 reference, not the current competitive pool or live unit positions.",
    },
    {
      id: "distant-plane",
      name: "Distant Plane · 2015 layout",
      image: "https://bnetcmsus-a.akamaihd.net/cms/gallery/1D3NC0SELWST1447268340312.jpg",
      sourceUrl:
        "https://news.blizzard.com/en-us/article/19956941/legacy-of-the-void-ladder-map-pool",
      sourceLabel: "Blizzard · Legacy of the Void map",
      kind: "map",
      notes:
        "Official overhead artwork © Blizzard Entertainment. Historical 2015 reference, not the current competitive pool or live unit positions.",
    },
  ],
};

export const PUBG_MAP_TERMS = {
  terms: "https://developer.pubg.com/tos",
  content: "https://pubg.com/en/clause/content_creation_guideline",
  attribution:
    "PUBG map artwork © KRAFTON, Inc. Harbor is not affiliated with or endorsed by KRAFTON.",
} as const;
