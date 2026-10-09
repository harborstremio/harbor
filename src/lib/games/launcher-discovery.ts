import type { GameSummary } from "./types";
import { launcherSceneArtwork, launcherTitleLogo } from "./launcher-title-art";

export type LauncherDiscoveryId = "rsi" | "bsg" | "epic" | "riot" | "battlenet" | "ea" | "ubisoft" | "gog" | "rockstar" | "xbox" | "hoyoplay" | "itch" | "amazon" | "steam";
export type LauncherDiscoveryGame = GameSummary & { hero?: string; logo?: string; description?: string; genreNames?: string[]; officialUrl?: string; chartRank?: number };
export type LauncherDiscovery = { id: LauncherDiscoveryId; name: string; logo: string; website: string; catalogUrl: string; monochrome?: boolean; games: LauncherDiscoveryGame[] };

// Editorial game picks with exact IGDB identities, verified October 1, 2026.
// These are neither full storefront catalogs nor live popularity rankings.
const picks: Record<number, LauncherDiscoveryGame> = {
  "115": {
    "id": "igdb:115",
    "igdbId": 115,
    "name": "League of Legends",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar57t1.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coc99o.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar57t1.jpg",
    "platforms": [
      "PC (Microsoft Windows)",
      "Mac"
    ],
    "description": "League of Legends is a fast-paced, competitive online game that blends the speed and intensity of an RTS with RPG elements. Two teams of powerful champions, each with a unique design and playstyle, battle head-to-head across multiple battlefields and game modes. With an ever-expanding roster of champions, frequent updates and a thriving tournament scene, League of Legends offers endless replayability for players of every skill level.",
    "genreNames": [],
    "officialUrl": "https://www.leagueoflegends.com/"
  },
  "123": {
    "id": "igdb:123",
    "igdbId": 123,
    "name": "World of Warcraft",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar583d.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2l7z.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar583d.jpg",
    "platforms": [
      "PC (Microsoft Windows)",
      "Mac"
    ],
    "description": "World of Warcraft is a massively multiplayer online roleplaying game (MMORPG) set in the Warcraft universe. Players assume the roles of Warcraft heroes as they explore, adventure, and quest across a vast world. Being \"Massively Multiplayer,\" World of Warcraft allows thousands of players to interact within the same world. Whether adventuring together or fighting against each other in epic battles, players will form friendships, forge alliances, and compete with enemies for power and glory.",
    "genreNames": [],
    "officialUrl": "https://worldofwarcraft.com"
  },
  "239": {
    "id": "igdb:239",
    "igdbId": 239,
    "name": "StarCraft II: Wings of Liberty",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/rchvtoqmrqxldczm19gy.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1tnn.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/rchvtoqmrqxldczm19gy.jpg",
    "platforms": [
      "PC (Microsoft Windows)",
      "Mac"
    ],
    "description": "StarCraft II: Wings of Liberty is a science fiction real-time strategy game and the sequel to the original StarCraft. Set four years after the events of Brood War, the game revolves around three species: the Terrans, the Zerg, and the Protoss. The single-player campaign focuses on the Terrans, following Jim Raynor as he leads an insurgent group against the autocratic Terran Dominion. The campaign is non-linear, with players taking missions for money and using those funds to buy additional units and upgrades between missions aboard the battlecruiser Hyperion.\n\nThe game features competitive mult",
    "genreNames": [],
    "officialUrl": "https://us.battle.net/shop/en/product/starcraft-ii-wings-of-liberty"
  },
  "1020": {
    "id": "steam:271590",
    "igdbId": 1020,
    "steamId": 271590,
    "name": "Grand Theft Auto V",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3m56.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2lbd.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3m56.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PlayStation 3",
      "PlayStation 4",
      "PC (Microsoft Windows)",
      "PlayStation 5",
      "Xbox 360",
      "Xbox One"
    ],
    "description": "Grand Theft Auto V is a vast open world game set in Los Santos, a sprawling sun-soaked metropolis struggling to stay afloat in an era of economic uncertainty and cheap reality TV. The game blends storytelling and gameplay in new ways as players repeatedly jump in and out of the lives of the game’s three lead characters, playing all sides of the game’s interwoven story.",
    "genreNames": [],
    "officialUrl": "https://www.rockstargames.com/V/"
  },
  "1279": {
    "id": "igdb:1279",
    "igdbId": 1279,
    "name": "Hearthstone",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar5zjl.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1sh2.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar5zjl.jpg",
    "platforms": [
      "Android",
      "PC (Microsoft Windows)",
      "iOS",
      "Mac"
    ],
    "description": "Hearthstone is a free-to-play digital collectible card game set in the Warcraft universe. Originally subtitled Heroes of Warcraft, the game features turn-based one-on-one matches where players build 30-card decks and select heroes from eleven classes, each with unique abilities. Players spend mana crystals each turn to summon minions, cast spells, and use weapons with the goal of reducing their opponent's health to zero. The game includes multiple modes such as ranked competitive play, Arena drafting, Battlegrounds (an auto battler for eight players), and rotating Tavern Brawl challenges. New ",
    "genreNames": [],
    "officialUrl": "https://hearthstone.blizzard.com/en-us"
  },
  "1595": {
    "id": "igdb:1595",
    "igdbId": 1595,
    "name": "Star Citizen",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4d58.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cocrru.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4d58.jpg",
    "platforms": [
      "PC (Microsoft Windows)"
    ],
    "description": "Star Citizen is a sandbox open-world MMO \"SpaceSim\" by Cloud Imperium Games. Explore the 'verse, fight, trade, and more when you play Star Citizen!",
    "genreNames": [],
    "officialUrl": "https://robertsspaceindustries.com/star-citizen/"
  },
  "1877": {
    "id": "steam:1091500",
    "igdbId": 1877,
    "steamId": 1091500,
    "name": "Cyberpunk 2077",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ig0frvvkkz4jx7cyqt3f.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaih8.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ig0frvvkkz4jx7cyqt3f.jpg",
    "platforms": [
      "Google Stadia",
      "Xbox Series X|S",
      "PlayStation 4",
      "Nintendo Switch 2",
      "PC (Microsoft Windows)",
      "PlayStation 5",
      "Mac",
      "Xbox One"
    ],
    "description": "Cyberpunk 2077 is an open-world action-adventure game set in Night City, a sprawling metropolis driven by power, glamour, and body modification. Players assume the role of V, a mercenary outlaw in pursuit of a unique implant that holds the key to immortality. The game allows extensive customization of cyberware, skills, and playstyle. Choices made throughout the journey influence both the narrative and the world.",
    "genreNames": [],
    "officialUrl": "https://www.cyberpunk.net"
  },
  "1905": {
    "id": "igdb:1905",
    "igdbId": 1905,
    "name": "Fortnite",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6aet.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cocxbi.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6aet.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PlayStation 4",
      "Nintendo Switch 2",
      "Android",
      "PC (Microsoft Windows)",
      "iOS",
      "PlayStation 5",
      "Mac",
      "Xbox One",
      "Nintendo Switch"
    ],
    "description": "Fortnite is a free-to-play online game where you and your friends can create, play and battle. Be the last player standing in Battle Royale and Zero Build, experience a concert or live event, or discover over a million creator-made games, including racing, parkour, zombie survival and more.",
    "genreNames": [],
    "officialUrl": "https://www.fortnite.com/"
  },
  "1942": {
    "id": "steam:292030",
    "igdbId": 1942,
    "steamId": 292030,
    "name": "The Witcher 3: Wild Hunt",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6ijr.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaarl.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6ijr.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PlayStation 4",
      "PC (Microsoft Windows)",
      "PlayStation 5",
      "Xbox One",
      "Nintendo Switch"
    ],
    "description": "The Witcher 3: Wild Hunt is an open-world action role-playing game developed by CD Projekt Red.\n\nSet in a dark fantasy world, the game follows Geralt of Rivia, a monster hunter searching for his adopted daughter, Ciri, while navigating political conflicts and supernatural threats. Gameplay features exploration, combat, character progression, and branching narratives shaped by player choices. Widely acclaimed for its writing, world-building, and depth, it is considered one of the most influential RPGs of its generation.",
    "genreNames": [
      "Role-playing (RPG)",
      "Adventure"
    ]
  },
  "2963": {
    "id": "steam:570",
    "igdbId": 2963,
    "steamId": 570,
    "name": "Dota 2",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar57tk.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cobfk4.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar57tk.jpg",
    "platforms": [
      "Linux",
      "PC (Microsoft Windows)",
      "Mac"
    ],
    "description": "Dota 2 is a multiplayer online battle arena video game and the stand-alone sequel to the Defense of the Ancients (DotA) mod. With regular updates that ensure a constant evolution of gameplay, features, and heroes, Dota 2 has taken on a life of its own.",
    "genreNames": [
      "Strategy",
      "MOBA"
    ],
    "officialUrl": "https://www.dota2.com/"
  },
  "3212": {
    "id": "steam:1222670",
    "igdbId": 3212,
    "steamId": 1222670,
    "name": "The Sims 4",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar5la.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3h3l.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar5la.jpg",
    "platforms": [
      "PlayStation 4",
      "PC (Microsoft Windows)",
      "Mac",
      "Xbox One"
    ],
    "description": "Unleash your imagination and create a unique world of Sims that's an expression of you! Explore and customize every detail from Sims to homes, and much more with The Sims 4. Life, and Sims, are yours to control. Customize your unique Sims, design their homes & take them on wild adventures through celebdom, romance, holidays and more.",
    "genreNames": [],
    "officialUrl": "https://www.ea.com/games/the-sims/the-sims-4/features"
  },
  "15536": {
    "id": "steam:3932890",
    "igdbId": 15536,
    "steamId": 3932890,
    "name": "Escape from Tarkov",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar526d.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coco22.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar526d.jpg",
    "platforms": [
      "PC (Microsoft Windows)"
    ],
    "description": "Escape from Tarkov is a hardcore and realistic online first-person action RPG/Simulator with MMO features and story-driven walkthrough.",
    "genreNames": []
  },
  "19128": {
    "id": "igdb:19128",
    "igdbId": 19128,
    "name": "Squadron 42",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4d4p.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co90ek.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4d4p.jpg",
    "platforms": [
      "PC (Microsoft Windows)"
    ],
    "description": "Take the role of a rookie UEE Navy combat pilot in a cinematic single-player epic adventure set in the Star Citizen universe. Battle in the stars and face-to-face as you seamlessly transition between dogfighting and ground combat. Serve aboard a massive Navy capital ship as your custom character interacts and builds relationships with a living, breathing crew. Cutting-edge performance capture brings unprecedented emotion and life to some of your favorite actors. Powered by StarEngine, Squadron 42 pushes gaming graphics and fidelity to the next level.",
    "genreNames": [
      "Shooter",
      "Simulator",
      "Adventure",
      "Indie"
    ],
    "officialUrl": "https://squadron42.com/"
  },
  "25076": {
    "id": "steam:1174180",
    "igdbId": 25076,
    "steamId": 1174180,
    "name": "Red Dead Redemption 2",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/l0kjrldascktx2kzqhbi.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1q1f.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/l0kjrldascktx2kzqhbi.jpg",
    "platforms": [
      "Google Stadia",
      "PlayStation 4",
      "PC (Microsoft Windows)",
      "Xbox One"
    ],
    "description": "Red Dead Redemption 2 is the epic tale of outlaw Arthur Morgan and the infamous Van der Linde gang, on the run across America at the dawn of the modern age.",
    "genreNames": [],
    "officialUrl": "https://www.rockstargames.com/reddeadredemption2/"
  },
  "26128": {
    "id": "steam:1599340",
    "igdbId": 26128,
    "steamId": 1599340,
    "name": "Lost Ark",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar61i.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4w4j.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar61i.jpg",
    "platforms": [
      "PC (Microsoft Windows)"
    ],
    "description": "Embark on an odyssey for the Lost Ark in a vast, vibrant world: explore new lands, seek out lost treasures, and test yourself in thrilling action combat. Define your fighting style with your class and advanced class, and customize your skills, weapons, and gear to bring your might to bear as you fight against hordes of enemies, colossal bosses, and dark forces seeking the power of the Ark in this action-packed free-to-play RPG.",
    "genreNames": [],
    "officialUrl": "https://www.playlostark.com/"
  },
  "26226": {
    "id": "steam:504230",
    "igdbId": 26226,
    "steamId": 504230,
    "name": "Celeste",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6ga3.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cob9dh.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6ga3.jpg",
    "platforms": [
      "Google Stadia",
      "PlayStation 4",
      "Linux",
      "PC (Microsoft Windows)",
      "Mac",
      "Xbox One",
      "Nintendo Switch"
    ],
    "description": "Help Madeline survive her inner demons on her journey to the top of Celeste Mountain, in this super-tight platformer from the creators of TowerFall. Brave hundreds of hand-crafted challenges, uncover devious secrets, and piece together the mystery of the mountain.",
    "genreNames": []
  },
  "55935": {
    "id": "steam:698780",
    "igdbId": 55935,
    "steamId": 698780,
    "name": "Doki Doki Literature Club!",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/arku8.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co6p5e.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/arku8.jpg",
    "platforms": [
      "Linux",
      "Android",
      "PC (Microsoft Windows)",
      "iOS",
      "Mac"
    ],
    "description": "The Literature Club is full of cute girls! Will you write the way into their heart? This game is not suitable for children or those who are easily disturbed.",
    "genreNames": [
      "Adventure",
      "Indie",
      "Visual Novel"
    ],
    "officialUrl": "https://ddlc.moe/"
  },
  "90099": {
    "id": "steam:2221490",
    "igdbId": 90099,
    "steamId": 2221490,
    "name": "Tom Clancy's The Division 2",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/hhugqt4h0g07jxpywark.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1xrm.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/hhugqt4h0g07jxpywark.jpg",
    "platforms": [
      "Google Stadia",
      "Xbox Series X|S",
      "PlayStation 4",
      "PC (Microsoft Windows)",
      "PlayStation 5",
      "Xbox One"
    ],
    "description": "The Division 2 is an action-shooter RPG set in an open-world. Play in co-op and PvP modes that offer more variety in missions and challenges, new progression systems with unique twists and surprises, and fresh gaming innovations to engage players for years to come.",
    "genreNames": [
      "Shooter",
      "Role-playing (RPG)",
      "Tactical",
      "Adventure"
    ],
    "officialUrl": "https://www.ubisoft.com/en-gb/game/the-division"
  },
  "103281": {
    "id": "steam:1240440",
    "igdbId": 103281,
    "steamId": 1240440,
    "name": "Halo Infinite",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6b6b.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2dto.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6b6b.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PC (Microsoft Windows)",
      "Xbox One"
    ],
    "description": "Halo Infinite is a first-person shooter and the sixth mainline entry in the Halo series. The game features a semi-open world campaign set on the Forerunner ringworld Zeta Halo, where players control the supersoldier Master Chief in combat against the Banished, a mercenary faction of aliens and humans. Players traverse the environment on foot and in vehicles, capturing forward operating bases, rescuing Marines, and completing story missions that advance the narrative. Equipment such as the Grappleshot adds traversal and combat options. The multiplayer component is free-to-play and includes vari",
    "genreNames": [],
    "officialUrl": "https://www.halowaypoint.com/halo-infinite"
  },
  "114795": {
    "id": "steam:1172470",
    "igdbId": 114795,
    "steamId": 1172470,
    "name": "Apex Legends",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4p99.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cocqh2.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4p99.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PlayStation 4",
      "Nintendo Switch 2",
      "PC (Microsoft Windows)",
      "PlayStation 5",
      "Xbox One",
      "Nintendo Switch"
    ],
    "description": "Conquer with character in Apex Legends, a free-to-play Hero shooter where legendary characters with powerful abilities team up to battle for fame & fortune on the fringes of the Frontier.\n\nMaster an ever-growing roster of diverse Legends, deep tactical squad play and bold new innovations that go beyond the Battle Royale experience—all within a rugged world where anything goes. Welcome to the next evolution of Hero Shooter.",
    "genreNames": [],
    "officialUrl": "https://www.ea.com/games/apex-legends"
  },
  "119171": {
    "id": "steam:1086940",
    "igdbId": 119171,
    "steamId": 1086940,
    "name": "Baldur's Gate III",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3n2t.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co670h.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3n2t.jpg",
    "platforms": [
      "Google Stadia",
      "Xbox Series X|S",
      "Linux",
      "PC (Microsoft Windows)",
      "PlayStation 5",
      "Mac"
    ],
    "description": "An ancient evil has returned to Baldur's Gate, intent on devouring it from the inside out. The fate of Faerun lies in your hands. Alone, you may resist. But together, you can overcome.",
    "genreNames": [],
    "officialUrl": "https://baldursgate3.game"
  },
  "119277": {
    "id": "igdb:119277",
    "igdbId": 119277,
    "name": "Genshin Impact",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar2ht4.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coa9dy.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar2ht4.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PlayStation 4",
      "Android",
      "PC (Microsoft Windows)",
      "iOS",
      "PlayStation 5"
    ],
    "description": "Genshin Impact is an open-world action RPG, where you embark on a journey across Teyvat to find your lost sibling and seek answers from The Seven, the gods of each element. Explore this wondrous world, join forces with a diverse range of characters, and unravel the countless mysteries that Teyvat holds...",
    "genreNames": [],
    "officialUrl": "https://genshin.hoyoverse.com/"
  },
  "120176": {
    "id": "igdb:120176",
    "igdbId": 120176,
    "name": "Teamfight Tactics",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6rs.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cocsmb.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6rs.jpg",
    "platforms": [
      "Android",
      "PC (Microsoft Windows)",
      "iOS",
      "Mac"
    ],
    "description": "Teamfight Tactics is a round-based strategy game that pits you against seven opponents in a free-for-all race to build a powerful team that fights on your behalf. Your goal: Be the last person standing.",
    "genreNames": [],
    "officialUrl": "https://na.leagueoflegends.com/en/featured/events/teamfight-tactics"
  },
  "125165": {
    "id": "steam:2344520",
    "igdbId": 125165,
    "steamId": 2344520,
    "name": "Diablo IV",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6arq.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co69sm.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar6arq.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PlayStation 4",
      "PC (Microsoft Windows)",
      "PlayStation 5",
      "Xbox One"
    ],
    "description": "Endless demons to slaughter. Deep customization through Talents, Skill Points, Runes, and Legendary loot. Randomized dungeons contained in a dynamic open world. Survive and conquer darkness—or succumb to the shadows.",
    "genreNames": [],
    "officialUrl": "https://diablo4.blizzard.com/en-us"
  },
  "126459": {
    "id": "igdb:126459",
    "igdbId": 126459,
    "name": "Valorant",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar5iqo.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cocqbp.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar5iqo.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PC (Microsoft Windows)",
      "PlayStation 5"
    ],
    "description": "Valorant is a character-based 5v5 tactical shooter set on the global stage. Outwit, outplay, and outshine your competition with tactical abilities, precise gunplay, and adaptive teamwork.",
    "genreNames": [],
    "officialUrl": "https://playvalorant.com/"
  },
  "141503": {
    "id": "steam:1551360",
    "igdbId": 141503,
    "steamId": 1551360,
    "name": "Forza Horizon 5",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4tba.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3ofx.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4tba.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PC (Microsoft Windows)",
      "PlayStation 5",
      "Xbox One"
    ],
    "description": "Your Ultimate Horizon Adventure awaits! Explore the vibrant and ever-evolving open-world landscapes of Mexico with limitless, fun driving action in hundreds of the world’s greatest cars.",
    "genreNames": [],
    "officialUrl": "https://forza.net/"
  },
  "178282": {
    "id": "igdb:178282",
    "igdbId": 178282,
    "name": "Honkai: Star Rail",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar1e8k.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cod0ux.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar1e8k.jpg",
    "platforms": [
      "Android",
      "PC (Microsoft Windows)",
      "iOS",
      "PlayStation 5"
    ],
    "description": "Honkai: Star Rail is an all-new strategy-RPG title in the Honkai series that takes players on a cosmic adventure across the stars. Hop aboard the Astral Express and experience the galaxy's infinite wonders on this journey filled with adventure and thrill.",
    "genreNames": [],
    "officialUrl": "https://hsr.hoyoverse.com/"
  },
  "185246": {
    "id": "igdb:185246",
    "igdbId": 185246,
    "name": "Alan Wake II",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3nuh.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co6jar.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3nuh.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PC (Microsoft Windows)",
      "PlayStation 5"
    ],
    "description": "Alan Wake 2 marks Remedy Entertainment’s first foray into the survival horror genre. Ritualistic murders in a small town. A writer trapped in a nightmare. An FBI agent looking for answers. Two realities. Two hero characters. One horror story that wants them dead.",
    "genreNames": [],
    "officialUrl": "https://www.alanwake.com/"
  },
  "200551": {
    "id": "steam:4162040",
    "igdbId": 200551,
    "steamId": 4162040,
    "name": "Zenless Zone Zero",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4qbk.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cocnek.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4qbk.jpg",
    "platforms": [
      "Xbox Series X|S",
      "Android",
      "PC (Microsoft Windows)",
      "iOS",
      "PlayStation 5"
    ],
    "description": "Zenless Zone Zero is an all-new 3D action game from HoYoverse, here to provide a thrilling combat experience. Build a squad of up to three and begin your assault with Basic and Special Attacks. Dodge and Parry to neutralize your opponents' counterattacks, and when they're Stunned, unleash a powerful combo of Chain Attacks to finish them off! Remember, different opponents have different traits, and it would be prudent to use their weaknesses to your advantage.",
    "genreNames": [],
    "officialUrl": "https://zenless.hoyoverse.com/"
  },
  "203610": {
    "id": "igdb:203610",
    "igdbId": 203610,
    "name": "Escape from Tarkov: Arena",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar2sdq.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cocxnk.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar2sdq.jpg",
    "platforms": [
      "PC (Microsoft Windows)"
    ],
    "description": "Escape from Tarkov Arena is a standalone game project - a session-based multiplayer first-person shooter for PC with all the known and beloved hardcore game mechanics of Escape from Tarkov.\nPlayers will take part in gladiatorial battles in various arenas of the city of Tarkov, organized by a mysterious group of Arena Masters led by the Host.\n\nThe game will feature various PvP and PvE game modes, ratings, weapon and gear unlocks and unique features for owners of the main Escape from Tarkov game, like the ability to play as your main profile character.",
    "genreNames": [],
    "officialUrl": "https://arena.tarkov.com/"
  },
  "242408": {
    "id": "steam:730",
    "igdbId": 242408,
    "steamId": 730,
    "name": "Counter-Strike 2",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4kon.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaczd.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar4kon.jpg",
    "platforms": [
      "Linux",
      "PC (Microsoft Windows)"
    ],
    "description": "Counter-Strike 2 is a free-to-play multiplayer tactical first-person shooter developed and published by Valve. Released in September 2023, it is the fifth main entry in the Counter-Strike series and serves as a direct replacement for Counter-Strike: Global Offensive on Steam. Two teams, Terrorists and Counter-Terrorists, compete in objective-based rounds across modes such as bomb defusal and hostage rescue. Built on the Source 2 engine, the game introduced volumetric smoke physics, revised weapon handling, and a new sub-tick server architecture. It inherited all cosmetic items from its predece",
    "genreNames": [
      "Shooter",
      "Tactical"
    ],
    "officialUrl": "https://www.counter-strike.net/cs2"
  },
  "300976": {
    "id": "steam:3159330",
    "igdbId": 300976,
    "steamId": 3159330,
    "name": "Assassin's Creed Shadows",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3mk0.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co87cu.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3mk0.jpg",
    "platforms": [
      "Xbox Series X|S",
      "Nintendo Switch 2",
      "PC (Microsoft Windows)",
      "PlayStation 5",
      "Mac"
    ],
    "description": "Experience an epic historical action-adventure story set in feudal Japan! Become a lethal shinobi Assassin and a powerful legendary samurai as you explore a beautiful open world in a time of chaos. Switch seamlessly between two unlikely allies as you discover their common destiny. Master complementary playstyles, create your shinobi league, customize your hideout, and usher in a new era for Japan.",
    "genreNames": [],
    "officialUrl": "https://www.ubisoft.com/en-us/game/assassins-creed/shadows"
  },
  "305027": {
    "id": "igdb:305027",
    "igdbId": 305027,
    "name": "New World: Aeternum",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar2zm7.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co8xuo.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar2zm7.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PlayStation 5"
    ],
    "description": "Aeternum is separate from the original New World but also contains everything from New World and its Rise of the Angry Earth expansion, retooled for consoles, and featuring a slew of changes and additions that go beyond what you'd expect in just an update.",
    "genreNames": []
  },
  "317407": {
    "id": "steam:2807960",
    "igdbId": 317407,
    "steamId": 2807960,
    "name": "Battlefield 6",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3vs1.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coa5zt.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3vs1.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PC (Microsoft Windows)",
      "PlayStation 5"
    ],
    "description": "Battlefield 6 is a first-person shooter featuring a single-player campaign and team-based online multiplayer. Players fight as infantry or operate military vehicles across large-scale battlefields, using class-based squad roles, environmental destruction, and a range of weapons and equipment.\n\nThe game also includes Battlefield Portal, a toolset for creating and sharing custom multiplayer experiences.",
    "genreNames": [],
    "officialUrl": "https://www.ea.com/games/battlefield/battlefield-6"
  },
  "349484": {
    "id": "igdb:349484",
    "igdbId": 349484,
    "name": "Tom Clancy's Rainbow Six Siege X",
    "capsule": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/scxits.jpg",
    "portrait": "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co9zbc.jpg",
    "hero": "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/scxits.jpg",
    "platforms": [
      "Xbox Series X|S",
      "PlayStation 4",
      "PC (Microsoft Windows)",
      "PlayStation 5"
    ],
    "description": "Rainbow Six Siege X is the reference in tactical team shooters, where elite strategy and execution triumph. Enjoy free access to Quick Match, Unranked and Dual Front game modes with a selection of operators.",
    "genreNames": [
      "Shooter",
      "Tactical"
    ],
    "officialUrl": "https://www.ubisoft.com/en-gb/game/rainbow-six/siege/game-info/discover"
  }
};
/** Reuse verified cover art without copying a discovery pick's store identity. */
export function launcherCatalogArtwork(igdbId: number | undefined) {
  const game = igdbId === undefined ? undefined : picks[igdbId];
  return game ? { capsule: game.capsule, portrait: game.portrait } : undefined;
}

