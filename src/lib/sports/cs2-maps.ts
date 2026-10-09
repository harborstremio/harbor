import type { EsportsMapDef } from "./esports-map-data";

// Actual Valve game-depot radar extractions, snapshot 73fb0ba378e4183603eb4d8c4842340dc32eb877.
// Original image pixels and aspect ratios are preserved. Map revisions are references, not event selections.
export const CS2_MAPS: EsportsMapDef[] = [
  {
    id: "de_dust2",
    name: "Dust II",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_dust2_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_dust2_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_mirage",
    name: "Mirage",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_mirage_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_mirage_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_inferno",
    name: "Inferno",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_inferno_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_inferno_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_nuke",
    name: "Nuke",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_nuke_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_nuke_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
    layers: [
      {
        name: "Main level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_nuke_radar_psd.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_nuke_radar_psd.png",
      },
      {
        name: "Lower level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_nuke_lower_radar_psd.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_nuke_lower_radar_psd.png",
      },
    ],
  },
  {
    id: "de_ancient",
    name: "Ancient",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_ancient_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_ancient_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_anubis",
    name: "Anubis",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_anubis_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_anubis_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_overpass",
    name: "Overpass",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_overpass_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_overpass_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_train",
    name: "Train",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_train_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_train_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
    layers: [
      {
        name: "Main level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_train_radar_psd.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_train_radar_psd.png",
      },
      {
        name: "Lower level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_train_lower_radar_psd.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_train_lower_radar_psd.png",
      },
    ],
  },
  {
    id: "de_vertigo",
    name: "Vertigo",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_vertigo_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_vertigo_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
    layers: [
      {
        name: "Main level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_vertigo_radar_psd.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_vertigo_radar_psd.png",
      },
      {
        name: "Lower level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_vertigo_lower_radar_psd.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_vertigo_lower_radar_psd.png",
      },
    ],
  },
  {
    id: "de_cache",
    name: "Cache",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_cache_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_cache_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
    layers: [
      {
        name: "Main level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_cache_radar_psd.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_cache_radar_psd.png",
      },
      {
        name: "Main level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_cache_radar_tga.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_cache_radar_tga.png",
      },
    ],
  },
  {
    id: "de_ancient_night",
    name: "Ancient (Night)",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_ancient_night_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_ancient_night_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "ar_baggage",
    name: "Baggage",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/ar_baggage_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/ar_baggage_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
    layers: [
      {
        name: "Main level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/ar_baggage_radar_psd.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/ar_baggage_radar_psd.png",
      },
      {
        name: "Lower level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/ar_baggage_lower_radar_psd.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/ar_baggage_lower_radar_psd.png",
      },
    ],
  },
  {
    id: "de_boulder",
    name: "Boulder",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_boulder_radar_tga.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_boulder_radar_tga.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
    layers: [
      {
        name: "Main level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_boulder_radar_tga.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_boulder_radar_tga.png",
      },
      {
        name: "Upper level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_boulder_higher1_radar_tga.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_boulder_higher1_radar_tga.png",
      },
    ],
  },
  {
    id: "de_debris",
    name: "Debris",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_debris_radar_tga.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_debris_radar_tga.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_dogtown",
    name: "Dogtown",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_dogtown_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_dogtown_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_dust",
    name: "Dust",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_dust_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_dust_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_edin",
    name: "Edin",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_edin_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_edin_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_eldorado",
    name: "El Dorado",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_eldorado_radar_tga.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_eldorado_radar_tga.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_fachwerk",
    name: "Fachwerk",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_fachwerk_radar_tga.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_fachwerk_radar_tga.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_golden",
    name: "Golden",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_golden_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_golden_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_grail",
    name: "Grail",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_grail_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_grail_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "cs_italy",
    name: "Italy",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/cs_italy_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/cs_italy_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_jura",
    name: "Jura",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_jura_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_jura_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_lake",
    name: "Lake",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_lake_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_lake_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_memento",
    name: "Memento",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_memento_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_memento_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_mills",
    name: "Mills",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_mills_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_mills_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "cs_office",
    name: "Office",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/cs_office_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/cs_office_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_palacio",
    name: "Palacio",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_palacio_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_palacio_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_palais",
    name: "Palais",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_palais_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_palais_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_poseidon",
    name: "Poseidon",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_poseidon_radar_tga.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_poseidon_radar_tga.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
    layers: [
      {
        name: "Main level",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_poseidon_radar_tga.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_poseidon_radar_tga.png",
      },
      {
        name: "Spectator radar",
        image:
          "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_poseidon_radar_spectate_tga.png",
        fallbackImage:
          "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_poseidon_radar_spectate_tga.png",
      },
    ],
  },
  {
    id: "de_rooftop",
    name: "Rooftop",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_rooftop_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_rooftop_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "cs_shelter",
    name: "Shelter",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/cs_shelter_radar_tga.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/cs_shelter_radar_tga.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "ar_shoots",
    name: "Shoots (Day)",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/ar_shoots_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/ar_shoots_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "ar_shoots_night",
    name: "Shoots (Night)",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/ar_shoots_night_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/ar_shoots_night_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_sugarcane",
    name: "Sugarcane",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_sugarcane_radar_psd.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_sugarcane_radar_psd.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_thera",
    name: "Thera",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_thera_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_thera_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_transit",
    name: "Transit",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_transit_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_transit_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
  {
    id: "de_whistle",
    name: "Whistle",
    image:
      "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_whistle_radar.png",
    fallbackImage:
      "https://cdn.jsdelivr.net/gh/MurkyYT/cs2-map-icons@73fb0ba378e4183603eb4d8c4842340dc32eb877/images/radars/de_whistle_radar.png",
    source: "https://github.com/MurkyYT/cs2-map-icons",
    sourceLabel: "Valve radar · asset source",
  },
];
