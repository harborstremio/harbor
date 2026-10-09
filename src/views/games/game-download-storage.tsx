import {useGameStorage} from "@/hooks/use-game-storage";
import {useT} from "@/lib/i18n";
import {transferBytes} from "@/lib/games/transfers";
import type {DownloadItem} from "@/lib/games/download-presentation";
import "./game-download-storage.css";

export function GameDownloadStorage({profile,active,available,items}:{profile:string;active:boolean;available:boolean;items:DownloadItem[]}){
  const t=useT();
  const pending=items.filter(item=>item.record.profile===profile&&!["complete","canceled"].includes(item.record.status));
  const revision=pending.map(item=>`${item.kind}:${item.record.id}:${item.record.status}:${item.kind==="direct"?item.record.total:item.record.totalBytes}`).join("|");
  const storage=useGameStorage(profile,active&&pending.length>0,available,revision);
  if(!pending.length||(!storage.drives.length&&!storage.error))return null;
  return <section className="games-download-storage" aria-label={t("games.download.storage.title")}>
    <details><summary>{t("games.download.storage.title")}</summary><p>{t("games.download.storage.note")}</p></details>
    {storage.error?<p className="games-storage-error" role="status">{t("games.download.storage.error")} <button onClick={storage.refresh}>{t("games.library.refresh")}</button></p>:<div className="games-storage-drives">{storage.drives.map(drive=><div className="games-storage-drive" key={drive.volume}>
      <div><strong dir="ltr" title={drive.volume}>{drive.volume}</strong><span>{drive.availableBytes===null?t("games.download.storage.unavailable"):t("games.download.storage.free",{size:transferBytes(drive.availableBytes)})}</span></div>
      <p>{t("games.download.storage.remaining",{size:transferBytes(drive.remainingBytes)})}{drive.unknownFiles>0&&<span>{t("games.download.storage.unknown",{count:drive.unknownFiles})}</span>}</p>
      {!!drive.estimatedFiles&&<p>{t("games.download.storage.estimate")}</p>}
      {drive.otherReservedBytes>0&&<p>{t("games.download.storage.other",{size:transferBytes(drive.otherReservedBytes)})}</p>}
      {drive.shortfallBytes!==null&&drive.shortfallBytes>0&&<p className="games-storage-shortfall">{t("games.download.storage.shortfall",{size:transferBytes(drive.shortfallBytes)})}</p>}
    </div>)}</div>}
  </section>;
}