/** A discovery pick is not proof of a Steam copy or a particular installed launcher. */
export function launcherDiscoveryGame<T extends LauncherDiscoveryGame>(game: T, launcher: LauncherDiscoveryId) {
  if (!Number.isSafeInteger(game.igdbId) || game.igdbId! <= 0) throw Error("Missing discovery identity");
  const { steamId: _steamId, ...withoutSteam } = game;
  const identity = launcher === "steam" ? game : { ...withoutSteam, id: `igdb:${game.igdbId}` };
  const scene = launcherSceneArtwork(game.igdbId);
  const art = scene ? { ...identity, hero: scene, capsule: scene } : identity;
  return game.igdbId === 19128 && art.hero ? { ...art, portrait: art.hero } : art;
}
const games = (launcher: LauncherDiscoveryId, ...ids: number[]): LauncherDiscoveryGame[] => ids.map(id => launcherDiscoveryGame({ ...picks[id]!, logo: launcherTitleLogo(id) }, launcher));

export const LAUNCHER_DISCOVERY: readonly LauncherDiscovery[] = [
  { id: "steam", name: "Steam", logo: "/games/launchers/steam.svg", website: "https://store.steampowered.com/", catalogUrl: "https://store.steampowered.com/search/", monochrome: true, games: games("steam", 242408, 2963, 119171) },
  { id: "rsi", name: "RSI", logo: "/games/launchers/rsi.png", monochrome: true, website: "https://robertsspaceindustries.com/", catalogUrl: "https://robertsspaceindustries.com/en/star-citizen", games: games("rsi", 1595, 19128) },
  { id: "bsg", name: "Battlestate Games", logo: "/games/launchers/bsg.png", website: "https://www.battlestategames.com/", catalogUrl: "https://www.escapefromtarkov.com/", games: games("bsg", 15536, 203610) },
  { id: "epic", name: "Epic Games", logo: "/games/launchers/epic.svg", website: "https://store.epicgames.com/", catalogUrl: "https://store.epicgames.com/en-US/browse", monochrome: true, games: games("epic", 1905, 185246, 119277) },
  { id: "riot", name: "Riot Games", logo: "/games/launchers/riot.png", website: "https://www.riotgames.com/", catalogUrl: "https://www.riotgames.com/en", games: games("riot", 126459, 115, 120176) },
  { id: "battlenet", name: "Battle.net", logo: "/games/launchers/battlenet.png", website: "https://download.battle.net/", catalogUrl: "https://shop.battle.net/", games: games("battlenet", 123, 125165, 1279, 239) },
  { id: "ea", name: "EA app", logo: "/games/launchers/ea.png", website: "https://www.ea.com/ea-app", catalogUrl: "https://www.ea.com/games", games: games("ea", 3212, 114795, 317407) },
  { id: "ubisoft", name: "Ubisoft Connect", logo: "/games/launchers/ubisoft.png", website: "https://www.ubisoft.com/ubisoft-connect", catalogUrl: "https://store.ubisoft.com/", monochrome: true, games: games("ubisoft", 300976, 349484, 90099) },
  { id: "gog", name: "GOG", logo: "/games/launchers/gog.svg", website: "https://www.gog.com/galaxy", catalogUrl: "https://www.gog.com/en/games", monochrome: true, games: games("gog", 1877, 119171, 1942) },
  { id: "rockstar", name: "Rockstar Games", logo: "/games/launchers/rockstar.png", website: "https://www.rockstargames.com/", catalogUrl: "https://store.rockstargames.com/", games: games("rockstar", 1020, 25076) },
  { id: "xbox", name: "Xbox", logo: "/games/launchers/xbox.svg", website: "https://www.xbox.com/apps/xbox-app-on-pc", catalogUrl: "https://www.xbox.com/games", games: games("xbox", 141503, 103281) },
  { id: "hoyoplay", name: "HoYoPlay", logo: "/games/launchers/hoyoplay.png", website: "https://hoyoplay.hoyoverse.com/", catalogUrl: "https://hoyoplay.hoyoverse.com/", games: games("hoyoplay", 119277, 178282, 200551) },
  { id: "itch", name: "itch.io", logo: "/games/launchers/itch.svg", website: "https://itch.io/app", catalogUrl: "https://itch.io/games", monochrome: true, games: games("itch", 26226, 55935) },
  { id: "amazon", name: "Amazon Games", logo: "/games/launchers/amazon.ico", website: "https://www.amazongames.com/", catalogUrl: "https://www.amazongames.com/en-us/games", games: games("amazon", 305027, 26128) },
];

