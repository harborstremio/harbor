/** Country tags describe listening scenes, not exclusive origins or artist nationality. */
export type MusicGenreFamily = 'popular' | 'electronic' | 'guitars' | 'roots' | 'latin' | 'africa' | 'asia' | 'world';
export type MusicDiscoveryGenre = {
  id: number; slug: string; name: string; family: MusicGenreFamily;
  countries: string[]; aliases: string[]; deezerId?: number;
  searchHints?: string[];
  picture_big?: string; picture_medium?: string;
};
// IDs are persistent taste identities. Never derive them from the array index.
export const MUSIC_GENRES: MusicDiscoveryGenre[] = [
  {
    "id": 132,
    "slug": "pop",
    "name": "Pop",
    "family": "popular",
    "countries": [
      "US",
      "GB"
    ],
    "aliases": [],
    "deezerId": 132
  },
  {
    "id": 116,
    "slug": "hip-hop",
    "name": "Hip-hop",
    "family": "popular",
    "countries": [
      "US",
      "FR",
      "GB"
    ],
    "aliases": [
      "Rap"
    ],
    "deezerId": 116
  },
  {
    "id": 152,
    "slug": "rock",
    "name": "Rock",
    "family": "guitars",
    "countries": [
      "US",
      "GB"
    ],
    "aliases": [],
    "deezerId": 152
  },
  {
    "id": 165,
    "slug": "rnb",
    "name": "R&B",
    "family": "popular",
    "countries": [
      "US",
      "GB"
    ],
    "aliases": [
      "Rhythm and blues"
    ],
    "deezerId": 165
  },
  {
    "id": 10001,
    "slug": "nightcore",
    "name": "Nightcore",
    "family": "electronic",
    "countries": [
      "NO"
    ],
    "aliases": [
      "Sped up"
    ]
  },
  {
    "id": 10002,
    "slug": "jumpstyle",
    "name": "Jumpstyle",
    "family": "electronic",
    "countries": [
      "BE",
      "NL"
    ],
    "aliases": [
      "Jump style"
    ]
  },
  {
    "id": 10003,
    "slug": "hardstyle",
    "name": "Hardstyle",
    "family": "electronic",
    "countries": [
      "NL",
      "AU"
    ],
    "aliases": [
      "Hard dance"
    ]
  },
  {
    "id": 10004,
    "slug": "funk-carioca",
    "name": "Funk carioca",
    "family": "latin",
    "countries": [
      "BR"
    ],
    "aliases": [
      "Baile funk",
      "Brazilian funk",
      "Funk brasileiro"
    ]
  },
  {
    "id": 10005,
    "slug": "pagode",
    "name": "Pagode",
    "family": "latin",
    "countries": [
      "BR"
    ],
    "aliases": []
  },
  {
    "id": 10006,
    "slug": "amapiano",
    "name": "Amapiano",
    "family": "africa",
    "countries": [
      "ZA"
    ],
    "aliases": []
  },
  {
    "id": 10007,
    "slug": "k-pop",
    "name": "K-pop",
    "family": "asia",
    "countries": [
      "KR"
    ],
    "aliases": [
      "Korean pop"
    ]
  },
  {
    "id": 10008,
    "slug": "j-pop",
    "name": "J-pop",
    "family": "asia",
    "countries": [
      "JP"
    ],
    "aliases": [
      "Japanese pop"
    ]
  },
  {
    "id": 122,
    "slug": "reggaeton",
    "name": "Reggaetón",
    "family": "latin",
    "countries": [
      "PR",
      "PA"
    ],
    "aliases": [
      "Reggaeton"
    ],
    "deezerId": 122
  },
  {
    "id": 106,
    "slug": "electronic",
    "name": "Electronic",
    "family": "electronic",
    "countries": [],
    "aliases": [
      "Electro",
      "Electronica"
    ],
    "deezerId": 106
  },
  {
    "id": 113,
    "slug": "dance",
    "name": "Dance",
    "family": "electronic",
    "countries": [],
    "aliases": [
      "EDM"
    ],
    "deezerId": 113
  },
  {
    "id": 85,
    "slug": "alternative",
    "name": "Alternative",
    "family": "guitars",
    "countries": [],
    "aliases": [
      "Alt rock"
    ],
    "deezerId": 85
  },
  {
    "id": 10009,
    "slug": "afrobeats",
    "name": "Afrobeats",
    "family": "africa",
    "countries": [
      "NG",
      "GH"
    ],
    "aliases": [
      "Afro pop"
    ]
  },
  {
    "id": 10010,
    "slug": "house",
    "name": "House",
    "family": "electronic",
    "countries": [
      "US",
      "GB"
    ],
    "aliases": []
  },
  {
    "id": 10011,
    "slug": "techno",
    "name": "Techno",
    "family": "electronic",
    "countries": [
      "US",
      "DE"
    ],
    "aliases": []
  },
  {
    "id": 10012,
    "slug": "drum-and-bass",
    "name": "Drum & bass",
    "family": "electronic",
    "countries": [
      "GB"
    ],
    "aliases": [
      "DnB",
      "Drum and bass"
    ]
  },
  {
    "id": 10013,
    "slug": "phonk",
    "name": "Phonk",
    "family": "electronic",
    "countries": [
      "US"
    ],
    "aliases": [
      "Drift phonk"
    ]
  },
  {
    "id": 10014,
    "slug": "hyperpop",
    "name": "Hyperpop",
    "family": "popular",
    "countries": [
      "GB",
      "US"
    ],
    "aliases": []
  },
  {
    "id": 10015,
    "slug": "trap",
    "name": "Trap",
    "family": "popular",
    "countries": [
      "US"
    ],
    "aliases": []
  },
  {
    "id": 10016,
    "slug": "indie-pop",
    "name": "Indie pop",
    "family": "popular",
    "countries": [],
    "aliases": []
  },
  {
    "id": 129,
    "slug": "jazz",
    "name": "Jazz",
    "family": "roots",
    "countries": [
      "US"
    ],
    "aliases": [],
    "deezerId": 129
  },
  {
    "id": 169,
    "slug": "soul-funk",
    "name": "Soul & funk",
    "family": "roots",
    "countries": [
      "US"
    ],
    "aliases": [],
    "deezerId": 169
  },
  {
    "id": 98,
    "slug": "classical",
    "name": "Classical",
    "family": "roots",
    "countries": [],
    "aliases": [
      "Orchestral"
    ],
    "deezerId": 98
  },
  {
    "id": 464,
    "slug": "metal",
    "name": "Metal",
    "family": "guitars",
    "countries": [
      "GB",
      "US"
    ],
    "aliases": [
      "Heavy metal"
    ],
    "deezerId": 464
  },
  {
    "id": 84,
    "slug": "country",
    "name": "Country",
    "family": "roots",
    "countries": [
      "US"
    ],
    "aliases": [],
    "deezerId": 84
  },
  {
    "id": 153,
    "slug": "blues",
    "name": "Blues",
    "family": "roots",
    "countries": [
      "US"
    ],
    "aliases": [],
    "deezerId": 153
  },
  {
    "id": 466,
    "slug": "folk",
    "name": "Folk",
    "family": "roots",
    "countries": [],
    "aliases": [],
    "deezerId": 466
  },
  {
    "id": 144,
    "slug": "reggae",
    "name": "Reggae",
    "family": "latin",
    "countries": [
      "JM"
    ],
    "aliases": [],
    "deezerId": 144
  },
  {
    "id": 10017,
    "slug": "samba",
    "name": "Samba",
    "family": "latin",
    "countries": [
      "BR"
    ],
    "aliases": []
  },
  {
    "id": 10018,
    "slug": "bossa-nova",
    "name": "Bossa nova",
    "family": "latin",
    "countries": [
      "BR"
    ],
    "aliases": []
  },
  {
    "id": 10019,
    "slug": "sertanejo",
    "name": "Sertanejo",
    "family": "latin",
    "countries": [
      "BR"
    ],
    "aliases": [
      "Sertanejo universitario"
    ]
  },
  {
    "id": 10020,
    "slug": "forro",
    "name": "Forró",
    "family": "latin",
    "countries": [
      "BR"
    ],
    "aliases": [
      "Forro"
    ]
  },
  {
    "id": 10021,
    "slug": "mpb",
    "name": "MPB",
    "family": "latin",
    "countries": [
      "BR"
    ],
    "aliases": [
      "Musica popular brasileira"
    ]
  },
  {
    "id": 10022,
    "slug": "piseiro",
    "name": "Piseiro",
    "family": "latin",
    "countries": [
      "BR"
    ],
    "aliases": [
      "Pisadinha"
    ]
  },
  {
    "id": 10023,
    "slug": "axe",
    "name": "Axé",
    "family": "latin",
    "countries": [
      "BR"
    ],
    "aliases": [
      "Axe music"
    ]
  },
  {
    "id": 10024,
    "slug": "brazilian-trap",
    "name": "Brazilian trap",
    "family": "latin",
    "countries": [
      "BR"
    ],
    "aliases": [
      "Trap brasileiro",
      "Trap BR"
    ]
  },
  {
    "id": 67,
    "slug": "salsa",
    "name": "Salsa",
    "family": "latin",
    "countries": [
      "CU",
      "PR",
      "US"
    ],
    "aliases": [],
    "deezerId": 67
  },
  {
    "id": 71,
    "slug": "cumbia",
    "name": "Cumbia",
    "family": "latin",
    "countries": [
      "CO",
      "MX",
      "AR"
    ],
    "aliases": [],
    "deezerId": 71
  },
  {
    "id": 65,
    "slug": "regional-mexican",
    "name": "Regional Mexican",
    "family": "latin",
    "countries": [
      "MX"
    ],
    "aliases": [
      "Musica mexicana",
      "Regional mexicano"
    ],
    "deezerId": 65
  },
  {
    "id": 10025,
    "slug": "bachata",
    "name": "Bachata",
    "family": "latin",
    "countries": [
      "DO"
    ],
    "aliases": []
  },
  {
    "id": 10026,
    "slug": "merengue",
    "name": "Merengue",
    "family": "latin",
    "countries": [
      "DO"
    ],
    "aliases": []
  },
  {
    "id": 10027,
    "slug": "dembow",
    "name": "Dembow",
    "family": "latin",
    "countries": [
      "DO"
    ],
    "aliases": []
  },
  {
    "id": 10028,
    "slug": "corridos-tumbados",
    "name": "Corridos tumbados",
    "family": "latin",
    "countries": [
      "MX"
    ],
    "aliases": []
  },
  {
    "id": 10029,
    "slug": "mariachi",
    "name": "Mariachi",
    "family": "latin",
    "countries": [
      "MX"
    ],
    "aliases": []
  },
  {
    "id": 10030,
    "slug": "banda",
    "name": "Banda",
    "family": "latin",
    "countries": [
      "MX"
    ],
    "aliases": [
      "Banda sinaloense"
    ]
  },
  {
    "id": 10031,
    "slug": "norteno",
    "name": "Norteño",
    "family": "latin",
    "countries": [
      "MX"
    ],
    "aliases": [
      "Norteno"
    ]
  },
  {
    "id": 10032,
    "slug": "latin-trap",
    "name": "Latin trap",
    "family": "latin",
    "countries": [
      "PR",
      "AR"
    ],
    "aliases": [
      "Trap latino"
    ]
  },
  {
    "id": 10033,
    "slug": "reggae-en-espanol",
    "name": "Reggae en español",
    "family": "latin",
    "countries": [
      "PA"
    ],
    "aliases": [
      "Reggae en espanol"
    ]
  },
  {
    "id": 10034,
    "slug": "dancehall",
    "name": "Dancehall",
    "family": "latin",
    "countries": [
      "JM"
    ],
    "aliases": []
  },
  {
    "id": 10035,
    "slug": "soca",
    "name": "Soca",
    "family": "latin",
    "countries": [
      "TT"
    ],
    "aliases": []
  },
  {
    "id": 10036,
    "slug": "dub",
    "name": "Dub",
    "family": "latin",
    "countries": [
      "JM",
      "GB"
    ],
    "aliases": []
  },
  {
    "id": 10037,
    "slug": "kompa",
    "name": "Kompa",
    "family": "latin",
    "countries": [
      "HT"
    ],
    "aliases": [
      "Compas"
    ]
  },
  {
    "id": 10038,
    "slug": "zouk",
    "name": "Zouk",
    "family": "latin",
    "countries": [
      "GP",
      "MQ"
    ],
    "aliases": []
  },
  {
    "id": 10039,
    "slug": "gqom",
    "name": "Gqom",
    "family": "africa",
    "countries": [
      "ZA"
    ],
    "aliases": []
  },
  {
    "id": 10040,
    "slug": "kwaito",
    "name": "Kwaito",
    "family": "africa",
    "countries": [
      "ZA"
    ],
    "aliases": []
  },
  {
    "id": 10041,
    "slug": "highlife",
    "name": "Highlife",
    "family": "africa",
    "countries": [
      "GH",
      "NG"
    ],
    "aliases": []
  },
  {
    "id": 10042,
    "slug": "afrobeat",
    "name": "Afrobeat",
    "family": "africa",
    "countries": [
      "NG",
      "GH"
    ],
    "aliases": []
  },
  {
    "id": 10043,
    "slug": "bongo-flava",
    "name": "Bongo flava",
    "family": "africa",
    "countries": [
      "TZ"
    ],
    "aliases": []
  },
  {
    "id": 10044,
    "slug": "singeli",
    "name": "Singeli",
    "family": "africa",
    "countries": [
      "TZ"
    ],
    "aliases": []
  },
  {
    "id": 10045,
    "slug": "gengetone",
    "name": "Gengetone",
    "family": "africa",
    "countries": [
      "KE"
    ],
    "aliases": []
  },
  {
    "id": 10046,
    "slug": "soukous",
    "name": "Soukous",
    "family": "africa",
    "countries": [
      "CD",
      "CG"
    ],
    "aliases": []
  },
  {
    "id": 10047,
    "slug": "kuduro",
    "name": "Kuduro",
    "family": "africa",
    "countries": [
      "AO"
    ],
    "aliases": []
  },
  {
    "id": 10048,
    "slug": "kizomba",
    "name": "Kizomba",
    "family": "africa",
    "countries": [
      "AO"
    ],
    "aliases": []
  },
  {
    "id": 10049,
    "slug": "rai",
    "name": "Raï",
    "family": "africa",
    "countries": [
      "DZ"
    ],
    "aliases": [
      "Rai"
    ]
  },
  {
    "id": 10050,
    "slug": "gnawa",
    "name": "Gnawa",
    "family": "africa",
    "countries": [
      "MA"
    ],
    "aliases": [
      "Gnaoua"
    ]
  },
  {
    "id": 10051,
    "slug": "mbalax",
    "name": "Mbalax",
    "family": "africa",
    "countries": [
      "SN"
    ],
    "aliases": []
  },
  {
    "id": 10052,
    "slug": "city-pop",
    "name": "City pop",
    "family": "asia",
    "countries": [
      "JP"
    ],
    "aliases": []
  },
  {
    "id": 10053,
    "slug": "j-rock",
    "name": "J-rock",
    "family": "asia",
    "countries": [
      "JP"
    ],
    "aliases": [
      "Japanese rock"
    ]
  },
  {
    "id": 10054,
    "slug": "anime",
    "name": "Anime",
    "family": "asia",
    "countries": [
      "JP"
    ],
    "aliases": [
      "Anisong"
    ]
  },
  {
    "id": 10055,
    "slug": "vocaloid",
    "name": "Vocaloid",
    "family": "asia",
    "countries": [
      "JP"
    ],
    "aliases": [
      "Hatsune Miku"
    ]
  },
  {
    "id": 10056,
    "slug": "cantopop",
    "name": "Cantopop",
    "family": "asia",
    "countries": [
      "HK"
    ],
    "aliases": [
      "Cantonese pop"
    ]
  },
  {
    "id": 10057,
    "slug": "mandopop",
    "name": "Mandopop",
    "family": "asia",
    "countries": [
      "TW",
      "CN"
    ],
    "aliases": [
      "Mandarin pop"
    ]
  },
  {
    "id": 10058,
    "slug": "opm",
    "name": "OPM",
    "family": "asia",
    "countries": [
      "PH"
    ],
    "aliases": [
      "Original Pilipino music",
      "P-pop"
    ]
  },
  {
    "id": 10059,
    "slug": "v-pop",
    "name": "V-pop",
    "family": "asia",
    "countries": [
      "VN"
    ],
    "aliases": [
      "Vietnamese pop"
    ]
  },
  {
    "id": 10060,
    "slug": "thai-pop",
    "name": "Thai pop",
    "family": "asia",
    "countries": [
      "TH"
    ],
    "aliases": [
      "T-pop"
    ]
  },
  {
    "id": 10061,
    "slug": "dangdut",
    "name": "Dangdut",
    "family": "asia",
    "countries": [
      "ID"
    ],
    "aliases": []
  },
  {
    "id": 10062,
    "slug": "indonesian-pop",
    "name": "Indonesian pop",
    "family": "asia",
    "countries": [
      "ID"
    ],
    "aliases": [
      "Indo pop"
    ]
  },
  {
    "id": 10063,
    "slug": "bollywood",
    "name": "Bollywood",
    "family": "asia",
    "countries": [
      "IN"
    ],
    "aliases": [
      "Hindi film"
    ]
  },
  {
    "id": 10064,
    "slug": "punjabi",
    "name": "Punjabi",
    "family": "asia",
    "countries": [
      "IN",
      "PK"
    ],
    "aliases": []
  },
  {
    "id": 10065,
    "slug": "bhangra",
    "name": "Bhangra",
    "family": "asia",
    "countries": [
      "IN",
      "GB"
    ],
    "aliases": []
  },
  {
    "id": 10066,
    "slug": "qawwali",
    "name": "Qawwali",
    "family": "asia",
    "countries": [
      "PK",
      "IN"
    ],
    "aliases": []
  },
  {
    "id": 10067,
    "slug": "carnatic",
    "name": "Carnatic",
    "family": "asia",
    "countries": [
      "IN"
    ],
    "aliases": [
      "Karnatik"
    ]
  },
  {
    "id": 10068,
    "slug": "hindustani",
    "name": "Hindustani classical",
    "family": "asia",
    "countries": [
      "IN"
    ],
    "aliases": []
  },
  {
    "id": 10069,
    "slug": "uk-garage",
    "name": "UK garage",
    "family": "electronic",
    "countries": [
      "GB"
    ],
    "aliases": [
      "UKG",
      "2-step"
    ]
  },
  {"id": 10116, "slug": "chicago-drill", "name": "Chicago drill", "family": "popular", "countries": ["US"], "aliases": ["Drill Chicago"]},
  {"id": 10117, "slug": "new-york-drill", "name": "New York drill", "family": "popular", "countries": ["US"], "aliases": ["Brooklyn drill", "NY drill", "Drill New York"]},
  {"id": 10118, "slug": "east-coast-hip-hop", "name": "East Coast hip hop", "family": "popular", "countries": ["US"], "aliases": ["East Coast rap", "East Coast essentials"]},
  {"id": 10119, "slug": "west-coast-hip-hop", "name": "West Coast hip hop", "family": "popular", "countries": ["US"], "aliases": ["West Coast rap", "West Coast essentials"]},
  {"id": 10120, "slug": "southern-hip-hop", "name": "Southern hip hop", "family": "popular", "countries": ["US"], "aliases": ["Southern rap", "Dirty South", "South Side essentials"]},
  {"id": 10121, "slug": "atlanta-rap", "name": "Atlanta rap", "family": "popular", "countries": ["US"], "aliases": ["Atlanta trap"]},
  {"id": 10122, "slug": "houston-rap", "name": "Houston rap", "family": "popular", "countries": ["US"], "aliases": []},
  {"id": 10123, "slug": "memphis-rap", "name": "Memphis rap", "family": "popular", "countries": ["US"], "aliases": ["Memphis underground rap"]},
  {"id": 10124, "slug": "detroit-rap", "name": "Detroit rap", "family": "popular", "countries": ["US"], "aliases": ["Detroit Flint Michigan rap"]},
  {"id": 10125, "slug": "bay-area-rap", "name": "Bay Area rap", "family": "popular", "countries": ["US"], "aliases": ["Hyphy"]},
  {"id": 10126, "slug": "g-funk", "name": "G-funk", "family": "popular", "countries": ["US"], "aliases": ["G funk"]},
  {"id": 10127, "slug": "boom-bap", "name": "Boom bap", "family": "popular", "countries": ["US"], "aliases": ["Boombap"]},
  {"id": 10128, "slug": "jazz-rap", "name": "Jazz rap", "family": "popular", "countries": ["US"], "aliases": ["Jazzy hip hop", "Jazz hip hop"]},
  {"id": 10129, "slug": "conscious-hip-hop", "name": "Conscious hip hop", "family": "popular", "countries": ["US"], "aliases": ["Conscious rap"]},
  {"id": 10130, "slug": "alternative-hip-hop", "name": "Alternative hip hop", "family": "popular", "countries": ["US"], "aliases": ["Alternative rap"]},
  {"id": 10131, "slug": "crunk", "name": "Crunk", "family": "popular", "countries": ["US"], "aliases": []},
  {"id": 10132, "slug": "miami-bass", "name": "Miami bass", "family": "popular", "countries": ["US"], "aliases": ["Miami booty bass"]},
  {"id": 10133, "slug": "chopped-and-screwed", "name": "Chopped and screwed", "family": "popular", "countries": ["US"], "aliases": ["Chopped & screwed", "Screwed and chopped"]},
  {
    "id": 10070,
    "slug": "grime",
    "name": "Grime",
    "family": "popular",
    "countries": [
      "GB"
    ],
    "aliases": []
  },
  {
    "id": 10071,
    "slug": "uk-drill",
    "name": "UK drill",
    "family": "popular",
    "countries": [
      "GB"
    ],
    "aliases": []
  },
  {
    "id": 10072,
    "slug": "french-rap",
    "name": "French rap",
    "family": "popular",
    "countries": [
      "FR"
    ],
    "aliases": [
      "Rap francais",
      "Rap français"
    ]
  },
  {
    "id": 10073,
    "slug": "german-rap",
    "name": "German rap",
    "family": "popular",
    "countries": [
      "DE"
    ],
    "aliases": [
      "Deutschrap"
    ]
  },
  { id: 10110, slug: 'ukrainian-rap', name: 'Ukrainian rap', family: 'popular', countries: ['UA'], aliases: ['Український реп','Ukrainian hip hop'], searchHints: ['YARMAK','SKOFKA','Kalush','alyona alyona','ТНМК','OTOY'] },
  { id: 10111, slug: 'ukrainian-wartime', name: 'Ukrainian wartime music', family: 'world', countries: ['UA'], aliases: ['Ukrainian war songs','Пісні війни'], searchHints: ['OTOY','YARMAK','Варнак','Ницо Потворно','Третя Штурмова','хейтспіч','паліндром','ЕНЕМІ','ОКОЛОФРОНТ','Військовий реп'] },
  {
    "id": 10074,
    "slug": "turkish-rap",
    "name": "Turkish rap",
    "family": "popular",
    "countries": [
      "TR"
    ],
    "aliases": [
      "Turkce rap",
      "Türkçe rap"
    ]
  },
  {
    "id": 10075,
    "slug": "arabic-pop",
    "name": "Arabic pop",
    "family": "world",
    "countries": [
      "EG",
      "LB"
    ],
    "aliases": [
      "Arab pop"
    ]
  },
  {
    "id": 10076,
    "slug": "mahraganat",
    "name": "Mahraganat",
    "family": "world",
    "countries": [
      "EG"
    ],
    "aliases": [
      "Electro shaabi"
    ]
  },
  {
    "id": 10077,
    "slug": "turkish-pop",
    "name": "Turkish pop",
    "family": "world",
    "countries": [
      "TR"
    ],
    "aliases": [
      "Türkçe pop"
    ]
  },
  {
    "id": 10078,
    "slug": "persian-pop",
    "name": "Persian pop",
    "family": "world",
    "countries": [
      "IR"
    ],
    "aliases": [
      "Farsi pop"
    ]
  },
  {
    "id": 10079,
    "slug": "flamenco",
    "name": "Flamenco",
    "family": "world",
    "countries": [
      "ES"
    ],
    "aliases": []
  },
  {
    "id": 10080,
    "slug": "fado",
    "name": "Fado",
    "family": "world",
    "countries": [
      "PT"
    ],
    "aliases": []
  },
  {
    "id": 10081,
    "slug": "chanson",
    "name": "Chanson",
    "family": "world",
    "countries": [
      "FR",
      "BE"
    ],
    "aliases": []
  },
  {
    "id": 10082,
    "slug": "afro-house",
    "name": "Afro house",
    "family": "electronic",
    "countries": [
      "ZA",
      "AO"
    ],
    "aliases": []
  },
  {
    "id": 10083,
    "slug": "deep-house",
    "name": "Deep house",
    "family": "electronic",
    "countries": [
      "US",
      "ZA"
    ],
    "aliases": []
  },
  {
    "id": 10084,
    "slug": "tech-house",
    "name": "Tech house",
    "family": "electronic",
    "countries": [
      "GB"
    ],
    "aliases": []
  },
  {
    "id": 10085,
    "slug": "trance",
    "name": "Trance",
    "family": "electronic",
    "countries": [
      "DE",
      "NL"
    ],
    "aliases": []
  },
  {
    "id": 10086,
    "slug": "psytrance",
    "name": "Psytrance",
    "family": "electronic",
    "countries": [
      "IN",
      "IL"
    ],
    "aliases": [
      "Psychedelic trance",
      "Goa trance"
    ]
  },
  {
    "id": 10087,
    "slug": "hardcore",
    "name": "Hardcore / gabber",
    "family": "electronic",
    "countries": [
      "NL",
      "BE"
    ],
    "aliases": [
      "Gabber",
      "Hardcore techno"
    ]
  },
  {
    "id": 10088,
    "slug": "happy-hardcore",
    "name": "Happy hardcore",
    "family": "electronic",
    "countries": [
      "GB",
      "NL"
    ],
    "aliases": []
  },
  {
    "id": 10089,
    "slug": "frenchcore",
    "name": "Frenchcore",
    "family": "electronic",
    "countries": [
      "FR"
    ],
    "aliases": []
  },
  {
    "id": 10090,
    "slug": "eurodance",
    "name": "Eurodance",
    "family": "electronic",
    "countries": [
      "DE",
      "IT",
      "SE"
    ],
    "aliases": []
  },
  {
    "id": 10091,
    "slug": "hands-up",
    "name": "Hands up",
    "family": "electronic",
    "countries": [
      "DE"
    ],
    "aliases": [
      "Hands up dance"
    ]
  },
  {
    "id": 10092,
    "slug": "dubstep",
    "name": "Dubstep",
    "family": "electronic",
    "countries": [
      "GB"
    ],
    "aliases": []
  },
  {
    "id": 10093,
    "slug": "breakbeat",
    "name": "Breakbeat",
    "family": "electronic",
    "countries": [
      "GB",
      "US"
    ],
    "aliases": []
  },
  {
    "id": 10094,
    "slug": "synthwave",
    "name": "Synthwave",
    "family": "electronic",
    "countries": [],
    "aliases": [
      "Retrowave"
    ]
  },
  { id: 10108, slug: 'russian-rap', name: 'Russian rap & trap', family: 'popular', countries: ['RU'], aliases: ['Russian rap','Russian trap','Русский рэп','Русский трэп'], searchHints: ['Kai Angel','9mice','Big Baby Tape','kizaru'] },
  { id: 10109, slug: 'russian-hyperpop', name: 'Russian hyperpop', family: 'electronic', countries: ['RU'], aliases: ['Русский гиперпоп'], searchHints: ['Kill Eva','Killeva','Мэйби Бэйби','Sqwore'] },
  {
    "id": 10095,
    "slug": "ambient",
    "name": "Ambient",
    "family": "electronic",
    "countries": [],
    "aliases": []
  },
  {
    "id": 10096,
    "slug": "lofi",
    "name": "Lo-fi hip-hop",
    "family": "electronic",
    "countries": [],
    "aliases": [
      "Lofi",
      "Lo fi",
      "Chillhop"
    ]
  },
  {
    "id": 10097,
    "slug": "punk",
    "name": "Punk",
    "family": "guitars",
    "countries": [
      "US",
      "GB"
    ],
    "aliases": [
      "Punk rock"
    ]
  },
  {
    "id": 10098,
    "slug": "shoegaze",
    "name": "Shoegaze",
    "family": "guitars",
    "countries": [
      "GB"
    ],
    "aliases": []
  },
  { id: 10112, slug: 'horrorcore', name: 'Horrorcore', family: 'popular', countries: ['US'], aliases: ['Horror rap'], searchHints: ['Gravediggaz','Insane Clown Posse','Twiztid','Esham'] },
  { id: 10113, slug: 'goth', name: 'Goth', family: 'guitars', countries: ['GB','DE'], aliases: ['Gothic rock','Goth rock','Darkwave'], searchHints: ['Bauhaus','The Sisters of Mercy','Siouxsie and the Banshees','Lebanon Hanover'] },
  {
    "id": 10099,
    "slug": "emo",
    "name": "Emo",
    "family": "guitars",
    "countries": [
      "US"
    ],
    "aliases": []
  },
  {
    "id": 10100,
    "slug": "pop-punk",
    "name": "Pop punk",
    "family": "guitars",
    "countries": [
      "US"
    ],
    "aliases": []
  },
  {
    "id": 10101,
    "slug": "metalcore",
    "name": "Metalcore",
    "family": "guitars",
    "countries": [
      "US",
      "AU"
    ],
    "aliases": []
  },
  {
    "id": 10102,
    "slug": "death-metal",
    "name": "Death metal",
    "family": "guitars",
    "countries": [
      "US",
      "SE"
    ],
    "aliases": []
  },
  {
    "id": 10103,
    "slug": "black-metal",
    "name": "Black metal",
    "family": "guitars",
    "countries": [
      "NO"
    ],
    "aliases": []
  },
  {
    "id": 10104,
    "slug": "progressive-rock",
    "name": "Progressive rock",
    "family": "guitars",
    "countries": [
      "GB"
    ],
    "aliases": [
      "Prog rock"
    ]
  },
  {
    "id": 10105,
    "slug": "neo-soul",
    "name": "Neo soul",
    "family": "roots",
    "countries": [
      "US",
      "GB"
    ],
    "aliases": []
  },
  {
    "id": 10106,
    "slug": "disco",
    "name": "Disco",
    "family": "roots",
    "countries": [
      "US"
    ],
    "aliases": []
  },
  {
    "id": 10107,
    "slug": "gospel",
    "name": "Gospel",
    "family": "roots",
    "countries": [
      "US"
    ],
    "aliases": []
  },
  {
    "id": 186,
    "slug": "christian",
    "name": "Christian",
    "family": "roots",
    "countries": [],
    "aliases": [],
    "deezerId": 186
  },
  {
    "id": 173,
    "slug": "soundtracks",
    "name": "Film & game scores",
    "family": "roots",
    "countries": [],
    "aliases": [
      "Soundtracks"
    ],
    "deezerId": 173
  },
  {
    "id": 75,
    "slug": "brazilian",
    "name": "Brazilian music",
    "family": "latin",
    "countries": [
      "BR"
    ],
    "aliases": [],
    "deezerId": 75
  },
  {
    "id": 2,
    "slug": "african",
    "name": "African music",
    "family": "africa",
    "countries": [],
    "aliases": [],
    "deezerId": 2
  },
  {
    "id": 16,
    "slug": "asian",
    "name": "Asian music",
    "family": "asia",
    "countries": [],
    "aliases": [],
    "deezerId": 16
  },
  {
    "id": 81,
    "slug": "indian",
    "name": "Indian music",
    "family": "asia",
    "countries": [
      "IN"
    ],
    "aliases": [],
    "deezerId": 81
  },
  {
    "id": 197,
    "slug": "latin",
    "name": "Latin music",
    "family": "latin",
    "countries": [],
    "aliases": [],
    "deezerId": 197
  },
  {
    "id": 95,
    "slug": "kids",
    "name": "Kids & family",
    "family": "popular",
    "countries": [],
    "aliases": [
      "Children"
    ],
    "deezerId": 95
  },
  { id: 10115, slug: 'internet-classics', name: 'Internet classics', family: 'popular', countries: [], aliases: ['Internet music','Meme songs'], searchHints: ['Parry Gripp','Raining Tacos','Mr Weebl','Badgers','Narwhals','Lemon Demon','Numa Numa','Nyan Cat','Rickroll','Tay Zonday','Chocolate Rain','Viral songs'] }
];
export const MUSIC_GENRE_FAMILIES: MusicGenreFamily[] = ['popular','electronic','guitars','roots','latin','africa','asia','world'];
export const MUSIC_GENRE_COUNTRIES = [...new Set(MUSIC_GENRES.flatMap(genre => genre.countries))];
export function musicGenre(id: number) { return MUSIC_GENRES.find(genre => genre.id === id); }
export function musicGenreName(genre: MusicDiscoveryGenre, t: (key: string) => string) {
  return genre.id >= 10108 && genre.id <= 10133 ? t(`music.genre.${genre.slug}`) : genre.name;
}
export function genreSearchKey(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function filterMusicGenres(genres: readonly MusicDiscoveryGenre[], query: string, countries: readonly string[] = [], family = '', regionName: (code: string) => string = code => code, genreName: (genre: MusicDiscoveryGenre) => string = genre => genre.name) {
  const terms = genreSearchKey(query).split(/\s+/).filter(Boolean);
  return genres.filter(genre => (!family || genre.family === family) && (!countries.length || countries.some(country => genre.countries.includes(country))) && terms.every(term => genreSearchKey([genre.name, genreName(genre), ...genre.aliases, ...(genre.searchHints ?? []), ...genre.countries.map(regionName)].join(' ')).includes(term)));
}
export function relatedMusicGenres(genre: MusicDiscoveryGenre) {
  return MUSIC_GENRES.filter(item => item.id !== genre.id && item.id >= 10000 && (item.family === genre.family || item.countries.some(code => genre.countries.includes(code))))
    .sort((a,b) => Number(b.countries.some(code => genre.countries.includes(code))) - Number(a.countries.some(code => genre.countries.includes(code)))).slice(0,8);
}
