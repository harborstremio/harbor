import { useState } from "react";
import { GameFileIcon } from "./game-file-icon";
import { useT } from "@/lib/i18n";
import type { ArchivePart } from "@/lib/games/archives";
import { transferBytes } from "@/lib/games/transfers";

export function GameArchiveParts({ parts = [] }: { parts?: ArchivePart[] }) {
  const t = useT(), [visible, setVisible] = useState(8), [open, setOpen] = useState(false);
  if (parts.length < 2) return null;
  return <details className="games-archive-contents games-archive-parts" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{t("games.archive.partsCount", { count: parts.length.toLocaleString() })}</summary>
    {open && <><p>{t("games.archive.partsNote")}</p><ul>{parts.slice(0, visible).map(part => <li key={part.name}><GameFileIcon name={part.name}/><span dir="auto">{part.name}</span><small>{transferBytes(part.bytes)}</small></li>)}</ul>
      {visible < parts.length && <button className="games-button" onClick={() => setVisible(value => value + 32)}>{t("games.archive.partsMore")}</button>}</>}
  </details>;
}