export async function loadLauncherDiscovery(id: LauncherDiscoveryId, signal?: AbortSignal): Promise<LauncherDiscovery> {
  const launcher = LAUNCHER_DISCOVERY.find(item => item.id === id);
  if (!launcher) throw Error("Unknown launcher");
  signal?.throwIfAborted();
  if (id === "steam") {
    const { loadMostPlayedGames } = await import("./catalog");
    const chart = await loadMostPlayedGames();
    signal?.throwIfAborted();
    return { ...launcher, games: [...chart.games].sort((a, b) => a.chartRank - b.chartRank).map(game => ({ ...game, hero: game.libraryHero || game.wideCapsule || game.capsule })) };
  }
  const [{ queryIgdb }, { ATLAS_DETAIL_FIELDS, parseAtlasGame }] = await Promise.all([import("./atlas"), import("./igdb-data")]);
  const ids = launcher.games.map(game => game.igdbId!);
  const rows = await queryIgdb(`fields ${ATLAS_DETAIL_FIELDS}; where id = (${ids.join(",")}); limit ${ids.length};`, signal, false, true);
  signal?.throwIfAborted();
  const verified = new Map(rows.map(parseAtlasGame).filter(game => ids.includes(game.igdbId)).map(game => [game.igdbId, game]));
  return { ...launcher, games: ids.flatMap(id => {
    const game = verified.get(id);
    return game ? [launcherDiscoveryGame({ ...game, logo: launcherTitleLogo(id), genreNames: game.genres.map(genre => genre.name), officialUrl: game.projectUrl }, launcher.id)] : [];
  }) };
}



