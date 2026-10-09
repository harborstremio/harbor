import { useState, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n";

export function MinecraftProjectLink({ url, children }: { url: string; children: ReactNode }) {
  const t = useT(), [failed, setFailed] = useState(false);
  return <><a href={url} target="_blank" rel="noreferrer" onClick={event => { if (!isTauri()) return; event.preventDefault(); void import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(url)).catch(() => setFailed(true)); }}>{children}<ExternalLink size={13} /></a>{failed && <span role="alert">{t("games.minecraft.catalog.linkError")}</span>}</>;
}
