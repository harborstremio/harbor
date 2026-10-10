// Original series marks; unchanged source files and provenance in public/games/franchises/README.md.
const ART:Record<string,{logo:string;originalColor?:boolean;hero?:string}> = {
  "franchise:29":{logo:"/games/franchises/resident-evil.svg"},
  "franchise:452":{logo:"/games/franchises/witcher.png"},
  "franchise:1034":{logo:"/games/franchises/fallout.svg"},
  "franchise:2098":{logo:"/games/franchises/god-of-war.png"},
  "franchise:596":{logo:"/games/franchises/zelda.svg"},
  "franchise:845":{logo:"/games/franchises/mario.svg",originalColor:true},
  "franchise:4":{logo:"/games/franchises/final-fantasy.svg"},
  "series:366":{logo:"/games/franchises/red-dead.png",originalColor:true},
  "franchise:8190":{logo:"/games/franchises/elden-ring.svg"},
  "series:562":{logo:"/games/franchises/mafia.svg"},
  "franchise:493":{logo:"/games/franchises/grand-theft-auto.png",originalColor:true,hero:"https://images.igdb.com/igdb/image/upload/t_1080p/sc10f91.jpg"},
  "franchise:1724":{logo:"/games/franchises/portal.png"},
  "franchise:456":{logo:"/games/franchises/elder-scrolls.svg",hero:"/games/franchises/skyrim-scene.jpg"},
  "franchise:1124":{logo:"/games/franchises/dark-souls.svg"},
  "franchise:798":{logo:"/games/franchises/doom.svg"},
  "franchise:1048":{logo:"/games/franchises/mass-effect.png"},
};
export const franchiseArtwork=(id:string)=>ART[id];
