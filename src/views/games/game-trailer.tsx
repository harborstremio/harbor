import { Play } from "@/components/icons/play-filled";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Maximize, Minimize, Pause, RotateCcw, Volume1, Volume2, VolumeX } from "lucide-react";
import { useT } from "@/lib/i18n";
import "./game-detail-media.css";

const VOLUME_KEY = "harbor.games.trailer-volume.v1";
const clamp = (value:number) => Math.max(0,Math.min(1,value));
function initialVolume() { try { const value=localStorage.getItem(VOLUME_KEY),number=Number(value);return value!==null&&Number.isFinite(number)?clamp(number):.35; } catch { return .35; } }
function timeLabel(value:number) { const seconds=Math.floor(Number.isFinite(value)?Math.max(0,value):0);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`; }
function Control({label,children,onClick,pressed,className=""}:{label:string;children:ReactNode;onClick:()=>void;pressed?:boolean;className?:string}) {
  return <span className={`games-player-tip ${className}`}><button type="button" aria-label={label} aria-pressed={pressed} onClick={onClick}>{children}</button><span className="games-player-tooltip" aria-hidden="true">{label}</span></span>;
}
export function GameTrailer({url,poster,active,onError,intentional=false,suspended=false,live=false,onPlaybackChange}:{url:string;poster:string;active:boolean;suspended?:boolean;onError?:()=>void;intentional?:boolean;live?:boolean;onPlaybackChange?:(playing:boolean)=>void}) {
  const t=useT(),root=useRef<HTMLDivElement>(null),video=useRef<HTMLVideoElement>(null),volumeArea=useRef<HTMLDivElement>(null);
  const errorHandler=useRef(onError);errorHandler.current=onError;
  const playbackHandler=useRef(onPlaybackChange);playbackHandler.current=onPlaybackChange;
  const [visible,setVisible]=useState(false),[pastTop,setPastTop]=useState(false),[manualPlay,setManualPlay]=useState(intentional),[seen,setSeen]=useState(false),[ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[buffering,setBuffering]=useState(false),[fault,setFault]=useState(false),[attempt,setAttempt]=useState(0);
  const [wantsPlay,setWantsPlay]=useState(()=>intentional||!matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [muted,setMuted]=useState(true),[volume,setVolume]=useState(initialVolume),[volumeOpen,setVolumeOpen]=useState(false),[time,setTime]=useState(0),[duration,setDuration]=useState(0),[buffered,setBuffered]=useState(0),[ended,setEnded]=useState(false),[fullscreen,setFullscreen]=useState(false),[chrome,setChrome]=useState(true);
  useEffect(()=>{playbackHandler.current?.(playing);},[playing]);
  const eligible=active&&!suspended&&visible&&(pastTop||manualPlay||fullscreen)&&wantsPlay&&!fault,eligibleRef=useRef(eligible);eligibleRef.current=eligible;
  const streaming=useRef<{startLoad:(position?:number)=>void;stopLoad:()=>void}|null>(null),hideTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const volumeRef=useRef(volume);volumeRef.current=volume;
  const reveal=()=>{setChrome(true);clearTimeout(hideTimer.current);hideTimer.current=setTimeout(()=>setChrome(false),2400);};
  useEffect(()=>()=>clearTimeout(hideTimer.current),[]);
  useEffect(()=>{const preference=matchMedia("(prefers-reduced-motion: reduce)");const change=()=>{if(preference.matches&&!intentional)setWantsPlay(false);};preference.addEventListener("change",change);return()=>preference.removeEventListener("change",change);},[intentional]);
  useEffect(()=>{
    const node=root.current;if(!node)return;
    const scroller=node.closest<HTMLElement>(".games-view");
    let inView=false,wasPastTop=false;
    const update=()=>{
      const away=(scroller?.scrollTop??document.scrollingElement?.scrollTop??0)>0;
      if(wasPastTop&&!away)setManualPlay(false);
      wasPastTop=away;setPastTop(away);
      const show=inView&&!document.hidden;setVisible(show);if(show)setSeen(true);
    };
    // The hero is still on arrival. The first scroll starts a visible trailer,
    // without waiting for a percentage of the player or an artificial delay.
    const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;update();},{threshold:0});
    observer.observe(node);update();
    const scrollTarget=scroller??document;
    scrollTarget.addEventListener("scroll",update,{passive:true});
    document.addEventListener("visibilitychange",update);
    return()=>{observer.disconnect();scrollTarget.removeEventListener("scroll",update);document.removeEventListener("visibilitychange",update);};
  },[]);
  useEffect(()=>{
    const el=video.current;if(!el||!active||!seen)return;
    let cancelled=false,release:(()=>void)|undefined;
    setReady(false);setFault(false);setBuffering(eligibleRef.current);setTime(0);setDuration(0);setBuffered(0);setEnded(false);
    const fail=()=>{if(!cancelled){setFault(true);setBuffering(false);errorHandler.current?.();}};
    if(url.includes(".m3u8")) {
      void import("hls.js").then(({default:Hls})=>{
        if(cancelled)return;if(!Hls.isSupported()){if(el.canPlayType("application/vnd.apple.mpegurl")){el.src=url;el.load();}else fail();return;}
        const player=new Hls({maxBufferLength:20,maxMaxBufferLength:30});streaming.current=player;release=()=>{streaming.current=null;player.destroy();};
        player.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)fail();});
        player.on(Hls.Events.MANIFEST_PARSED,()=>{if(!cancelled){setReady(true);setBuffering(eligibleRef.current);}});
        player.loadSource(url);player.attachMedia(el);
      }).catch(fail);
    } else {el.src=url;el.load();}
    return()=>{cancelled=true;el.pause();release?.();el.removeAttribute("src");el.load();};
  },[url,active,seen,attempt]);
  useEffect(()=>{
    const el=video.current;if(!el||!ready)return;
    if(eligible){streaming.current?.startLoad(-1);void el.play().then(()=>{if(!eligibleRef.current)el.pause();},()=>{if(eligibleRef.current){setWantsPlay(false);setBuffering(false);setChrome(true);}});}
    else {el.pause();streaming.current?.stopLoad();}
  },[eligible,ready]);
  useEffect(()=>{const el=video.current;if(el){el.muted=muted;el.volume=volume;}},[muted,volume,ready]);
  useEffect(()=>{const change=()=>setFullscreen(document.fullscreenElement===root.current);document.addEventListener("fullscreenchange",change);return()=>document.removeEventListener("fullscreenchange",change);},[]);
  const claimSound=()=>{
    for(const other of document.querySelectorAll<HTMLMediaElement>('.games-view audio,.games-view video'))if(other!==video.current&&!other.paused)other.pause();
    void import("@/lib/music/player").then(({getMusicState,toggleMusicPlayback})=>{if(getMusicState().phase==="playing")toggleMusicPlayback();}).catch(()=>{});
  };
  const changeVolume=(value:number)=>{const next=clamp(value);setVolume(next);volumeRef.current=next;setMuted(next===0);if(next>0)claimSound();try{localStorage.setItem(VOLUME_KEY,String(next));}catch{/* Session volume still works if storage is unavailable. */}};
  const changeVolumeRef=useRef(changeVolume);changeVolumeRef.current=changeVolume;
  useEffect(()=>{const node=volumeArea.current;if(!node)return;const wheel=(event:WheelEvent)=>{if(event.ctrlKey||!event.deltaY)return;event.preventDefault();event.stopPropagation();setVolumeOpen(true);reveal();changeVolumeRef.current(volumeRef.current+(event.deltaY<0?.05:-.05));};node.addEventListener("wheel",wheel,{passive:false});return()=>node.removeEventListener("wheel",wheel);},[]);
  const toggleSound=()=>{if(muted||volume===0){if(volume===0)setVolume(.35);claimSound();setMuted(false);}else setMuted(true);reveal();};
  const togglePlayback=()=>{const el=video.current;if(!el||fault)return;const next=el.paused;if(next&&el.ended){el.currentTime=0;setEnded(false);}setManualPlay(next);setWantsPlay(next);if(!next)el.pause();reveal();};
  const seek=(value:number)=>{const el=video.current;if(!el||!Number.isFinite(duration)||duration<=0)return;el.currentTime=Math.max(0,Math.min(duration,value));setTime(el.currentTime);setEnded(false);reveal();};
  const toggleFullscreen=()=>{if(document.fullscreenElement===root.current)void document.exitFullscreen().catch(()=>{});else void root.current?.requestFullscreen().catch(()=>{});reveal();};
  const updateProgress=()=>{const el=video.current;if(!el)return;setTime(el.currentTime);const total=Number.isFinite(el.duration)?el.duration:0;setDuration(total);if(el.buffered.length&&total)setBuffered(el.buffered.end(el.buffered.length-1)/total*100);};
  const shown=chrome||!playing||volumeOpen||buffering||fault;
  return <div ref={root} className={`games-media-player${shown?" is-chrome-visible":""}${playing?" is-playing":""}${fault?" has-error":""}`} onPointerMove={reveal} onPointerLeave={()=>{setVolumeOpen(false);if(playing)setChrome(false);}} onFocusCapture={reveal} onKeyDown={event=>{
    if((event.target as HTMLElement).matches("input,button"))return;
    if(event.key===" "||event.key.toLowerCase()==="k"){event.preventDefault();event.stopPropagation();togglePlayback();}
  }}>
    <video ref={video} playsInline muted={muted} preload="metadata" poster={poster} aria-label={t(live?"games.details.broadcast":"games.trailer")} onClick={togglePlayback}
      onLoadedMetadata={()=>{setReady(true);updateProgress();}} onDurationChange={updateProgress} onTimeUpdate={updateProgress} onProgress={updateProgress}
      onPlaying={()=>{setPlaying(true);setBuffering(false);setEnded(false);reveal();}} onPause={()=>setPlaying(false)} onWaiting={()=>setBuffering(true)} onCanPlay={()=>setBuffering(false)}
      onEnded={()=>{setPlaying(false);setWantsPlay(false);setEnded(true);setChrome(true);}} onError={()=>{if(video.current?.currentSrc){setFault(true);setBuffering(false);errorHandler.current?.();}}} />
    {muted&&playing&&!fault&&<button type="button" className="games-player-sound" aria-label={t("games.player.unmute")} onClick={toggleSound}><VolumeX size={17}/><span>{t("games.player.unmute")}</span></button>}
    {!playing&&!buffering&&!fault&&<button type="button" className="games-player-center" aria-label={t(live?"games.details.broadcastResume":ended?"games.player.replay":"games.player.play")} onClick={togglePlayback}>{ended?<RotateCcw size={27}/>:<Play size={29}/>}</button>}
    {buffering&&eligible&&seen&&<div className="games-player-buffering" role="status" aria-label={t("games.player.buffering")}><i/><i/><i/></div>}
    {fault&&<div className="games-player-error" role="alert"><p>{t("games.player.error")}</p><button type="button" className="games-button" onClick={()=>{setAttempt(value=>value+1);setManualPlay(true);setWantsPlay(true);}}><RotateCcw size={16}/>{t("games.player.retry")}</button></div>}
    <div className="games-player-controls" aria-label={t(live?"games.details.broadcast":"games.trailer")}>
      {!live&&<div className="games-player-seek" style={{"--played":`${duration?time/duration*100:0}%`,"--buffered":`${buffered}%`} as CSSProperties}><span/><input aria-label={t("games.player.seek")} aria-valuetext={`${timeLabel(time)} / ${timeLabel(duration)}`} type="range" min="0" max={duration||1} step=".1" disabled={!duration||fault} value={Math.min(time,duration||1)} onChange={event=>seek(Number(event.target.value))} onKeyDown={event=>event.stopPropagation()}/></div>}
      <div className="games-player-control-row"><Control label={t(live?(playing?"games.details.broadcastPause":"games.details.broadcastResume"):(playing?"games.player.pause":ended?"games.player.replay":"games.player.play"))} onClick={togglePlayback}>{playing?<Pause size={19} fill="currentColor"/>:ended?<RotateCcw size={19}/>:<Play size={19}/>}</Control>{live?<span className="games-player-time">{t("games.details.broadcast")}</span>:<span className="games-player-time" dir="ltr">{timeLabel(time)}<span> / {timeLabel(duration)}</span></span>}
        <div ref={volumeArea} className={`games-player-volume${volumeOpen?" is-open":""}`} onPointerEnter={()=>setVolumeOpen(true)} onPointerLeave={()=>setVolumeOpen(false)} onFocusCapture={()=>setVolumeOpen(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setVolumeOpen(false);}}>
          <button type="button" className="games-player-volume-button" aria-label={t(muted||!volume?"games.player.unmute":"games.player.mute")} aria-expanded={volumeOpen} onClick={toggleSound}>{muted||!volume?<VolumeX size={20}/>:volume<.5?<Volume1 size={20}/>:<Volume2 size={20}/>}</button>
          <div className="games-player-volume-popover"><div><input type="range" min="0" max="1" step=".01" aria-label={t("games.player.volume")} aria-valuetext={`${Math.round((muted?0:volume)*100)}%`} value={muted?0:volume} onChange={event=>changeVolume(Number(event.target.value))} onKeyDown={event=>event.stopPropagation()} style={{"--volume":`${(muted?0:volume)*100}%`} as CSSProperties}/><span>{Math.round((muted?0:volume)*100)}%</span></div><small>{t("games.player.wheel")}</small></div>
        </div>
        <Control label={t(fullscreen?"games.player.exitFullscreen":"games.player.fullscreen")} onClick={toggleFullscreen}>{fullscreen?<Minimize size={18}/>:<Maximize size={18}/>}</Control>
      </div>
    </div>
  </div>;
}

