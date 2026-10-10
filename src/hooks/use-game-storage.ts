import {useEffect,useRef,useState} from "react";
import {invoke} from "@tauri-apps/api/core";

export type GameStorageForecast={volume:string;availableBytes:number|null;remainingBytes:number;unknownFiles:number;estimatedFiles?:number;fileCount:number;otherReservedBytes:number;shortfallBytes:number|null};
export function useGameStorage(profile:string,active:boolean,available:boolean,revision:string){
  const [state,setState]=useState<{profile:string;drives:GameStorageForecast[];error:boolean}|null>(null);
  const refresh=useRef<()=>void>(()=>{});
  useEffect(()=>{
    if(!active||!available)return;
    let current=true,pending=false,again=false,last=0;
    let deferred:ReturnType<typeof setTimeout>|undefined;
    const read=async()=>{
      if(!current||document.visibilityState==="hidden")return;
      if(pending){again=true;return;}
      pending=true;last=Date.now();
      try{
        const drives=await invoke<GameStorageForecast[]>("games_transfer_storage",{profile});
        if(current)setState({profile,drives,error:false});
      }catch{if(current)setState(previous=>({profile,drives:previous?.profile===profile?previous.drives:[],error:true}));}
      finally{pending=false;if(current&&again){again=false;schedule();}}
    };
    const schedule=()=>{clearTimeout(deferred);deferred=setTimeout(()=>void read(),Math.max(500,1000-(Date.now()-last)));};
    const wake=()=>{if(Date.now()-last>=2000)void read();};
    refresh.current=schedule;
    void read();
    const timer=setInterval(()=>void read(),15000);
    window.addEventListener("focus",wake);document.addEventListener("visibilitychange",wake);
    return()=>{current=false;clearInterval(timer);clearTimeout(deferred);refresh.current=()=>{};window.removeEventListener("focus",wake);document.removeEventListener("visibilitychange",wake);};
  },[profile,active,available]);
  useEffect(()=>{refresh.current();},[revision]);
  return {drives:state?.profile===profile?state.drives:[],error:state?.profile===profile&&state.error,refresh:()=>refresh.current()};
}
