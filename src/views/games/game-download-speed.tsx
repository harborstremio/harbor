import {useEffect,useId,useState} from "react";
import {Gauge,X} from "lucide-react";
import {HoverTooltip} from "@/components/hover-tooltip";
import {ModalShell,useModalExit} from "@/components/modal-shell";
import {useT,useUiLanguage} from "@/lib/i18n";
import {useSectionBack} from "@/lib/section-back";
import {useGameTransferSettings} from "@/hooks/use-game-transfer-settings";
import {useAccountDialogFocus} from "./game-steam-account";
import "./game-download-speed.css";

export function GameDownloadSpeed({profile,active,available}:{profile:string;active:boolean;available:boolean}){
  const t=useT(),language=useUiLanguage(),[open,setOpen]=useState(false),settings=useGameTransferSettings(profile,active,available);
  useEffect(()=>{if(!active)setOpen(false);},[active]);
  if(!available)return null;
  const rate=settings.value?.bytesPerSecondLimit;
  const label=rate===undefined?t("games.download.speed.title"):t("games.download.speed.current",{rate:rate?`${(rate/1024).toLocaleString(language)} KB/s`:t("games.download.speed.unlimited")});
  return <><HoverTooltip label={label}><button className="games-icon-button" aria-label={t("games.download.speed.title")} onClick={()=>setOpen(true)}><Gauge size={18}/>{!!rate&&<i className="games-speed-active"/>}</button></HoverTooltip>{open&&<SpeedDialog settings={settings} onClose={()=>setOpen(false)}/>}</>;
}
function SpeedDialog({settings,onClose}:{settings:ReturnType<typeof useGameTransferSettings>;onClose:()=>void}){
  const t=useT(),language=useUiLanguage(),id=useId(),root=useAccountDialogFocus(),{closing,close}=useModalExit(onClose);
  const [mode,setMode]=useState(settings.value?.bytesPerSecondLimit?"limited":"unlimited"),[rate,setRate]=useState(String((settings.value?.bytesPerSecondLimit||1024*1024)/1024)),[dirty,setDirty]=useState(false);
  useEffect(()=>{if(settings.value&&!dirty){setMode(settings.value.bytesPerSecondLimit?"limited":"unlimited");setRate(String((settings.value.bytesPerSecondLimit||1024*1024)/1024));}},[settings.value,dirty]);
  const valid=/^\d+$/.test(rate)&&Number(rate)>=16&&Number(rate)<=1048576;
  const busy=settings.saving,dismiss=()=>{if(!busy)close();};
  useSectionBack(dismiss,true);
  return <ModalShell closing={closing} onDismiss={dismiss} width={440} labelledBy={id} backdropClassName="games-match-backdrop"><div ref={root} tabIndex={-1} className="games-speed-dialog">
    <header><h2 id={id}>{t("games.download.speed.title")}</h2><button className="games-icon-button" disabled={busy} aria-label={t("common.close")} onClick={dismiss}><X size={19}/></button></header>
    <p>{t("games.download.speed.note")}</p>
    {settings.loading&&!settings.value?<p role="status">{t("common.loading")}</p>:settings.value&&<form onSubmit={event=>{event.preventDefault();if(mode==="limited"&&!valid)return;void settings.save(mode==="unlimited"?0:Number(rate)*1024).then(saved=>{if(saved)close();});}}>
      <div className="games-speed-modes" role="group" aria-label={t("games.download.speed.title")}>{(["unlimited","limited"] as const).map(value=><button type="button" key={value} disabled={busy} aria-pressed={mode===value} onClick={()=>{setDirty(true);setMode(value);}}>{t(`games.download.speed.${value}`)}</button>)}</div>
      {mode==="limited"&&<label className="games-speed-rate">{t("games.download.speed.rate")}<input type="number" inputMode="numeric" min={16} max={1048576} step={1} required disabled={busy} value={rate} onChange={event=>{setDirty(true);setRate(event.target.value);}} aria-invalid={!valid} aria-describedby={!valid?`${id}-range`:undefined}/>{!valid&&<span id={`${id}-range`}>{t("games.download.speed.range",{min:(16).toLocaleString(language),max:(1048576).toLocaleString(language)})}</span>}</label>}
      {settings.error&&<p role="alert">{t("games.download.speed.error")}</p>}
      <footer><button type="button" className="games-button" disabled={busy} onClick={dismiss}>{t("common.cancel")}</button><button type="submit" className="games-button games-button-primary" disabled={busy||(mode==="limited"&&!valid)}>{t(busy?"common.loading":"common.save")}</button></footer>
    </form>}
    {settings.error&&!settings.value&&<div className="games-speed-failed" role="alert"><p>{t("games.download.speed.error")}</p><button className="games-button" disabled={settings.loading} onClick={()=>void settings.refresh()}>{t("common.retry")}</button></div>}
  </div></ModalShell>;
}
