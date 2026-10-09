import { useEffect, useState } from "react";
import { downloadDir } from "@tauri-apps/api/path";
import { FolderOpen } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ModGameMark } from "./mod-identity";

export function MinecraftStorageChoice({ busy, select, browse }: { busy: boolean; select: (path: string) => void; browse: () => void }) {
  const t = useT(), [suggested, setSuggested] = useState("");
  useEffect(() => { let alive = true; void downloadDir().then(path => { if (alive) setSuggested(path); }, () => {}); return () => { alive = false; }; }, []);
  return <div className="mc-instance-location mod-storage-choice"><ModGameMark game="minecraft"/><h3>{t("games.minecraft.instances.storage")}</h3><p>{t("games.minecraft.instances.storageNote")}</p>
    {suggested && <button className="mod-storage-suggestion" disabled={busy} onClick={() => select(suggested)}><FolderOpen size={25}/><span><strong>{t("nav.downloads")}</strong><small dir="auto">{suggested}</small></span></button>}
    <button className="games-button" disabled={busy} onClick={browse}><FolderOpen size={19}/>{t("games.minecraft.instances.chooseFolder")}</button>
  </div>;
}
