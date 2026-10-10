/** Themed routes into the live catalog. Feature artwork is an editorial selection. */
export type GameCollection = { id:string; tag:number; feature:number; featureName:string; titleKey?:string };
export const GAME_COLLECTIONS: readonly GameCollection[] = [
  { id: 'worlds', tag: 1695, feature: 1245620, featureName: 'ELDEN RING' },
  { id: 'runs', tag: 3959, feature: 588650, featureName: 'Dead Cells' },
  { id: 'create', tag: 1643, feature: 526870, featureName: 'Satisfactory' },
  { id: 'stories', tag: 1742, feature: 1086940, featureName: "Baldur’s Gate 3" },
  { id: 'survival', tag: 1662, feature: 264710, featureName: 'Subnautica' },
  { id: 'cozy', tag: 1654, feature: 413150, featureName: 'Stardew Valley' },
  { id: 'puzzle', tag: 1664, feature: 620, featureName: 'Portal 2' },
  { id: 'souls', tag: 29482, feature: 814380, featureName: 'Sekiro' },
  { id: 'strategy', tag: 9, feature: 294100, featureName: 'RimWorld' },
  { id:'exploration', tag:3834, feature:753640, featureName:'Outer Wilds', titleKey:'games.rows.category.exploration' },
  { id:'metroidvania', tag:1628, feature:367520, featureName:'Hollow Knight', titleKey:'games.rows.category.metroidvania' },
  { id:'horror', tag:1667, feature:2050650, featureName:'Resident Evil 4', titleKey:'games.rows.category.horror' },
  { id:'turnBased', tag:1677, feature:268500, featureName:'XCOM 2', titleKey:'games.rows.category.turnBased' },
  { id:'action', tag:19, feature:782330, featureName:'DOOM Eternal', titleKey:'games.rows.category.action' },
  { id:'adventure', tag:21, feature:814380, featureName:'Sekiro', titleKey:'games.rows.category.adventure' },
  { id:'rpg', tag:122, feature:292030, featureName:'The Witcher 3', titleKey:'games.rows.category.rpg' },
  { id:'simulation', tag:599, feature:227300, featureName:'Euro Truck Simulator 2', titleKey:'games.rows.category.simulation' },
  { id:'coop', tag:1685, feature:548430, featureName:'Deep Rock Galactic', titleKey:'games.rows.category.coop' },
  { id:'fps', tag:1663, feature:1237970, featureName:'Titanfall 2', titleKey:'games.rows.category.fps' },
  { id:'racing', tag:699, feature:1551360, featureName:'Forza Horizon 5', titleKey:'games.rows.category.racing' },
  { id:'sports', tag:701, feature:2195250, featureName:'EA SPORTS FC 24', titleKey:'games.rows.category.sports' },
  { id:'fighting', tag:1743, feature:1778820, featureName:'TEKKEN 8', titleKey:'games.rows.category.fighting' },
  { id:'stealth', tag:1687, feature:1659040, featureName:'HITMAN World of Assassination', titleKey:'games.rows.category.stealth' },
  { id:'platformer', tag:1625, feature:504230, featureName:'Celeste', titleKey:'games.rows.category.platformer' },
] as const;
export const FEATURED_GAMES = [1145350, 1245620, 1091500];
