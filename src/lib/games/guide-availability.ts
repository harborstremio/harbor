import type { SteamGuidePage, GuideVideoPage } from "./guides-data";
import { GuideSourceNotFound } from "./guide-source-status";

export type GuideAvailability = "available" | "empty" | "unknown";
/** Only broad, unfiltered successful reads can establish absence. Failures stay unknown. */
export async function checkGuideAvailability(sources:{
  written?:()=>Promise<SteamGuidePage>;
  videos?:()=>Promise<GuideVideoPage>;
  technical?:()=>Promise<unknown>;
},signal:AbortSignal):Promise<GuideAvailability> {
  let uncertain=false;
  if(sources.written){
    try{
      const page=await sources.written();signal.throwIfAborted();
      if(page.items.length || (page.total??0)>0)return "available";
      if(page.more || (page.total!==0&&!page.empty))uncertain=true;
    }catch{signal.throwIfAborted();uncertain=true;}
  }
  if(sources.videos)try{
    const page=await sources.videos();signal.throwIfAborted();
    if(page.items.length)return "available";
    if(page.cursor||page.incomplete)uncertain=true;
  }catch{signal.throwIfAborted();uncertain=true;}
  if(sources.technical)try{await sources.technical();signal.throwIfAborted();return "available";}
  catch(error){signal.throwIfAborted();if(!(error instanceof GuideSourceNotFound))uncertain=true;}
  return uncertain?"unknown":"empty";
}
