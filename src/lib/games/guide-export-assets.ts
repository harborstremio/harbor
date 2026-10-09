import { safeFetchBytes } from "@/lib/safe-fetch";
import { guideImage } from "./guides-data";

export type PdfImage = { data:string; width:number; height:number };
export async function loadGuidePdfImage(url:string,signal:AbortSignal):Promise<PdfImage> {
  if(!guideImage(url))throw Error("Unsupported guide image");
  const response=await safeFetchBytes(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(15_000)]),credentials:"omit"},15_000,12*1024*1024);
  if(!response.ok)throw Error("Guide image unavailable");
  const blob=await response.blob();signal.throwIfAborted();
  const bitmap=await createImageBitmap(blob);
  try {
    signal.throwIfAborted();
    const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext("2d");if(!context)throw Error("Image renderer unavailable");
    context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return {data:canvas.toDataURL("image/jpeg",.92),width:bitmap.width,height:bitmap.height};
  } finally {bitmap.close();}
}

const NOTO="https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf";
const FONTS={
  Mono:`${NOTO}/NotoSansMono/NotoSansMono-Regular.ttf`,
  CJK:"https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf",
  Symbols:`${NOTO}/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf`,
  Arabic:`${NOTO}/NotoNaskhArabic/NotoNaskhArabic-Regular.ttf`,
  Devanagari:`${NOTO}/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf`,
};
export type PdfFont=keyof typeof FONTS;
export function guideCharacterFont(text:string):PdfFont|undefined {
  if(/[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff]/u.test(text))return "CJK";
  if(/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(text))return "Arabic";
  if(/[\u0900-\u097f]/u.test(text))return "Devanagari";
  if(/[\u2600-\u27bf]/u.test(text))return "Symbols";
}
const fonts=new Map<PdfFont,string>();
/** Noto fonts are SIL OFL. Fetch only scripts present in this export; never send guide text. */
export async function guidePdfFont(name:PdfFont,signal:AbortSignal):Promise<string> {
  const cached=fonts.get(name);if(cached)return cached;
  const response=await safeFetchBytes(FONTS[name],{signal:AbortSignal.any([signal,AbortSignal.timeout(30_000)]),credentials:"omit"},30_000,24*1024*1024);
  if(!response.ok)throw Error("PDF font unavailable");
  const bytes=new Uint8Array(await response.arrayBuffer());signal.throwIfAborted();
  let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const data=btoa(binary);fonts.set(name,data);return data;
}
