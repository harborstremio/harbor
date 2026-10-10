import {useEffect,useRef,useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {listen} from "@tauri-apps/api/event";

type TransferSettings={profile:string;bytesPerSecondLimit:number};
/** Mounted per profile by the control; old requests cannot update a new profile. */
export function useGameTransferSettings(profile:string,active:boolean,available:boolean){
  const [value,setValue]=useState<TransferSettings|null>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(false);
  const alive=useRef(true),revision=useRef(0),pending=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;revision.current++;};},[]);
  const refresh=async()=>{
    if(!available)return;const current=++revision.current;setLoading(true);setError(false);
    try{const next=await invoke<TransferSettings>("games_transfer_settings",{profile});if(alive.current&&current===revision.current&&next.profile===profile)setValue(next);}
    catch{if(alive.current&&current===revision.current)setError(true);}
    finally{if(alive.current&&current===revision.current)setLoading(false);}
  };
  useEffect(()=>{
    if(!available)return;let current=true;
    const stop=listen<TransferSettings>("games:transfer-settings",event=>{
      if(!current||event.payload.profile!==profile)return;
      revision.current++;setValue(event.payload);setLoading(false);setError(false);
    }).catch(()=>()=>{});
    return()=>{current=false;void stop.then(unlisten=>unlisten());};
  },[available,profile]);
  useEffect(()=>{if(active)void refresh();},[active,available,profile]);
  const save=async(bytesPerSecondLimit:number)=>{
    if(!available||pending.current)return false;
    pending.current=true;revision.current++;setLoading(false);setSaving(true);setError(false);
    try{
      const next=await invoke<TransferSettings>("games_set_transfer_bandwidth",{profile,bytesPerSecondLimit});
      if(!alive.current||next.profile!==profile)return false;
      setValue(next);return true;
    }catch{if(alive.current)setError(true);return false;}
    finally{pending.current=false;if(alive.current)setSaving(false);}
  };
  return{value,loading,saving,error,refresh,save};
}
