export type GameSeason = "halloween" | "holiday" | "summer" | "spring";
/** Local calendar; October's collection begins in late September for planning ahead. */
export function gameSeason(date=new Date()): GameSeason {
  const month=date.getMonth()+1,day=date.getDate();
  if((month===9&&day>=15)||month===10||(month===11&&day<=3))return "halloween";
  if((month===11&&day>=15)||month===12||(month===1&&day<=6))return "holiday";
  if(month>=6&&month<=8)return "summer";
  return "spring";
}
export function seasonCatalog(season:GameSeason) { return season==="halloween"?{query:"",tags:[1667]}:season==="holiday"?{query:"Christmas",tags:[]}:season==="summer"?{query:"",tags:[21]}:{query:"",tags:[1654]}; }
