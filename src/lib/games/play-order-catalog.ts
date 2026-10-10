import type {PlayOrderBranch} from "./play-orders";
export type PlayOrderFamilyDefinition={key:string;name:string;aliases?:number[];publisher:string;franchises:number[];series:number[];pattern:string;note:string;branches:PlayOrderBranch[]};
// Exact identities from IGDB; original release dates. Branches avoid conflating separate continuities.
export const EXTRA_PLAY_ORDERS:PlayOrderFamilyDefinition[] = [
  {
    "key": "red-dead",
    "name": "Red Dead",
    "publisher": "Rockstar Games",
    "franchises": [],
    "series": [
      366,
      2100
    ],
    "pattern": "^Red Dead\\b",
    "note": "separate",
    "branches": [
      {
        "key": "redemption",
        "name": "Red Dead Redemption",
        "source": "https://www.rockstargames.com/games/reddeadredemption2",
        "storyOrder": true,
        "entries": [
          {
            "name": "Red Dead Redemption",
            "year": 2010,
            "releaseDate": 1274140800,
            "editions": [
              {
                "id": 434,
                "name": "Red Dead Redemption · 2010"
              },
              {
                "id": 260737,
                "name": "Red Dead Redemption · 2023"
              },
              {
                "id": 260735,
                "name": "Red Dead Redemption · 2023"
              }
            ],
            "storyYear": 1911
          },
          {
            "name": "Red Dead Redemption 2",
            "year": 2018,
            "releaseDate": 1540512000,
            "editions": [
              {
                "id": 25076,
                "name": "Red Dead Redemption 2"
              }
            ],
            "storyYear": 1899
          }
        ]
      },
      {
        "key": "revolver",
        "name": "Red Dead Revolver",
        "source": "https://www.rockstargames.com/games/reddeadrevolver",
        "storyOrder": false,
        "entries": [
          {
            "name": "Red Dead Revolver",
            "year": 2004,
            "releaseDate": 1083456000,
            "editions": [
              {
                "id": 1969,
                "name": "Red Dead Revolver"
              }
            ]
          }
        ]
      },
      {
        "key": "undead",
        "name": "Undead Nightmare",
        "source": "https://www.rockstargames.com/games/undeadnightmare",
        "storyOrder": false,
        "entries": [
          {
            "name": "Red Dead Redemption: Undead Nightmare",
            "year": 2010,
            "releaseDate": 1288051200,
            "editions": [
              {
                "id": 3735,
                "name": "Red Dead Redemption: Undead Nightmare"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "gta",
    "name": "Grand Theft Auto",
    "publisher": "Rockstar Games",
    "franchises": [
      493
    ],
    "series": [
      847
    ],
    "pattern": "^Grand Theft Auto\\b",
    "note": "separate",
    "branches": [
      {
        "key": "gta-3d",
        "name": "GTA · 3D",
        "source": "https://www.rockstargames.com/games",
        "storyOrder": true,
        "entries": [
          {
            "name": "Grand Theft Auto III",
            "year": 2001,
            "releaseDate": 1003708800,
            "editions": [
              {
                "id": 730,
                "name": "Grand Theft Auto III"
              },
              {
                "id": 178123,
                "name": "Grand Theft Auto III: The Definitive Edition"
              }
            ],
            "storyYear": 2001
          },
          {
            "name": "Grand Theft Auto: Vice City",
            "year": 2002,
            "releaseDate": 1035676800,
            "editions": [
              {
                "id": 733,
                "name": "Grand Theft Auto: Vice City"
              },
              {
                "id": 178125,
                "name": "Grand Theft Auto: Vice City - The Definitive Edition"
              }
            ],
            "storyYear": 1986
          },
          {
            "name": "Grand Theft Auto: San Andreas",
            "year": 2004,
            "releaseDate": 1098748800,
            "editions": [
              {
                "id": 732,
                "name": "Grand Theft Auto: San Andreas"
              },
              {
                "id": 178126,
                "name": "Grand Theft Auto: San Andreas - The Definitive Edition"
              }
            ],
            "storyYear": 1992
          },
          {
            "name": "Grand Theft Auto Advance",
            "year": 2004,
            "releaseDate": 1098748800,
            "editions": [
              {
                "id": 3266,
                "name": "Grand Theft Auto Advance"
              }
            ],
            "storyYear": 2000
          },
          {
            "name": "Grand Theft Auto: Liberty City Stories",
            "year": 2005,
            "releaseDate": 1130112000,
            "editions": [
              {
                "id": 3263,
                "name": "Grand Theft Auto: Liberty City Stories"
              }
            ],
            "storyYear": 1998
          },
          {
            "name": "Grand Theft Auto: Vice City Stories",
            "year": 2006,
            "releaseDate": 1162252800,
            "editions": [
              {
                "id": 3262,
                "name": "Grand Theft Auto: Vice City Stories"
              }
            ],
            "storyYear": 1984
          }
        ]
      },
      {
        "key": "gta-hd",
        "name": "GTA · HD",
        "source": "https://www.rockstargames.com/games",
        "storyOrder": true,
        "entries": [
          {
            "name": "Grand Theft Auto IV",
            "year": 2008,
            "releaseDate": 1209427200,
            "editions": [
              {
                "id": 731,
                "name": "Grand Theft Auto IV"
              }
            ],
            "storyYear": 2008
          },
          {
            "name": "Grand Theft Auto IV: The Lost and Damned",
            "year": 2009,
            "releaseDate": 1234828800,
            "editions": [
              {
                "id": 3265,
                "name": "Grand Theft Auto IV: The Lost and Damned"
              }
            ],
            "storyYear": 2008
          },
          {
            "name": "Grand Theft Auto: Chinatown Wars",
            "year": 2009,
            "releaseDate": 1237248000,
            "editions": [
              {
                "id": 3270,
                "name": "Grand Theft Auto: Chinatown Wars"
              }
            ],
            "storyYear": 2009
          },
          {
            "name": "Grand Theft Auto IV: The Ballad of Gay Tony",
            "year": 2009,
            "releaseDate": 1256774400,
            "editions": [
              {
                "id": 3174,
                "name": "Grand Theft Auto IV: The Ballad of Gay Tony"
              }
            ],
            "storyYear": 2008
          },
          {
            "name": "Grand Theft Auto V",
            "year": 2013,
            "releaseDate": 1379376000,
            "editions": [
              {
                "id": 1020,
                "name": "Grand Theft Auto V · 2013"
              },
              {
                "id": 134709,
                "name": "Grand Theft Auto V · 2022"
              },
              {
                "id": 239064,
                "name": "Grand Theft Auto V · 2015"
              }
            ],
            "storyYear": 2013
          }
        ]
      },
      {
        "key": "gta-2d",
        "name": "GTA · 2D",
        "source": "https://www.rockstargames.com/games",
        "storyOrder": false,
        "entries": [
          {
            "name": "Grand Theft Auto",
            "year": 1997,
            "releaseDate": 877392000,
            "editions": [
              {
                "id": 980,
                "name": "Grand Theft Auto"
              }
            ]
          },
          {
            "name": "Grand Theft Auto: London 1969",
            "year": 1999,
            "releaseDate": 922838400,
            "editions": [
              {
                "id": 8235,
                "name": "Grand Theft Auto: London 1969"
              }
            ]
          },
          {
            "name": "Grand Theft Auto: London 1961",
            "year": 1999,
            "releaseDate": 928195200,
            "editions": [
              {
                "id": 13233,
                "name": "Grand Theft Auto: London 1961"
              }
            ]
          },
          {
            "name": "Grand Theft Auto 2",
            "year": 1999,
            "releaseDate": 940550400,
            "editions": [
              {
                "id": 819,
                "name": "Grand Theft Auto 2"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "max-payne",
    "name": "Max Payne",
    "publisher": "Rockstar Games",
    "franchises": [
      1822
    ],
    "series": [],
    "pattern": "^Max Payne\\b",
    "note": "selected",
    "branches": [
      {
        "key": "max-payne",
        "name": "Max Payne",
        "source": "https://www.rockstargames.com/games/maxpayne3",
        "storyOrder": true,
        "entries": [
          {
            "name": "Max Payne",
            "year": 2001,
            "releaseDate": 995846400,
            "editions": [
              {
                "id": 18,
                "name": "Max Payne"
              },
              {
                "id": 86868,
                "name": "Max Payne Mobile"
              }
            ],
            "storyRank": 1
          },
          {
            "name": "Max Payne 2: The Fall of Max Payne",
            "year": 2003,
            "releaseDate": 1066089600,
            "editions": [
              {
                "id": 19,
                "name": "Max Payne 2: The Fall of Max Payne"
              }
            ],
            "storyRank": 2
          },
          {
            "name": "Max Payne 3",
            "year": 2012,
            "releaseDate": 1337040000,
            "editions": [
              {
                "id": 960,
                "name": "Max Payne 3"
              }
            ],
            "storyRank": 3
          }
        ]
      }
    ]
  },
  {
    "key": "life-is-strange",
    "name": "Life is Strange",
    "publisher": "Square Enix",
    "franchises": [
      1652
    ],
    "series": [
      2724
    ],
    "pattern": "^(?:Life is Strange|The Awesome Adventures of Captain Spirit)\\b",
    "note": "overlap",
    "branches": [
      {
        "key": "life-is-strange",
        "name": "Life is Strange",
        "source": "https://lifeisstrange.square-enix-games.com/en-gb",
        "storyOrder": true,
        "entries": [
          {
            "name": "Life Is Strange",
            "year": 2015,
            "releaseDate": 1422489600,
            "editions": [
              {
                "id": 7599,
                "name": "Life Is Strange"
              },
              {
                "id": 144775,
                "name": "Life is Strange Remastered"
              }
            ],
            "storyRank": 2
          },
          {
            "name": "Life is Strange: Before the Storm",
            "year": 2017,
            "releaseDate": 1504137600,
            "editions": [
              {
                "id": 29004,
                "name": "Life is Strange: Before the Storm"
              },
              {
                "id": 144776,
                "name": "Life is Strange: Before the Storm Remastered"
              }
            ],
            "storyRank": 1
          },
          {
            "name": "Life is Strange: Before the Storm - Bonus Episode: Farewell",
            "year": 2018,
            "releaseDate": 1520208000,
            "editions": [
              {
                "id": 91247,
                "name": "Life is Strange: Before the Storm - Bonus Episode: Farewell"
              }
            ],
            "storyRank": 0
          },
          {
            "name": "The Awesome Adventures of Captain Spirit",
            "year": 2018,
            "releaseDate": 1529884800,
            "editions": [
              {
                "id": 103283,
                "name": "The Awesome Adventures of Captain Spirit"
              }
            ],
            "storyRank": 3.1
          },
          {
            "name": "Life Is Strange 2",
            "year": 2018,
            "releaseDate": 1537920000,
            "editions": [
              {
                "id": 62151,
                "name": "Life Is Strange 2"
              }
            ],
            "storyRank": 3
          },
          {
            "name": "Life is Strange: True Colors",
            "year": 2021,
            "releaseDate": 1631232000,
            "editions": [
              {
                "id": 144765,
                "name": "Life is Strange: True Colors"
              }
            ],
            "storyRank": 5
          },
          {
            "name": "Life is Strange: Wavelengths",
            "year": 2021,
            "releaseDate": 1632960000,
            "editions": [
              {
                "id": 144873,
                "name": "Life is Strange: Wavelengths"
              }
            ],
            "storyRank": 4
          },
          {
            "name": "Life is Strange: Double Exposure",
            "year": 2024,
            "releaseDate": 1730160000,
            "editions": [
              {
                "id": 305158,
                "name": "Life is Strange: Double Exposure"
              }
            ],
            "storyRank": 6
          },
          {
            "name": "Life is Strange: Reunion",
            "year": 2026,
            "releaseDate": 1774483200,
            "editions": [
              {
                "id": 386431,
                "name": "Life is Strange: Reunion"
              }
            ],
            "storyRank": 7
          }
        ]
      }
    ]
  },
  {
    "key": "mass-effect",
    "name": "Mass Effect",
    "publisher": "Electronic Arts",
    "franchises": [
      1048
    ],
    "series": [
      25
    ],
    "pattern": "^Mass Effect\\b",
    "note": "selected",
    "branches": [
      {
        "key": "mass-effect",
        "name": "Mass Effect",
        "source": "https://www.ea.com/games/mass-effect/mass-effect-legendary-edition",
        "storyOrder": true,
        "entries": [
          {
            "name": "Mass Effect",
            "year": 2007,
            "releaseDate": 1195516800,
            "editions": [
              {
                "id": 73,
                "name": "Mass Effect"
              }
            ],
            "storyRank": 1
          },
          {
            "name": "Mass Effect 2",
            "year": 2010,
            "releaseDate": 1264464000,
            "editions": [
              {
                "id": 74,
                "name": "Mass Effect 2"
              }
            ],
            "storyRank": 2
          },
          {
            "name": "Mass Effect 3",
            "year": 2012,
            "releaseDate": 1330992000,
            "editions": [
              {
                "id": 75,
                "name": "Mass Effect 3"
              }
            ],
            "storyRank": 3
          },
          {
            "name": "Mass Effect: Andromeda",
            "year": 2017,
            "releaseDate": 1490054400,
            "editions": [
              {
                "id": 7349,
                "name": "Mass Effect: Andromeda"
              }
            ],
            "storyRank": 4
          }
        ]
      }
    ]
  },
  {
    "key": "mafia",
    "name": "Mafia",
    "publisher": "2K",
    "franchises": [],
    "series": [
      562
    ],
    "pattern": "^Mafia\\b",
    "note": "selected",
    "branches": [
      {
        "key": "mafia",
        "name": "Mafia",
        "source": "https://mafia.2k.com/",
        "storyOrder": true,
        "entries": [
          {
            "name": "Mafia",
            "year": 2002,
            "releaseDate": 1030579200,
            "storyRank": 1,
            "editions": [
              {
                "id": 39,
                "name": "Mafia"
              },
              {
                "id": 134070,
                "name": "Mafia: Definitive Edition"
              }
            ]
          },
          {
            "name": "Mafia II",
            "year": 2010,
            "releaseDate": 1282608000,
            "storyRank": 2,
            "editions": [
              {
                "id": 40,
                "name": "Mafia II"
              },
              {
                "id": 134071,
                "name": "Mafia II: Definitive Edition"
              }
            ]
          },
          {
            "name": "Mafia III",
            "year": 2016,
            "releaseDate": 1475798400,
            "storyRank": 3,
            "editions": [
              {
                "id": 11492,
                "name": "Mafia III"
              },
              {
                "id": 134073,
                "name": "Mafia III: Definitive Edition"
              }
            ]
          },
          {
            "name": "Mafia: The Old Country",
            "year": 2025,
            "releaseDate": 1754524800,
            "storyRank": 0,
            "editions": [
              {
                "id": 314276,
                "name": "Mafia: The Old Country"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "walking-dead",
    "name": "The Walking Dead · Telltale",
    "publisher": "Skybound",
    "franchises": [],
    "series": [
      564
    ],
    "pattern": "^The Walking Dead\\b",
    "note": "separate",
    "branches": [
      {
        "key": "clementine",
        "name": "The Walking Dead",
        "source": "https://www.skybound.com/telltales-the-walking-dead",
        "storyOrder": true,
        "entries": [
          {
            "name": "The Walking Dead",
            "year": 2012,
            "releaseDate": 1335225600,
            "storyRank": 1,
            "editions": [
              {
                "id": 1871,
                "name": "The Walking Dead"
              }
            ]
          },
          {
            "name": "The Walking Dead: 400 Days",
            "year": 2013,
            "releaseDate": 1372723200,
            "storyRank": 1.5,
            "editions": [
              {
                "id": 3015,
                "name": "The Walking Dead: 400 Days"
              }
            ]
          },
          {
            "name": "The Walking Dead: Season Two",
            "year": 2013,
            "releaseDate": 1387238400,
            "storyRank": 2,
            "editions": [
              {
                "id": 3097,
                "name": "The Walking Dead: Season Two"
              }
            ]
          },
          {
            "name": "The Walking Dead: A New Frontier",
            "year": 2016,
            "releaseDate": 1482192000,
            "storyRank": 3,
            "editions": [
              {
                "id": 19000,
                "name": "The Walking Dead: A New Frontier"
              }
            ]
          },
          {
            "name": "The Walking Dead: The Final Season",
            "year": 2018,
            "releaseDate": 1534118400,
            "storyRank": 4,
            "editions": [
              {
                "id": 51524,
                "name": "The Walking Dead: The Final Season"
              }
            ]
          }
        ]
      },
      {
        "key": "michonne",
        "name": "The Walking Dead: Michonne",
        "source": "https://www.skybound.com/telltales-the-walking-dead",
        "storyOrder": false,
        "entries": [
          {
            "name": "The Walking Dead: Michonne",
            "year": 2016,
            "releaseDate": 1454457600,
            "storyRank": 1,
            "editions": [
              {
                "id": 11204,
                "name": "The Walking Dead: Michonne"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "telltale-batman",
    "aliases": [
      127560
    ],
    "name": "Batman · Telltale",
    "publisher": "Telltale",
    "franchises": [],
    "series": [
      2825
    ],
    "pattern": "^(?:Batman|Telltale Batman)\\b",
    "note": "selected",
    "branches": [
      {
        "key": "telltale-batman",
        "name": "Batman · Telltale",
        "source": "https://www.telltale.com/batman-shadows-edition/",
        "storyOrder": true,
        "entries": [
          {
            "name": "Batman: The Telltale Series",
            "year": 2016,
            "releaseDate": 1470096000,
            "storyRank": 1,
            "editions": [
              {
                "id": 14746,
                "name": "Batman: The Telltale Series"
              }
            ]
          },
          {
            "name": "Batman: The Enemy Within",
            "year": 2017,
            "releaseDate": 1502150400,
            "storyRank": 2,
            "editions": [
              {
                "id": 51525,
                "name": "Batman: The Enemy Within"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "star-wars",
    "aliases": [
      204280,
      117405,
      227942
    ],
    "name": "Star Wars",
    "publisher": "Lucasfilm",
    "franchises": [],
    "series": [
      7875,
      23,
      60
    ],
    "pattern": "^Star Wars\\b",
    "note": "separate",
    "branches": [
      {
        "key": "jedi",
        "name": "Star Wars Jedi",
        "source": "https://www.starwars.com/games-apps/star-wars-jedi-survivor",
        "storyOrder": true,
        "entries": [
          {
            "name": "Star Wars Jedi: Fallen Order",
            "year": 2019,
            "releaseDate": 1573776000,
            "storyRank": 1,
            "editions": [
              {
                "id": 74701,
                "name": "Star Wars Jedi: Fallen Order"
              }
            ]
          },
          {
            "name": "Star Wars Jedi: Survivor",
            "year": 2023,
            "releaseDate": 1682640000,
            "storyRank": 2,
            "editions": [
              {
                "id": 201156,
                "name": "Star Wars Jedi: Survivor"
              }
            ]
          }
        ]
      },
      {
        "key": "kotor",
        "name": "Knights of the Old Republic · Legends",
        "source": "https://www.starwars.com/news/star-wars-knights-of-the-old-republic-ii-the-sith-lords-mobile-announce",
        "storyOrder": true,
        "entries": [
          {
            "name": "Star Wars: Knights of the Old Republic",
            "year": 2003,
            "releaseDate": 1058227200,
            "storyRank": 1,
            "editions": [
              {
                "id": 116,
                "name": "Star Wars: Knights of the Old Republic"
              }
            ]
          },
          {
            "name": "Star Wars: Knights of the Old Republic II - The Sith Lords",
            "year": 2004,
            "releaseDate": 1102291200,
            "storyRank": 2,
            "editions": [
              {
                "id": 118,
                "name": "Star Wars: Knights of the Old Republic II - The Sith Lords"
              }
            ]
          }
        ]
      },
      {
        "key": "force-unleashed",
        "name": "The Force Unleashed · Legends",
        "source": "https://www.starwars.com/games-apps/star-wars-the-force-unleashed-ii",
        "storyOrder": true,
        "entries": [
          {
            "name": "Star Wars: The Force Unleashed",
            "year": 2008,
            "releaseDate": 1221523200,
            "storyRank": 1,
            "editions": [
              {
                "id": 475,
                "name": "Star Wars: The Force Unleashed"
              },
              {
                "id": 19637,
                "name": "Star Wars: The Force Unleashed - Ultimate Sith Edition"
              }
            ]
          },
          {
            "name": "Star Wars: The Force Unleashed II",
            "year": 2010,
            "releaseDate": 1288051200,
            "storyRank": 2,
            "editions": [
              {
                "id": 137,
                "name": "Star Wars: The Force Unleashed II"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "witcher",
    "name": "The Witcher",
    "publisher": "CD PROJEKT RED",
    "franchises": [
      452
    ],
    "series": [
      62
    ],
    "pattern": "^(?:The Witcher|Thronebreaker)\\b",
    "note": "separate",
    "branches": [
      {
        "key": "witcher",
        "name": "The Witcher",
        "source": "https://www.thewitcher.com/us/en/classics",
        "storyOrder": true,
        "entries": [
          {
            "name": "The Witcher",
            "year": 2007,
            "releaseDate": 1193356800,
            "storyRank": 0,
            "editions": [
              {
                "id": 80,
                "name": "The Witcher"
              },
              {
                "id": 20275,
                "name": "The Witcher: Enhanced Edition"
              }
            ]
          },
          {
            "name": "The Witcher 2: Assassins of Kings",
            "year": 2011,
            "releaseDate": 1305590400,
            "storyRank": 1,
            "editions": [
              {
                "id": 478,
                "name": "The Witcher 2: Assassins of Kings"
              },
              {
                "id": 20740,
                "name": "The Witcher 2: Assassins of Kings - Enhanced Edition"
              }
            ]
          },
          {
            "name": "The Witcher 3: Wild Hunt",
            "year": 2015,
            "releaseDate": 1431993600,
            "storyRank": 2,
            "editions": [
              {
                "id": 1942,
                "name": "The Witcher 3: Wild Hunt"
              },
              {
                "id": 22439,
                "name": "The Witcher 3: Wild Hunt - Game of the Year Edition"
              }
            ]
          }
        ]
      },
      {
        "key": "thronebreaker",
        "name": "Thronebreaker",
        "source": "https://www.thewitcher.com/us/en/thronebreaker",
        "storyOrder": false,
        "entries": [
          {
            "name": "Thronebreaker: The Witcher Tales",
            "year": 2018,
            "releaseDate": 1540252800,
            "storyRank": 0,
            "editions": [
              {
                "id": 107300,
                "name": "Thronebreaker: The Witcher Tales"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "dragon-age",
    "name": "Dragon Age",
    "publisher": "Electronic Arts",
    "franchises": [
      1047
    ],
    "series": [
      10
    ],
    "pattern": "^Dragon Age\\b",
    "note": "overlapping",
    "branches": [
      {
        "key": "dragon-age",
        "name": "Dragon Age",
        "source": "https://www.ea.com/en-ca/games/dragon-age",
        "storyOrder": true,
        "entries": [
          {
            "name": "Dragon Age: Origins",
            "year": 2009,
            "releaseDate": 1257206400,
            "storyRank": 0,
            "editions": [
              {
                "id": 76,
                "name": "Dragon Age: Origins"
              }
            ]
          },
          {
            "name": "Dragon Age II",
            "year": 2011,
            "releaseDate": 1299542400,
            "storyRank": 1,
            "editions": [
              {
                "id": 78,
                "name": "Dragon Age II"
              }
            ]
          },
          {
            "name": "Dragon Age: Inquisition",
            "year": 2014,
            "releaseDate": 1416268800,
            "storyRank": 2,
            "editions": [
              {
                "id": 1887,
                "name": "Dragon Age: Inquisition"
              }
            ]
          },
          {
            "name": "Dragon Age: The Veilguard",
            "year": 2024,
            "releaseDate": 1730332800,
            "storyRank": 3,
            "editions": [
              {
                "id": 30208,
                "name": "Dragon Age: The Veilguard"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "bioshock",
    "name": "BioShock",
    "publisher": "2K",
    "franchises": [
      1686
    ],
    "series": [
      1
    ],
    "pattern": "^BioShock\\b",
    "note": "selected",
    "branches": [
      {
        "key": "bioshock",
        "name": "BioShock",
        "source": "https://store.2k.com/bioshock-collection",
        "storyOrder": true,
        "entries": [
          {
            "name": "BioShock",
            "year": 2007,
            "releaseDate": 1187654400,
            "storyRank": 0,
            "editions": [
              {
                "id": 20,
                "name": "BioShock"
              },
              {
                "id": 34293,
                "name": "BioShock Remastered"
              }
            ]
          },
          {
            "name": "BioShock 2",
            "year": 2010,
            "releaseDate": 1265673600,
            "storyRank": 1,
            "editions": [
              {
                "id": 21,
                "name": "BioShock 2"
              },
              {
                "id": 34294,
                "name": "BioShock 2 Remastered"
              }
            ]
          },
          {
            "name": "BioShock Infinite",
            "year": 2013,
            "releaseDate": 1364169600,
            "storyRank": -1,
            "editions": [
              {
                "id": 538,
                "name": "BioShock Infinite"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "metro",
    "name": "Metro",
    "publisher": "Deep Silver",
    "franchises": [
      1344
    ],
    "series": [
      82
    ],
    "pattern": "^Metro\\b",
    "note": "selected",
    "branches": [
      {
        "key": "metro",
        "name": "Metro",
        "source": "https://www.deepsilver.com/games/metro-exodus",
        "storyOrder": true,
        "entries": [
          {
            "name": "Metro 2033",
            "year": 2010,
            "releaseDate": 1268697600,
            "storyRank": 0,
            "editions": [
              {
                "id": 495,
                "name": "Metro 2033"
              },
              {
                "id": 80853,
                "name": "Metro 2033 Redux"
              }
            ]
          },
          {
            "name": "Metro: Last Light",
            "year": 2013,
            "releaseDate": 1368489600,
            "storyRank": 1,
            "editions": [
              {
                "id": 539,
                "name": "Metro: Last Light"
              },
              {
                "id": 50199,
                "name": "Metro: Last Light Redux"
              }
            ]
          },
          {
            "name": "Metro Exodus",
            "year": 2019,
            "releaseDate": 1550188800,
            "storyRank": 2,
            "editions": [
              {
                "id": 37016,
                "name": "Metro Exodus"
              },
              {
                "id": 143292,
                "name": "Metro Exodus: Enhanced Edition"
              }
            ]
          },
          {
            "name": "Metro Awakening VR",
            "year": 2024,
            "releaseDate": 1730937600,
            "storyRank": -1,
            "editions": [
              {
                "id": 284720,
                "name": "Metro Awakening VR"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "dishonored",
    "name": "Dishonored",
    "publisher": "Bethesda",
    "franchises": [
      1063
    ],
    "series": [
      1494
    ],
    "pattern": "^Dishonored\\b",
    "note": "selected",
    "branches": [
      {
        "key": "dishonored",
        "name": "Dishonored",
        "source": "https://bethesda.net/game/dishonored-doto",
        "storyOrder": true,
        "entries": [
          {
            "name": "Dishonored",
            "year": 2012,
            "releaseDate": 1349740800,
            "storyRank": 0,
            "editions": [
              {
                "id": 533,
                "name": "Dishonored"
              },
              {
                "id": 20863,
                "name": "Dishonored: Definitive Edition"
              }
            ]
          },
          {
            "name": "Dishonored 2",
            "year": 2016,
            "releaseDate": 1478822400,
            "storyRank": 1,
            "editions": [
              {
                "id": 11118,
                "name": "Dishonored 2"
              }
            ]
          },
          {
            "name": "Dishonored: Death of the Outsider",
            "year": 2017,
            "releaseDate": 1505347200,
            "storyRank": 2,
            "editions": [
              {
                "id": 37030,
                "name": "Dishonored: Death of the Outsider"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "yakuza",
    "name": "Like a Dragon / Yakuza",
    "publisher": "SEGA",
    "franchises": [
      1467
    ],
    "series": [
      380,
      7649
    ],
    "pattern": "^(?:Yakuza|The Yakuza|Like a Dragon|Judgment|Lost Judgment|Ryuu? ga Gotoku)\\b",
    "note": "overlapping",
    "branches": [
      {
        "key": "yakuza-main",
        "name": "Like a Dragon / Yakuza",
        "source": "https://rggstudio.sega.com/",
        "storyOrder": true,
        "entries": [
          {
            "name": "Yakuza",
            "year": 2005,
            "releaseDate": 1134000000,
            "storyRank": 1,
            "editions": [
              {
                "id": 2059,
                "name": "Yakuza"
              },
              {
                "id": 12595,
                "name": "Yakuza Kiwami"
              }
            ]
          },
          {
            "name": "Yakuza 2",
            "year": 2006,
            "releaseDate": 1165449600,
            "storyRank": 2,
            "editions": [
              {
                "id": 2060,
                "name": "Yakuza 2"
              },
              {
                "id": 55090,
                "name": "Yakuza Kiwami 2"
              }
            ]
          },
          {
            "name": "Yakuza 3",
            "year": 2009,
            "releaseDate": 1235606400,
            "storyRank": 3,
            "editions": [
              {
                "id": 2061,
                "name": "Yakuza 3"
              },
              {
                "id": 103015,
                "name": "Yakuza 3 Remastered"
              },
              {
                "id": 368182,
                "name": "Yakuza Kiwami 3"
              },
              {
                "id": 369852,
                "name": "Yakuza Kiwami 3 & Dark Ties"
              }
            ]
          },
          {
            "name": "Yakuza 4",
            "year": 2010,
            "releaseDate": 1268006400,
            "storyRank": 4,
            "editions": [
              {
                "id": 2062,
                "name": "Yakuza 4"
              },
              {
                "id": 103016,
                "name": "Yakuza 4 Remastered"
              }
            ]
          },
          {
            "name": "Yakuza 5",
            "year": 2012,
            "releaseDate": 1354752000,
            "storyRank": 5,
            "editions": [
              {
                "id": 2063,
                "name": "Yakuza 5"
              },
              {
                "id": 103017,
                "name": "Yakuza 5 Remastered"
              }
            ]
          },
          {
            "name": "Yakuza 0",
            "year": 2015,
            "releaseDate": 1426118400,
            "storyRank": 0,
            "editions": [
              {
                "id": 11397,
                "name": "Yakuza 0"
              },
              {
                "id": 338084,
                "name": "Yakuza 0: Director's Cut"
              }
            ]
          },
          {
            "name": "Yakuza 6: The Song of Life",
            "year": 2016,
            "releaseDate": 1481155200,
            "storyRank": 6,
            "editions": [
              {
                "id": 12527,
                "name": "Yakuza 6: The Song of Life"
              }
            ]
          },
          {
            "name": "Yakuza: Like a Dragon",
            "year": 2020,
            "releaseDate": 1579132800,
            "storyRank": 7,
            "editions": [
              {
                "id": 36550,
                "name": "Yakuza: Like a Dragon"
              }
            ]
          },
          {
            "name": "Like a Dragon Gaiden: The Man Who Erased His Name",
            "year": 2023,
            "releaseDate": 1699488000,
            "storyRank": 7.5,
            "editions": [
              {
                "id": 217624,
                "name": "Like a Dragon Gaiden: The Man Who Erased His Name"
              }
            ]
          },
          {
            "name": "Like a Dragon: Infinite Wealth",
            "year": 2024,
            "releaseDate": 1706227200,
            "storyRank": 8,
            "editions": [
              {
                "id": 217623,
                "name": "Like a Dragon: Infinite Wealth"
              }
            ]
          },
          {
            "name": "Like a Dragon: Pirate Yakuza in Hawaii",
            "year": 2025,
            "releaseDate": 1740096000,
            "storyRank": 9,
            "editions": [
              {
                "id": 317317,
                "name": "Like a Dragon: Pirate Yakuza in Hawaii"
              }
            ]
          }
        ]
      },
      {
        "key": "judgment",
        "name": "Judgment",
        "source": "https://rggstudio.sega.com/",
        "storyOrder": true,
        "entries": [
          {
            "name": "Judgment",
            "year": 2018,
            "releaseDate": 1544659200,
            "storyRank": 0,
            "editions": [
              {
                "id": 109274,
                "name": "Judgment · 2018"
              },
              {
                "id": 281562,
                "name": "Judgment · 2021"
              }
            ]
          },
          {
            "name": "Lost Judgment",
            "year": 2021,
            "releaseDate": 1632441600,
            "storyRank": 1,
            "editions": [
              {
                "id": 146851,
                "name": "Lost Judgment"
              }
            ]
          }
        ]
      },
      {
        "key": "ishin",
        "name": "Ishin!",
        "source": "https://rggstudio.sega.com/",
        "storyOrder": false,
        "entries": [
          {
            "name": "Ryuu ga Gotoku Ishin!",
            "year": 2014,
            "releaseDate": 1393027200,
            "storyRank": 0,
            "editions": [
              {
                "id": 12736,
                "name": "Ryuu ga Gotoku Ishin!"
              },
              {
                "id": 217597,
                "name": "Like a Dragon: Ishin!"
              }
            ]
          }
        ]
      },
      {
        "key": "kenzan",
        "name": "Kenzan!",
        "source": "https://rggstudio.sega.com/",
        "storyOrder": false,
        "entries": [
          {
            "name": "Ryuu ga Gotoku Kenzan!",
            "year": 2008,
            "releaseDate": 1204761600,
            "storyRank": 0,
            "editions": [
              {
                "id": 7442,
                "name": "Ryuu ga Gotoku Kenzan!"
              }
            ]
          }
        ]
      },
      {
        "key": "dead-souls",
        "name": "Yakuza: Dead Souls",
        "source": "https://rggstudio.sega.com/",
        "storyOrder": false,
        "entries": [
          {
            "name": "Yakuza: Dead Souls",
            "year": 2011,
            "releaseDate": 1307577600,
            "storyRank": 0,
            "editions": [
              {
                "id": 7489,
                "name": "Yakuza: Dead Souls"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "sonic",
    "name": "Sonic the Hedgehog",
    "publisher": "SEGA",
    "franchises": [],
    "series": [
      2156,
      6172
    ],
    "pattern": "^Sonic\\b",
    "note": "release-guide",
    "branches": [
      {
        "key": "sonic-2d",
        "name": "Sonic · 2D",
        "source": "https://asia.sega.com/SonicOrigins/en/about/",
        "storyOrder": false,
        "entries": [
          {
            "name": "Sonic the Hedgehog",
            "year": 1991,
            "releaseDate": 677635200,
            "storyRank": 0,
            "editions": [
              {
                "id": 3192,
                "name": "Sonic the Hedgehog"
              }
            ]
          },
          {
            "name": "Sonic the Hedgehog 2",
            "year": 1992,
            "releaseDate": 720576000,
            "storyRank": 1,
            "editions": [
              {
                "id": 4438,
                "name": "Sonic the Hedgehog 2"
              }
            ]
          },
          {
            "name": "Sonic CD",
            "year": 1993,
            "releaseDate": 748742400,
            "storyRank": 2,
            "editions": [
              {
                "id": 5452,
                "name": "Sonic CD"
              }
            ]
          },
          {
            "name": "Sonic the Hedgehog 3",
            "year": 1994,
            "releaseDate": 760147200,
            "storyRank": 3,
            "editions": [
              {
                "id": 6797,
                "name": "Sonic the Hedgehog 3"
              }
            ]
          },
          {
            "name": "Sonic & Knuckles",
            "year": 1994,
            "releaseDate": 782438400,
            "storyRank": 4,
            "editions": [
              {
                "id": 9475,
                "name": "Sonic & Knuckles"
              }
            ]
          },
          {
            "name": "Sonic Mania",
            "year": 2017,
            "releaseDate": 1502755200,
            "storyRank": 5,
            "editions": [
              {
                "id": 21062,
                "name": "Sonic Mania"
              }
            ]
          },
          {
            "name": "Sonic Superstars",
            "year": 2023,
            "releaseDate": 1697500800,
            "storyRank": 6,
            "editions": [
              {
                "id": 252478,
                "name": "Sonic Superstars"
              }
            ]
          }
        ]
      },
      {
        "key": "sonic-3d",
        "name": "Sonic · 3D",
        "source": "https://sonicthehedgehog.com/",
        "storyOrder": false,
        "entries": [
          {
            "name": "Sonic Adventure",
            "year": 1998,
            "releaseDate": 914371200,
            "storyRank": 0,
            "editions": [
              {
                "id": 7860,
                "name": "Sonic Adventure"
              }
            ]
          },
          {
            "name": "Sonic Adventure 2",
            "year": 2001,
            "releaseDate": 992908800,
            "storyRank": 1,
            "editions": [
              {
                "id": 7858,
                "name": "Sonic Adventure 2"
              }
            ]
          },
          {
            "name": "Sonic Heroes",
            "year": 2003,
            "releaseDate": 1072742400,
            "storyRank": 2,
            "editions": [
              {
                "id": 4156,
                "name": "Sonic Heroes"
              }
            ]
          },
          {
            "name": "Sonic the Hedgehog",
            "year": 2006,
            "releaseDate": 1163462400,
            "storyRank": 3,
            "editions": [
              {
                "id": 6231,
                "name": "Sonic the Hedgehog"
              }
            ]
          },
          {
            "name": "Sonic Unleashed",
            "year": 2008,
            "releaseDate": 1227139200,
            "storyRank": 4,
            "editions": [
              {
                "id": 5169,
                "name": "Sonic Unleashed"
              }
            ]
          },
          {
            "name": "Sonic Colors",
            "year": 2010,
            "releaseDate": 1289433600,
            "storyRank": 5,
            "editions": [
              {
                "id": 2267,
                "name": "Sonic Colors"
              }
            ]
          },
          {
            "name": "Sonic Generations",
            "year": 2011,
            "releaseDate": 1320105600,
            "storyRank": 6,
            "editions": [
              {
                "id": 506,
                "name": "Sonic Generations"
              },
              {
                "id": 284716,
                "name": "Sonic X Shadow Generations"
              }
            ]
          },
          {
            "name": "Sonic Lost World",
            "year": 2013,
            "releaseDate": 1382054400,
            "storyRank": 7,
            "editions": [
              {
                "id": 2607,
                "name": "Sonic Lost World"
              }
            ]
          },
          {
            "name": "Sonic Forces",
            "year": 2017,
            "releaseDate": 1510012800,
            "storyRank": 8,
            "editions": [
              {
                "id": 21063,
                "name": "Sonic Forces"
              }
            ]
          },
          {
            "name": "Sonic Frontiers",
            "year": 2022,
            "releaseDate": 1667779200,
            "storyRank": 9,
            "editions": [
              {
                "id": 150010,
                "name": "Sonic Frontiers"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "mario",
    "name": "Super Mario",
    "publisher": "Nintendo",
    "franchises": [],
    "series": [
      240,
      593
    ],
    "pattern": "^(?:Super Mario (?:Bros|World|64|Sunshine|Galaxy|3D|Odyssey)|New Super Mario|Paper Mario|Super Paper Mario)\\b",
    "note": "release-guide",
    "branches": [
      {
        "key": "mario-2d",
        "name": "Super Mario · 2D",
        "source": "https://www.nintendo.com/en-ca/explore/characters/mario/history/",
        "storyOrder": false,
        "entries": [
          {
            "name": "Super Mario Bros.",
            "year": 1985,
            "releaseDate": 495417600,
            "storyRank": 0,
            "editions": [
              {
                "id": 358,
                "name": "Super Mario Bros."
              }
            ]
          },
          {
            "name": "Super Mario Bros. 2",
            "year": 1988,
            "releaseDate": 592358400,
            "storyRank": 1,
            "editions": [
              {
                "id": 1067,
                "name": "Super Mario Bros. 2"
              }
            ]
          },
          {
            "name": "Super Mario Bros. 3",
            "year": 1988,
            "releaseDate": 593568000,
            "storyRank": 2,
            "editions": [
              {
                "id": 1068,
                "name": "Super Mario Bros. 3"
              }
            ]
          },
          {
            "name": "Super Mario World",
            "year": 1990,
            "releaseDate": 659145600,
            "storyRank": 3,
            "editions": [
              {
                "id": 1070,
                "name": "Super Mario World"
              }
            ]
          },
          {
            "name": "New Super Mario Bros.",
            "year": 2006,
            "releaseDate": 1147651200,
            "storyRank": 4,
            "editions": [
              {
                "id": 1076,
                "name": "New Super Mario Bros."
              }
            ]
          },
          {
            "name": "New Super Mario Bros. Wii",
            "year": 2009,
            "releaseDate": 1257984000,
            "storyRank": 5,
            "editions": [
              {
                "id": 2178,
                "name": "New Super Mario Bros. Wii"
              }
            ]
          },
          {
            "name": "New Super Mario Bros. U",
            "year": 2012,
            "releaseDate": 1353196800,
            "storyRank": 6,
            "editions": [
              {
                "id": 2171,
                "name": "New Super Mario Bros. U"
              }
            ]
          },
          {
            "name": "Super Mario Bros. Wonder",
            "year": 2023,
            "releaseDate": 1697760000,
            "storyRank": 7,
            "editions": [
              {
                "id": 254339,
                "name": "Super Mario Bros. Wonder"
              }
            ]
          }
        ]
      },
      {
        "key": "mario-3d",
        "name": "Super Mario · 3D",
        "source": "https://www.nintendo.com/en-ca/explore/characters/mario/history/",
        "storyOrder": false,
        "entries": [
          {
            "name": "Super Mario 64",
            "year": 1996,
            "releaseDate": 835488000,
            "storyRank": 0,
            "editions": [
              {
                "id": 1074,
                "name": "Super Mario 64"
              }
            ]
          },
          {
            "name": "Super Mario Sunshine",
            "year": 2002,
            "releaseDate": 1027036800,
            "storyRank": 1,
            "editions": [
              {
                "id": 1075,
                "name": "Super Mario Sunshine"
              }
            ]
          },
          {
            "name": "Super Mario Galaxy",
            "year": 2007,
            "releaseDate": 1193875200,
            "storyRank": 2,
            "editions": [
              {
                "id": 1077,
                "name": "Super Mario Galaxy"
              }
            ]
          },
          {
            "name": "Super Mario Galaxy 2",
            "year": 2010,
            "releaseDate": 1274572800,
            "storyRank": 3,
            "editions": [
              {
                "id": 1078,
                "name": "Super Mario Galaxy 2"
              }
            ]
          },
          {
            "name": "Super Mario 3D Land",
            "year": 2011,
            "releaseDate": 1320278400,
            "storyRank": 4,
            "editions": [
              {
                "id": 1079,
                "name": "Super Mario 3D Land"
              }
            ]
          },
          {
            "name": "Super Mario 3D World",
            "year": 2013,
            "releaseDate": 1384992000,
            "storyRank": 5,
            "editions": [
              {
                "id": 2180,
                "name": "Super Mario 3D World"
              }
            ]
          },
          {
            "name": "Super Mario Odyssey",
            "year": 2017,
            "releaseDate": 1509062400,
            "storyRank": 6,
            "editions": [
              {
                "id": 26758,
                "name": "Super Mario Odyssey"
              }
            ]
          }
        ]
      },
      {
        "key": "paper-mario",
        "name": "Paper Mario",
        "source": "https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/Paper-Mario-The-Thousand-Year-Door-2445545.html",
        "storyOrder": false,
        "entries": [
          {
            "name": "Paper Mario",
            "year": 2000,
            "releaseDate": 965952000,
            "storyRank": 0,
            "editions": [
              {
                "id": 3340,
                "name": "Paper Mario"
              }
            ]
          },
          {
            "name": "Paper Mario: The Thousand-Year Door",
            "year": 2004,
            "releaseDate": 1090454400,
            "storyRank": 1,
            "editions": [
              {
                "id": 3349,
                "name": "Paper Mario: The Thousand-Year Door · 2004"
              },
              {
                "id": 266690,
                "name": "Paper Mario: The Thousand-Year Door · 2024"
              }
            ]
          },
          {
            "name": "Super Paper Mario",
            "year": 2007,
            "releaseDate": 1176076800,
            "storyRank": 2,
            "editions": [
              {
                "id": 2191,
                "name": "Super Paper Mario"
              }
            ]
          },
          {
            "name": "Paper Mario: Sticker Star",
            "year": 2012,
            "releaseDate": 1352505600,
            "storyRank": 3,
            "editions": [
              {
                "id": 3350,
                "name": "Paper Mario: Sticker Star"
              }
            ]
          },
          {
            "name": "Paper Mario: Color Splash",
            "year": 2016,
            "releaseDate": 1475712000,
            "storyRank": 4,
            "editions": [
              {
                "id": 18169,
                "name": "Paper Mario: Color Splash"
              }
            ]
          },
          {
            "name": "Paper Mario: The Origami King",
            "year": 2020,
            "releaseDate": 1594944000,
            "storyRank": 5,
            "editions": [
              {
                "id": 133923,
                "name": "Paper Mario: The Origami King"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "key": "lego-star-wars",
    "name": "LEGO Star Wars",
    "publisher": "Lucasfilm / LEGO",
    "franchises": [],
    "series": [
      55
    ],
    "pattern": "^LEGO Star Wars\\b",
    "note": "adaptations",
    "branches": [
      {
        "key": "lego-star-wars",
        "name": "LEGO Star Wars",
        "source": "https://www.lego.com/en-us/themes/star-wars/games/skywalker-saga",
        "storyOrder": false,
        "entries": [
          {
            "name": "LEGO Star Wars: The Video Game",
            "year": 2005,
            "releaseDate": 1112400000,
            "storyRank": 0,
            "editions": [
              {
                "id": 2681,
                "name": "LEGO Star Wars: The Video Game"
              }
            ]
          },
          {
            "name": "LEGO Star Wars II: The Original Trilogy",
            "year": 2006,
            "releaseDate": 1157932800,
            "storyRank": 1,
            "editions": [
              {
                "id": 190,
                "name": "LEGO Star Wars II: The Original Trilogy"
              }
            ]
          },
          {
            "name": "LEGO Star Wars: The Complete Saga",
            "year": 2007,
            "releaseDate": 1194307200,
            "storyRank": 2,
            "editions": [
              {
                "id": 2682,
                "name": "LEGO Star Wars: The Complete Saga"
              }
            ]
          },
          {
            "name": "LEGO Star Wars III: The Clone Wars",
            "year": 2011,
            "releaseDate": 1298851200,
            "storyRank": 3,
            "editions": [
              {
                "id": 6844,
                "name": "LEGO Star Wars III: The Clone Wars"
              }
            ]
          },
          {
            "name": "LEGO Star Wars: The Force Awakens",
            "year": 2016,
            "releaseDate": 1466985600,
            "storyRank": 4,
            "editions": [
              {
                "id": 17030,
                "name": "LEGO Star Wars: The Force Awakens"
              }
            ]
          },
          {
            "name": "LEGO Star Wars: The Skywalker Saga",
            "year": 2022,
            "releaseDate": 1649116800,
            "storyRank": 5,
            "editions": [
              {
                "id": 119305,
                "name": "LEGO Star Wars: The Skywalker Saga"
              }
            ]
          }
        ]
      }
    ]
  }
];
