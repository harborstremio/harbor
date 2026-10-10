import { PRODUCT_NAME } from "@/lib/i18n/brand";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import htmlToPdfmake from "html-to-pdfmake";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { type GuideExport } from "./guide-export-data";
import { guideImage } from "./guides-data";
import { guideCharacterFont, guidePdfFont, loadGuidePdfImage, type PdfFont, type PdfImage } from "./guide-export-assets";

pdfMake.addVirtualFileSystem(pdfFonts);
const WIDTH=499;
type PdfNode=Record<string,unknown>;

function hasContent(value:unknown):boolean {
  if(typeof value==="string")return !!value.trim();
  if(Array.isArray(value))return value.some(hasContent);
  if(!value||typeof value!=="object")return false;
  const node=value as PdfNode;
  return !!(node.image||node.table||node.canvas)||["text","stack","columns","ul","ol"].some(key=>hasContent(node[key]));
}
function markFirstContent(value:unknown,id:string):boolean {
  if(Array.isArray(value))return value.some(node=>markFirstContent(node,id));
  if(!value||typeof value!=="object")return false;
  const node=value as PdfNode;
  if(node.image||node.table||(typeof node.text==="string"&&node.text.trim())||(Array.isArray(node.text)&&node.text.some(part=>typeof part==="string"&&part.trim()))){node.id=id;return true;}
  return ["text","stack","columns","ul","ol"].some(key=>markFirstContent(node[key],id));
}

function fontRuns(text:string,base:string):Content[] {
  const runs:{text:string;font:string}[]=[];
  for(const char of text){const font=guideCharacterFont(char)||base,last=runs.at(-1);if(last?.font===font)last.text+=char;else runs.push({text:char,font});}
  return runs;
}
function applyFonts(value:unknown,inherited="Roboto"):void {
  if(!value||typeof value!=="object")return;
  if(Array.isArray(value)){value.forEach(node=>applyFonts(node,inherited));return;}
  const node=value as PdfNode,base=typeof node.font==="string"?node.font:inherited;
  // Text runs explicitly select fallback fonts; images, URLs and IDs must not be rewritten.
  if(typeof node.text==="string")node.text=fontRuns(node.text,base);
  else if(Array.isArray(node.text))node.text=node.text.flatMap(part=>typeof part==="string"?fontRuns(part,base):(applyFonts(part,base),[part]));
  for(const key of ["stack","columns","ul","ol","body"]){if(node[key])applyFonts(node[key],base);}
  if(node.table)applyFonts(node.table,base);
}

