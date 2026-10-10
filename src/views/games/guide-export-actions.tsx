import { useEffect, useRef, useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { saveTextFileWithPath } from "@/lib/download-text";
import { guideAsText, guideFilename, type GuideExport } from "@/lib/games/guide-export-data";

export function GuideExportActions({value,active}:{value:GuideExport;active:boolean}) {
  const t=useT(),request=useRef<AbortController|null>(null);
  const [busy,setBusy]=useState<"txt"|"pdf"|null>(null),[error,setError]=useState(false);
  useEffect(()=>{setBusy(null);setError(false);return()=>request.current?.abort();},[active,value.item.id]);
  async function save(format:"txt"|"pdf") {
    if(request.current&&!request.current.signal.aborted||!active)return;
    const controller=new AbortController();request.current=controller;setBusy(format);setError(false);
    try {
      if(format==="txt")await saveTextFileWithPath(guideFilename(value.article.title,"txt"),guideAsText(value),["txt"],"Harbor",{nativeFailure:"throw"});
      else {
        const { createGuidePdf, saveGuidePdf }=await import("@/lib/games/guide-export-pdf");
        const bytes=await createGuidePdf(value,controller.signal);
        controller.signal.throwIfAborted();
        await saveGuidePdf(bytes,guideFilename(value.article.title,"pdf"));
      }
    } catch {if(!controller.signal.aborted)setError(true);}
    finally {if(!controller.signal.aborted)setBusy(null);controller.abort();if(request.current===controller)request.current=null;}
  }
  return <div className="games-guide-export">
    <div className="games-guide-export-buttons" aria-busy={!!busy}>
      <button type="button" disabled={!!busy} onClick={()=>void save("txt")}><FileText size={15}/>{t("games.guides.saveTxt")}</button>
      <button type="button" disabled={!!busy} aria-label={t(busy==="pdf"?"games.guides.preparingPdf":"games.guides.savePdf")} onClick={()=>void save("pdf")}>{busy==="pdf"?<LoaderCircle size={15} className="games-guide-export-spinner"/>:<Download size={15}/>}<span role="status">{t(busy==="pdf"?"games.guides.preparingPdf":"games.guides.savePdf")}</span></button>
      {busy==="pdf"&&<button type="button" onClick={()=>{request.current?.abort();setBusy(null);}}>{t("common.cancel")}</button>}
    </div>
    {error&&<p role="alert">{t("games.guides.exportError")}</p>}
  </div>;
}
