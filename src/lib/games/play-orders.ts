import {EXTRA_PLAY_ORDERS} from "./play-order-catalog.ts";
import type { AtlasGame } from "./igdb-data";
export type PlayOrderEntry = {name:string;year:number;releaseDate?:number;storyRank?:number;storyYear?:number;storyEndYear?:number;editions:{id:number;name:string}[]};
export type PlayOrderBranch = {key:string;name:string;source:string;storyOrder?:boolean;entries:PlayOrderEntry[]};
// Exact IGDB identities verified against Harbor's gateway, 2026-10-05.
// Release years are original release years, not the dates of ports or collections.
export const MEGA_MAN_ORDERS: PlayOrderBranch[] = [
  {
    "key": "classic",
    "name": "Mega Man",
    "source": "https://megaman.capcom.com/smmlc.html",
    "entries": [
      {
        "name": "Mega Man",
        "year": 1987,
        "editions": [
          {
            "id": 1714,
            "name": "Mega Man"
          }
        ]
      },
      {
        "name": "Mega Man 2",
        "year": 1989,
        "editions": [
          {
            "id": 1715,
            "name": "Mega Man 2"
          }
        ]
      },
      {
        "name": "Mega Man 3",
        "year": 1990,
        "editions": [
          {
            "id": 1716,
            "name": "Mega Man 3"
          }
        ]
      },
      {
        "name": "Mega Man 4",
        "year": 1991,
        "editions": [
          {
            "id": 1717,
            "name": "Mega Man 4"
          }
        ]
      },
      {
        "name": "Mega Man 5",
        "year": 1992,
        "editions": [
          {
            "id": 1718,
            "name": "Mega Man 5"
          }
        ]
      },
      {
        "name": "Mega Man 6",
        "year": 1993,
        "editions": [
          {
            "id": 1719,
            "name": "Mega Man 6"
          }
        ]
      },
      {
        "name": "Mega Man 7",
        "year": 1995,
        "editions": [
          {
            "id": 1720,
            "name": "Mega Man 7"
          }
        ]
      },
      {
        "name": "Mega Man 8",
        "year": 1996,
        "editions": [
          {
            "id": 1721,
            "name": "Mega Man 8"
          }
        ]
      },
      {
        "name": "Mega Man 9",
        "year": 2008,
        "editions": [
          {
            "id": 1722,
            "name": "Mega Man 9"
          }
        ]
      },
      {
        "name": "Mega Man 10",
        "year": 2010,
        "editions": [
          {
            "id": 1723,
            "name": "Mega Man 10"
          }
        ]
      },
      {
        "name": "Mega Man 11",
        "year": 2018,
        "editions": [
          {
            "id": 76723,
            "name": "Mega Man 11"
          }
        ]
      }
    ]
  },
  {
    "key": "x",
    "name": "Mega Man X",
    "source": "https://megaman.capcom.com/mmxlc.html",
    "entries": [
      {
        "name": "Mega Man X",
        "year": 1993,
        "editions": [
          {
            "id": 1741,
            "name": "Mega Man X"
          }
        ]
      },
      {
        "name": "Mega Man X2",
        "year": 1994,
        "editions": [
          {
            "id": 1742,
            "name": "Mega Man X2"
          }
        ]
      },
      {
        "name": "Mega Man X3",
        "year": 1995,
        "editions": [
          {
            "id": 1743,
            "name": "Mega Man X3"
          }
        ]
      },
      {
        "name": "Mega Man X4",
        "year": 1997,
        "editions": [
          {
            "id": 1744,
            "name": "Mega Man X4"
          }
        ]
      },
      {
        "name": "Mega Man X5",
        "year": 2000,
        "editions": [
          {
            "id": 1745,
            "name": "Mega Man X5"
          }
        ]
      },
      {
        "name": "Mega Man X6",
        "year": 2001,
        "editions": [
          {
            "id": 1746,
            "name": "Mega Man X6"
          }
        ]
      },
      {
        "name": "Mega Man X7",
        "year": 2003,
        "editions": [
          {
            "id": 1747,
            "name": "Mega Man X7"
          }
        ]
      },
      {
        "name": "Mega Man X8",
        "year": 2004,
        "editions": [
          {
            "id": 1748,
            "name": "Mega Man X8"
          }
        ]
      }
    ]
  },
  {
    "key": "zero-zx",
    "name": "Mega Man Zero / ZX",
    "source": "https://us-store.captown.capcom.com/products/330017-us",
    "entries": [
      {
        "name": "Mega Man Zero",
        "year": 2002,
        "editions": [
          {
            "id": 1775,
            "name": "Mega Man Zero"
          }
        ]
      },
      {
        "name": "Mega Man Zero 2",
        "year": 2003,
        "editions": [
          {
            "id": 1776,
            "name": "Mega Man Zero 2"
          }
        ]
      },
      {
        "name": "Mega Man Zero 3",
        "year": 2004,
        "editions": [
          {
            "id": 1777,
            "name": "Mega Man Zero 3"
          }
        ]
      },
      {
        "name": "Mega Man Zero 4",
        "year": 2005,
        "editions": [
          {
            "id": 1778,
            "name": "Mega Man Zero 4"
          }
        ]
      },
      {
        "name": "Mega Man ZX",
        "year": 2006,
        "editions": [
          {
            "id": 1779,
            "name": "Mega Man ZX"
          }
        ]
      },
      {
        "name": "Mega Man ZX Advent",
        "year": 2007,
        "editions": [
          {
            "id": 1780,
            "name": "Mega Man ZX Advent"
          }
        ]
      }
    ]
  },
  {
    "key": "legends",
    "name": "Mega Man Legends",
    "source": "https://news.capcomusa.com/lets/browse/mega-man-legends-2-available-now-in-north-america-updated",
    "entries": [
      {
        "name": "Mega Man Legends",
        "year": 1997,
        "editions": [
          {
            "id": 1752,
            "name": "Mega Man Legends"
          }
        ]
      },
      {
        "name": "The Misadventures of Tron Bonne",
        "year": 1999,
        "editions": [
          {
            "id": 1753,
            "name": "The Misadventures of Tron Bonne"
          }
        ]
      },
      {
        "name": "Mega Man Legends 2",
        "year": 2000,
        "editions": [
          {
            "id": 1754,
            "name": "Mega Man Legends 2"
          }
        ]
      }
    ]
  },
  {
    "key": "battle-network",
    "name": "Mega Man Battle Network",
    "source": "https://www.capcom-games.com/megaman/exe/en-us/",
    "entries": [
      {
        "name": "Mega Man Battle Network",
        "year": 2001,
        "editions": [
          {
            "id": 1755,
            "name": "Mega Man Battle Network"
          }
        ]
      },
      {
        "name": "Mega Man Battle Network 2",
        "year": 2001,
        "editions": [
          {
            "id": 1756,
            "name": "Mega Man Battle Network 2"
          }
        ]
      },
      {
        "name": "Mega Man Battle Network 3",
        "year": 2002,
        "editions": [
          {
            "id": 1757,
            "name": "Mega Man Battle Network 3 White"
          },
          {
            "id": 1758,
            "name": "Mega Man Battle Network 3 Blue"
          }
        ]
      },
      {
        "name": "Mega Man Battle Network 4",
        "year": 2003,
        "editions": [
          {
            "id": 1759,
            "name": "Mega Man Battle Network 4: Red Sun"
          },
          {
            "id": 1760,
            "name": "Mega Man Battle Network 4: Blue Moon"
          }
        ]
      },
      {
        "name": "Mega Man Battle Network 5",
        "year": 2004,
        "editions": [
          {
            "id": 1761,
            "name": "Mega Man Battle Network 5: Team Protoman"
          },
          {
            "id": 1762,
            "name": "Mega Man Battle Network 5: Team Colonel"
          }
        ]
      },
      {
        "name": "Mega Man Battle Network 6",
        "year": 2006,
        "editions": [
          {
            "id": 1764,
            "name": "Mega Man Battle Network 6: Cybeast Falzar"
          },
          {
            "id": 1765,
            "name": "Mega Man Battle Network 6: Cybeast Gregar"
          }
        ]
      }
    ]
  },
  {
    "key": "star-force",
    "name": "Mega Man Star Force",
    "source": "https://www.capcom-games.com/megaman/starforce/",
    "entries": [
      {
        "name": "Mega Man Star Force",
        "year": 2006,
        "editions": [
          {
            "id": 1781,
            "name": "Mega Man Star Force: Pegasus"
          },
          {
            "id": 1782,
            "name": "Mega Man Star Force: Leo"
          },
          {
            "id": 1783,
            "name": "Mega Man Star Force: Dragon"
          }
        ]
      },
      {
        "name": "Mega Man Star Force 2",
        "year": 2007,
        "editions": [
          {
            "id": 1784,
            "name": "Mega Man Star Force 2: Zerker x Saurian"
          },
          {
            "id": 1785,
            "name": "Mega Man Star Force 2: Zerker x Ninja"
          }
        ]
      },
      {
        "name": "Mega Man Star Force 3",
        "year": 2008,
        "editions": [
          {
            "id": 1786,
            "name": "Mega Man Star Force 3: Black Ace"
          },
          {
            "id": 1787,
            "name": "Mega Man Star Force 3: Red Joker"
          }
        ]
      }
    ]
  }
];
export const METAL_GEAR_ORDER: PlayOrderBranch = {key:"metal-gear",name:"Metal Gear",source:"https://www.konami.com/mg/history/us/en/",entries:[
  {
    "name": "Metal Gear",
    "year": 1987,
    "editions": [
      {
        "id": 374,
        "name": "Metal Gear"
      }
    ],
    "storyYear": 1995
  },
  {
    "name": "Metal Gear 2: Solid Snake",
    "year": 1990,
    "editions": [
      {
        "id": 377,
        "name": "Metal Gear 2: Solid Snake"
      }
    ],
    "storyYear": 1999
  },
  {
    "name": "Metal Gear Solid",
    "year": 1998,
    "editions": [
      {
        "id": 375,
        "name": "Metal Gear Solid"
      },
      {
        "id": 4006,
        "name": "Metal Gear Solid: The Twin Snakes"
      }
    ],
    "storyYear": 2005
  },
  {
    "name": "Metal Gear Solid 2: Sons of Liberty",
    "year": 2001,
    "editions": [
      {
        "id": 376,
        "name": "Metal Gear Solid 2: Sons of Liberty"
      }
    ],
    "storyYear": 2007,
    "storyEndYear": 2009
  },
  {
    "name": "Metal Gear Solid 3: Snake Eater",
    "year": 2004,
    "editions": [
      {
        "id": 379,
        "name": "Metal Gear Solid 3: Snake Eater"
      },
      {
        "id": 479,
        "name": "Metal Gear Solid 3: Subsistence"
      },
      {
        "id": 250634,
        "name": "Metal Gear Solid Delta: Snake Eater"
      }
    ],
    "storyYear": 1964
  },
  {
    "name": "Metal Gear Solid 4: Guns of the Patriots",
    "year": 2008,
    "editions": [
      {
        "id": 380,
        "name": "Metal Gear Solid 4: Guns of the Patriots"
      }
    ],
    "storyYear": 2014
  },
  {
    "name": "Metal Gear Solid: Peace Walker",
    "year": 2010,
    "editions": [
      {
        "id": 382,
        "name": "Metal Gear Solid: Peace Walker"
      }
    ],
    "storyYear": 1974
  },
  {
    "name": "Metal Gear Solid V: Ground Zeroes",
    "year": 2014,
    "editions": [
      {
        "id": 5328,
        "name": "Metal Gear Solid V: Ground Zeroes"
      }
    ],
    "storyYear": 1975
  },
  {
    "name": "Metal Gear Solid V: The Phantom Pain",
    "year": 2015,
    "editions": [
      {
        "id": 1985,
        "name": "Metal Gear Solid V: The Phantom Pain"
      }
    ],
    "storyYear": 1984
  }
]};
export function playOrderFamily(game: Pick<AtlasGame,"name"|"franchises"> & Partial<Pick<AtlasGame,"igdbId"|"series">>): string|undefined {
  if(game.franchises.some(f=>f.id===38||f.id===2104)&&/^(?:mega\s?man|rockman|the misadventures of tron bonne)\b/i.test(game.name))return "mega-man";
  if(game.franchises.some(f=>f.id===463||f.id===551)&&/^metal gear\b/i.test(game.name))return "metal-gear";
  for(const family of EXTRA_PLAY_ORDERS) {
    const exact=family.branches.some(branch=>branch.entries.some(entry=>entry.editions.some(edition=>edition.id===game.igdbId)));
    const related=game.franchises.some(f=>family.franchises.includes(f.id))||game.series?.some(s=>family.series.includes(s.id));
    if(exact||(game.igdbId!==undefined&&family.aliases?.includes(game.igdbId))||(related&&new RegExp(family.pattern,"i").test(game.name)))return family.key;
  }
}
export function initialPlayOrder(game: Pick<AtlasGame,"igdbId"|"name">) {
  const exact=MEGA_MAN_ORDERS.find(branch=>branch.entries.some(entry=>entry.editions.some(edition=>edition.id===game.igdbId)));
  if(exact)return exact.key;
  if(/battle network|rockman exe/i.test(game.name))return "battle-network";
  if(/star force/i.test(game.name))return "star-force";
  if(/zero|zx/i.test(game.name))return "zero-zx";
  if(/legends|tron bonne|mega man 64/i.test(game.name))return "legends";
  if(/mega man x\b/i.test(game.name))return "x";
  return "classic";
}
export function playOrderDefinition(family:string) {
  if(family==="mega-man")return {key:family,name:"Mega Man",publisher:"Capcom",note:"mega-man",branches:MEGA_MAN_ORDERS};
  if(family==="metal-gear")return {key:family,name:"Metal Gear",publisher:"Konami",note:"metal-gear",branches:[METAL_GEAR_ORDER]};
  return EXTRA_PLAY_ORDERS.find(item=>item.key===family)!;
}
export function initialOrderBranch(family:string,game:Pick<AtlasGame,"igdbId"|"name">) {
  if(family==="mega-man")return initialPlayOrder(game);
  const branches=playOrderDefinition(family).branches;
  const exact=branches.find(branch=>branch.entries.some(entry=>entry.editions.some(edition=>edition.id===game.igdbId)));
  if(exact)return exact.key;
  if(family==="yakuza") {
    if(/Judgment/i.test(game.name))return "judgment";
    if(/Ishin/i.test(game.name))return "ishin";
    if(/Kenzan/i.test(game.name))return "kenzan";
    if(/Dead Souls/i.test(game.name))return "dead-souls";
  }
  if(family==="witcher"&&/Thronebreaker/i.test(game.name))return "thronebreaker";
  if(family==="mario") {
    if(/Paper Mario/i.test(game.name))return "paper-mario";
    if(/64|Sunshine|Galaxy|3D|Odyssey/i.test(game.name))return "mario-3d";
  }
  if(family==="sonic"&&/Adventure|Heroes|Unleashed|Colors|Generations|Lost World|Forces|Frontiers/i.test(game.name))return "sonic-3d";
  if(family==="gta") {
    if(/\bIV\b|\bV\b|Chinatown|Liberty City.*Episodes|Episodes from Liberty City/i.test(game.name))return "gta-hd";
    if(/London|Auto 2\b/i.test(game.name))return "gta-2d";
  }
  if(family==="star-wars") {
    if(/Knights of the Old Republic/i.test(game.name))return "kotor";
    if(/Force Unleashed/i.test(game.name))return "force-unleashed";
  }
  if(family==="red-dead") {
    if(/Revolver/i.test(game.name))return "revolver";
    if(/Undead/i.test(game.name))return "undead";
  }
  if(family==="walking-dead"&&/Michonne/i.test(game.name))return "michonne";
  return branches.find(branch=>branch.entries.some(entry=>entry.editions.some(edition=>edition.id===game.igdbId)))?.key??branches[0].key;
}
export function orderedGames(branch: PlayOrderBranch, order:"release"|"story") {
  return [...branch.entries].sort((a,b)=>order==="story"?(a.storyRank??a.storyYear??a.year)-(b.storyRank??b.storyYear??b.year):(a.releaseDate??Date.UTC(a.year,0,1)/1000)-(b.releaseDate??Date.UTC(b.year,0,1)/1000));
}
