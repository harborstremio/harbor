import type { EsportsGameId } from "../sports/esports-catalog";
import type { EsportsStream } from "../sports/esports-streams";

export type MajorTournament = {
  id:string; game:EsportsGameId; name:string; organizer:string;
  start:string; end:string; location?:string; image:string; logo?:boolean; source:string;
  streams:EsportsStream[];
};
export const TOURNAMENTS_CHECKED = "2026-10-04";
const twitch=(title:string,channel:string):EsportsStream=>({title,url:`https://www.twitch.tv/${channel}`,platform:"twitch"});
const youtube=(title:string,channel:string):EsportsStream=>({title,url:`https://www.youtube.com/${channel}`,platform:"youtube"});

// An explicitly dated organizer calendar. Never infer tournament dates or "live"
// broadcast state from a match feed, and never roll last year's event forward.
export const MAJOR_TOURNAMENTS:readonly MajorTournament[] = [
  {id:"worlds-2026",game:"lol",name:"Worlds 2026",organizer:"Riot Games",start:"2026-10-15",end:"2026-11-14",location:"Los Angeles · Allen · Brooklyn",image:"/games/tournaments/worlds.jpg",source:"https://lolesports.com/news/msi-and-worlds-updates",streams:[twitch("Riot Games","riotgames"),youtube("LoL Esports","channel/UCSF_aFGIIIoWY30GVV19TKA")]},
  {id:"game-changers-2026",game:"valorant",name:"Game Changers Championship",organizer:"Riot Games",start:"2026-10-22",end:"2026-11-01",location:"São Paulo",image:"/games/tournaments/game-changers.jpg",source:"https://valorantesports.com/news/game-changers-championship-2026-live-audience-and-ticket-sale-information",streams:[twitch("VALORANT","valorant"),youtube("VALORANT Champions Tour","channel/UCA1d3HFGFUmkKr2JIUA5Vlw")]},
  {id:"fncs-solos-na-2026",game:"fortnite",name:"FNCS Solos Finals · NA",organizer:"Epic Games",start:"2026-10-26",end:"2026-10-27",image:"/games/tournaments/fncs.jpg",source:"https://www.fortnite.com/competitive/events/S42_FNCSSolo_Final/schedule?region=NAC",streams:[]},
  {id:"algs-split2-2026",game:"apex",name:"ALGS Split 2 Playoffs",organizer:"EA · Respawn",start:"2026-10-29",end:"2026-11-01",location:"Las Vegas · Orleans Arena",image:"/games/tournaments/algs.svg",logo:true,source:"https://algs.ea.com/en/news/year-6-is-here",streams:[twitch("Apex Legends Global Series","playapex"),youtube("Apex Legends","playapex")]},
  {id:"iem-beijing-2026",game:"cs2",name:"IEM Beijing",organizer:"ESL",start:"2026-11-02",end:"2026-11-08",location:"Beijing",image:"/games/tournaments/iem.webp",source:"https://pro.eslgaming.com/tour/cs/beijing/",streams:[twitch("ESL Counter-Strike","eslcs")]},
  {id:"osaka-major-2026",game:"r6",name:"BLAST R6 Osaka Major",organizer:"BLAST · Ubisoft",start:"2026-11-06",end:"2026-11-15",location:"Osaka",image:"/games/tournaments/osaka.jpg",source:"https://www.ubisoft.com/en-us/esports/rainbow-six/siege/competition/513",streams:[twitch("Rainbow Six Esports","rainbow6"),youtube("Rainbow Six Esports","channel/UCWKHac5bjhsUtSnMDFCT-7A")]},
  {id:"blast-rivals-2026",game:"cs2",name:"BLAST Premier Rivals",organizer:"BLAST",start:"2026-11-11",end:"2026-11-15",location:"Hong Kong",image:"/games/tournaments/rivals.webp",source:"https://blast.tv/cs/tournaments/rivals-2026-season-2",streams:[twitch("BLAST Premier","blastpremier")]},
  {id:"pgl-singapore-2026",game:"cs2",name:"PGL Singapore Major",organizer:"PGL",start:"2026-11-25",end:"2026-12-13",location:"Singapore",image:"/games/tournaments/pgl.webp",source:"https://www.pglesports.com/cs2/pgl-major-singapore-2026/",streams:[youtube("PGL","@pgl")]},
  {id:"pgc-2026",game:"pubg",name:"PUBG Global Championship",organizer:"KRAFTON",start:"2026-12-01",end:"2026-12-13",location:"Istanbul",image:"/games/tournaments/pgc.png",source:"https://www.pubg.com/en/news/10110",streams:[youtube("PUBG Esports","c/PUBGEsports")]},
  {id:"owcs-finals-2026",game:"overwatch",name:"OWCS World Finals",organizer:"Blizzard · ESL FACEIT Group",start:"2026-12-02",end:"2026-12-06",image:"/games/tournaments/owcs.jpg",source:"https://esports.overwatch.com/news/owcs-2026-season-competitive-details",streams:[twitch("Overwatch Esports","ow_esports"),youtube("Overwatch Esports","c/ow_esports")]},
  {id:"dreamleague-30",game:"dota2",name:"DreamLeague Season 30",organizer:"ESL",start:"2026-12-02",end:"2026-12-13",image:"/games/tournaments/dreamleague.png",source:"https://pro.eslgaming.com/tour/2026/09/introducing-dotas-ept-season-26-27/",streams:[twitch("ESL Dota 2","esl_dota2"),youtube("ESL Dota 2","@esldota2")]},
  {id:"rlcs-club-2026",game:"rocketleague",name:"RLCS Club Championship",organizer:"BLAST · Psyonix",start:"2026-12-09",end:"2026-12-13",location:"London · Copper Box Arena",image:"/games/tournaments/rlcs.webp",source:"https://www.rocketleague.com/news/rlcs-returns-to-london-this-december-for-the-club-championship-with-dollar25m-up-for-grabs",streams:[twitch("Rocket League","rocketleague")]},
  {id:"stellar-fest-2",game:"starcraft2",name:"Stellar Fest 2 · Lunar Cup",organizer:"UrsaTV",start:"2026-12-18",end:"2026-12-20",location:"Ottawa · 50 Sussex",image:"/games/tournaments/stellar.jpg",source:"https://ursatv.ca/blogs/events",streams:[youtube("UrsaTV","@UrsaTVCanada")]},
];

export function upcomingMajorTournaments(now=Date.now(),game:EsportsGameId|"all"="all") {
  const day=new Date(now).toISOString().slice(0,10);
  return MAJOR_TOURNAMENTS.filter(event=>(game==="all"||event.game===game)&&event.end>=day).sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name));
}
export function tournamentDates(event:Pick<MajorTournament,"start"|"end">,language:string) {
  // These are organizer calendar dates, not midnight instants in the viewer's timezone.
  const formatter=new Intl.DateTimeFormat(language,{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
  return formatter.formatRange(new Date(event.start+"T12:00:00Z"),new Date(event.end+"T12:00:00Z"));
}