export async function createGuidePdf({game,item,article}:GuideExport,signal:AbortSignal):Promise<Uint8Array> {
  signal.throwIfAborted();
  const documents=article.sections.map(section=>new DOMParser().parseFromString(section.html,"text/html"));
  const cover=guideImage(article.image||item.image||"");
  const urls=[...new Set([...documents.flatMap(doc=>[...doc.querySelectorAll("img")].map(img=>img.src)),...(cover?[cover]:[])])];
  // Fail explicitly instead of silently dropping illustrations from the saved guide.
  if(urls.length>200)throw Error("This guide has too many images to export");
  const images=new Map<string,PdfImage>();let index=0,total=0;
  await Promise.all(Array.from({length:Math.min(3,urls.length)},async()=>{
    while(index<urls.length){const url=urls[index++];signal.throwIfAborted();const image=await loadGuidePdfImage(url,signal);total+=image.data.length;if(total>64*1024*1024)throw Error("Guide images exceed export limit");images.set(url,image);}
  }));
  const author=article.authors?.map(entry=>entry.name).join(", ")||item.author;
  const allText=[game,article.title,author,...documents.map(doc=>doc.body.textContent||""),...article.sections.map(section=>section.title)].join(" ");
  const needed=new Set<PdfFont>();for(const char of allText){const font=guideCharacterFont(char);if(font)needed.add(font);}
  if(documents.some(doc=>doc.querySelector("pre,code")))needed.add("Mono");
  await Promise.all([...needed].map(async name=>{
    const data=await guidePdfFont(name,signal),file=`Harbor-${name}.font`;
    pdfMake.addVirtualFileSystem({[file]:data});pdfMake.addFonts({[name]:{normal:file,bold:file,italics:file,bolditalics:file}});
  }));
  const source=item.source==="pcwiki"?"PCGamingWiki":"Steam Community";
  const content:Content[]=[
    {text:`HARBOR  /  ${game}`,fontSize:9,bold:true,color:"#666c71",characterSpacing:.6,margin:[0,0,0,16]},
    {text:article.title,fontSize:27,bold:true,lineHeight:1.12,margin:[0,0,0,12]},
    {text:author,fontSize:10,color:"#525960",margin:[0,0,0,5]},
    {text:source,link:item.url,color:"#375d75",fontSize:10,margin:[0,0,0,18]},
  ];
  if(cover){const image=images.get(cover)!;content.push({image:image.data,fit:[Math.min(WIDTH,image.width*.75),200],alignment:"left",margin:[0,0,0,20]});}
  for(let i=0;i<documents.length;i++){
    const doc=documents[i];
    doc.querySelectorAll("pre br").forEach(br=>br.replaceWith("\n"));
    // Export uses authored content, not the reader DOM (copy buttons and navigation are absent).
    doc.querySelectorAll("img").forEach(img=>{const image=images.get(img.src)!;img.dataset.pdfWidth=String(Math.min(WIDTH,image.width*.75));img.dataset.pdfHeight=String(Math.min(570,image.height*.75));img.src=image.data;img.removeAttribute("width");img.removeAttribute("height");});
    const options:NonNullable<Parameters<typeof htmlToPdfmake>[1]>&{customTag:(input:{element:HTMLElement;ret:PdfNode})=>PdfNode}={
      defaultStyles:{p:{margin:[0,0,0,9]},div:{margin:[0,0,0,4]},h1:{fontSize:19,margin:[0,14,0,7]},h2:{fontSize:17,margin:[0,14,0,7]},h3:{fontSize:15,margin:[0,12,0,6]},h4:{fontSize:13,margin:[0,10,0,6]},a:{color:"#375d75",decoration:"underline"},pre:{fontSize:9,lineHeight:1.2,margin:[0,8,0,12]},code:{fontSize:9},li:{margin:[0,1,0,3]}},
      customTag:({element,ret}:{element:HTMLElement;ret:PdfNode})=>{
        if(element.tagName==="IMG"){ret.fit=[Number(element.dataset.pdfWidth),Number(element.dataset.pdfHeight)];ret.margin=[0,5,0,10];delete ret.width;delete ret.height;}
        if(element.tagName==="PRE")return {table:{widths:["*"],body:[[{text:element.textContent?.replace(/\t/g,"    "),font:"Mono",fontSize:9,lineHeight:1.25,preserveLeadingSpaces:true,fillColor:"#f0f2f3"}]]},layout:{hLineWidth:()=>0,vLineWidth:()=>0,paddingLeft:()=>10,paddingRight:()=>10,paddingTop:()=>9,paddingBottom:()=>9},margin:[0,8,0,12]};
        if(element.tagName==="CODE")ret.font="Mono";
        if(/^H[1-6]$/.test(element.tagName))ret.headlineLevel=2;
        if(element.tagName==="TABLE"){const table=ret.table as {body:unknown[][];widths?:string[];headerRows?:number};const count=Math.max(...table.body.map(row=>row.length));table.widths=Array(count).fill("*");ret.layout="lightHorizontalLines";ret.fontSize=9;ret.margin=[0,6,0,12];}
        return ret;
      },
    };
    content.push({id:`guide-heading-${i}`,text:article.sections[i].title,fontSize:18,bold:true,margin:[0,18,0,9],headlineLevel:1});
    const body=htmlToPdfmake(doc.body.innerHTML,options);
    markFirstContent(body,`guide-body-${i}`);
    content.push(Array.isArray(body)?body.filter(hasContent):body);
  }
  content.push({text:source,link:item.url,bold:true,fontSize:9,margin:[0,22,0,5]},{text:item.url,link:item.url,color:"#375d75",fontSize:8});
  if(item.source==="pcwiki")content.push({text:"PCGamingWiki contributors · CC BY-NC-SA 3.0",link:"https://creativecommons.org/licenses/by-nc-sa/3.0/",fontSize:8,margin:[0,5,0,0]});
  applyFonts(content);
  const definition:TDocumentDefinitions={
    pageSize:"A4",pageMargins:[48,48,48,50],content,
    defaultStyle:{font:"Roboto",fontSize:10.5,lineHeight:1.3,color:"#20272d"},
    info:{title:article.title,author,subject:game,creator:PRODUCT_NAME},
    header:page=>page===1?null:{text:fontRuns(game,"Roboto"),margin:[48,21,48,0],fontSize:8,color:"#71777c"},
    footer:(page,count)=>({columns:[{text:"HARBOR",width:"*"},{text:`${page} / ${count}`,alignment:"right"}],margin:[48,18,48,0],fontSize:8,color:"#71777c"}),
    pageBreakBefore:(node,queries)=>{
      if(!node.headlineLevel)return false;
      // Empty provider wrappers may start on this page while their first image is on the next.
      const first=node.id?.replace("guide-heading-","guide-body-");
      return !!first&&queries.getNodesOnNextPage().some(next=>next.id===first)||!queries.getFollowingNodesOnPage().some(hasContent);
    },
  };
  signal.throwIfAborted();
  const buffer=await pdfMake.createPdf(definition).getBuffer();signal.throwIfAborted();
  return new Uint8Array(buffer);
}

export async function saveGuidePdf(bytes:Uint8Array,filename:string) {
  if("__TAURI_INTERNALS__" in window){
    const {save}=await import("@tauri-apps/plugin-dialog"),{writeFile}=await import("@tauri-apps/plugin-fs");
    const path=await save({defaultPath:filename,filters:[{name:"PDF",extensions:["pdf"]}]});
    if(path)await writeFile(path,bytes);
    return;
  }
  const blob=new Blob([new Uint8Array(bytes)],{type:"application/pdf"}),url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
