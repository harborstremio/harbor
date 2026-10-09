import type { LauncherGame, LauncherScan } from "./launchers";

export type LauncherSession = { profile:string; id:string; sessionId:string; state:string; requestedAt:number; startedAt:number; updatedAt:number; elapsedMs:number };
export type LauncherSessions = { sessions:LauncherSession[]; activity:{id:string;seconds:number;lastPlayed:number}[]; error:boolean };
export const emptyLauncherSessions = ():LauncherSessions => ({sessions:[],activity:[],error:false});
export const launcherSessionBusy = (game:LauncherGame) => ["waiting","running","unconfirmed"].includes(game.activity?.state ?? "");
export function launcherSessionLabel(game:LauncherGame):string | undefined {
  switch(game.activity?.state) {
    case "waiting": return "games.launcherSession.waiting";
    case "running": return "games.custom.running";
    case "unconfirmed": return "games.launcherSession.unconfirmed";
    case "notStarted": return "games.launcherSession.notStarted";
  }
}
export function withLauncherActivity(scan:LauncherScan|null,snapshot:LauncherSessions,profile:string):LauncherScan|null {
  if(!scan)return null;
  const activity=new Map(snapshot.activity.map(value=>[value.id,value]));
  const latest=new Map<string,LauncherSession>();
  for(const session of snapshot.sessions)if(session.profile===profile&&(!latest.has(session.id)||latest.get(session.id)!.requestedAt<session.requestedAt))latest.set(session.id,session);
  return {...scan,games:scan.games.map(game=>{
    const total=activity.get(game.id),session=latest.get(game.id);
    const state=session&&["waiting","running","unconfirmed","notStarted"].includes(session.state)?session.state as NonNullable<LauncherGame["activity"]>["state"]:undefined;
    return {...game,activity:total||state?{...(total&&Number.isSafeInteger(total.seconds)&&total.seconds>=0?{seconds:total.seconds,lastPlayed:total.lastPlayed}:{}),state}:undefined};
  })};
}
