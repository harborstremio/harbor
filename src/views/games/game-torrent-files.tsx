import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ChevronRight, File, FileCode2, FileText, Folder, FolderOpen, Search } from "lucide-react";
import { useT } from "@/lib/i18n";
import { torrentTree, visibleTorrentTree, toggleTorrentFiles } from "@/lib/games/torrent-files";
import { transferBytes } from "@/lib/games/transfers";
import type { TorrentFile } from "@/lib/games/torrents";

function FileCheck({ checked, mixed, label, disabled, onChange }: { checked:boolean; mixed?:boolean; label:string; disabled:boolean; onChange:()=>void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(()=>{ if(ref.current) ref.current.indeterminate=!!mixed; },[mixed]);
  return <input ref={ref} className="games-torrent-check" type="checkbox" checked={checked} aria-label={label} disabled={disabled} onChange={onChange}/>;
}
function fileIcon(name:string) {
  if (/\.(zip|rar|7z|bin|iso|cab|pak)$/i.test(name)) return Archive;
  if (/\.(exe|msi|bat|sh|cmd)$/i.test(name)) return FileCode2;
  if (/\.(txt|nfo|md5|sfv|md|json|ini)$/i.test(name)) return FileText;
  return File;
}
export function TorrentFiles({files,selected,onChange,disabled}: {files:TorrentFile[];selected:Set<number>;onChange:(value:Set<number>)=>void;disabled:boolean}) {
  const t=useT(), [query,setQuery]=useState(""), [collapsed,setCollapsed]=useState(new Set<string>()), [limit,setLimit]=useState(100);
  const tree=useMemo(()=>torrentTree(files),[files]);
  const rows=useMemo(()=>visibleTorrentTree(tree,collapsed,query),[tree,collapsed,query]);
  const selectable=useMemo(()=>files.filter(file=>!file.padding),[files]);
  const all=selectable.length>0&&selectable.every(file=>selected.has(file.index));
  return <section className="games-torrent-file-section" aria-label={t("games.torrent.fileList")}>
    <div className="games-torrent-file-tools"><label><Search size={17}/><input placeholder={t("games.torrent.searchFiles")} aria-label={t("games.torrent.searchFiles")} value={query} disabled={disabled} onChange={event=>{setQuery(event.target.value);setLimit(100);}}/></label><button disabled={disabled} onClick={()=>onChange(all?new Set():new Set(selectable.map(file=>file.index)))}>{t(all?"games.torrent.selectNone":"games.torrent.selectAll")}</button></div>
    <div className="games-torrent-file-columns"><span>{t("games.torrent.filesLabel")}</span><span>{t("games.torrent.sizeLabel")}</span></div>
    <div className="games-torrent-files" tabIndex={0}>
      {rows.slice(0,limit).map(({node,depth})=>{
        const count=node.files.filter(file=>selected.has(file.index)).length, opened=!!query.trim()||!collapsed.has(node.key), Icon=node.folder?(opened?FolderOpen:Folder):fileIcon(node.name);
        return <div className={`games-torrent-file-row ${node.folder?"is-folder":""}`} key={node.key} style={{paddingInlineStart:Math.min(depth,5)*20+8}}>
          {node.folder?<button className="games-torrent-disclosure" disabled={disabled||!!query.trim()} aria-label={node.name} aria-expanded={opened} onClick={()=>setCollapsed(old=>{const next=new Set(old);if(next.has(node.key))next.delete(node.key);else next.add(node.key);return next;})}><ChevronRight size={16} style={{transform:opened?"rotate(90deg)":undefined}}/></button>:<span className="games-torrent-disclosure-space"/>}
          <FileCheck checked={count===node.files.length} mixed={count>0&&count<node.files.length} label={node.path} disabled={disabled} onChange={()=>onChange(toggleTorrentFiles(selected,node.files))}/>
          <Icon className="games-torrent-file-icon" size={19} aria-hidden="true"/>
          <button className="games-torrent-file-name" title={node.path} disabled={disabled} onClick={()=>onChange(toggleTorrentFiles(selected,node.files))}>{node.name}{node.folder&&<small>{t("games.torrent.folderCount",{count:node.files.length})}</small>}</button>
          <span className="games-torrent-file-size" dir="ltr">{transferBytes(node.bytes)}</span>
        </div>;
      })}
      {!rows.length&&<p>{t("games.noResults")}</p>}
      {rows.length>limit&&<button className="games-button games-torrent-more" onClick={()=>setLimit(value=>value+100)}>{t("games.torrent.moreFiles",{count:rows.length-limit})}</button>}
    </div>
  </section>;
}

export function TorrentReviewSkeleton() {
  return <div className="games-torrent-skeleton" aria-hidden="true"><div className="games-torrent-skeleton-title"/><div className="games-torrent-skeleton-search"/><div className="games-torrent-file-columns"/>{[72,58,64,42,54].map((width,index)=><div className="games-torrent-file-row" key={index}><i/><b style={{width:`${width}%`}}/><em/></div>)}<div className="games-torrent-skeleton-destination"/></div>;
}
