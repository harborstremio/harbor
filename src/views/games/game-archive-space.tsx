import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";
import { transferBytes } from "@/lib/games/transfers";
import type { useArchiveSpace } from "@/hooks/use-archive-space";

const spaceBytes = (bytes: number) => `\u2068${transferBytes(bytes)}\u2069`;

export function GameArchiveSpace({ space, busy }: { space: ReturnType<typeof useArchiveSpace>; busy: boolean }) {
  const t = useT(), value = space.value;
  const root = useRef<HTMLElement>(null);
  const shortfall = value?.shortfallBytes != null && value.shortfallBytes > 0;
  useEffect(() => {
    if (!space.checking && (value || space.error)) root.current?.scrollIntoView({ block: "nearest" });
  }, [space.checking, value, space.error]);
  return <section ref={root} className="games-archive-space" aria-label={t("games.archive.space.title")} aria-busy={space.checking}>
    <header><h3>{t("games.archive.space.title")}</h3><button type="button" className="games-icon-button" disabled={busy || space.checking} aria-label={t("games.archive.space.refresh")} title={t("games.archive.space.refresh")} onClick={space.refresh}><RefreshCw size={16}/></button></header>
    {space.checking ? <div className="games-archive-space-skeleton" role="status" aria-label={t("games.archive.space.checking")}><i/><div><i/><i/></div><i/><i/></div> : space.error ? <p role="status">{t("games.archive.space.error")}</p> : value && <>
      {value.volume && <bdi className="games-archive-volume" dir="ltr">{value.volume}</bdi>}
      <div className="games-archive-space-figures"><span>{t("games.archive.space.required", { size: spaceBytes(value.expandedBytes) })}</span>{value.availableBytes !== null && <span>{t("games.archive.space.free", { size: spaceBytes(value.availableBytes) })}</span>}</div>
      {value.reservedBytes > 0 && <p>{t("games.archive.space.reserved", { size: spaceBytes(value.reservedBytes) })}</p>}
      <p className={shortfall ? "games-archive-space-shortfall" : "games-archive-space-outcome"} role="status">{t(value.availableBytes === null ? "games.archive.space.unknown" : shortfall ? "games.archive.space.shortfall" : "games.archive.space.after", { size: spaceBytes(shortfall ? value.shortfallBytes! : value.afterBytes ?? 0) })}</p>
      <small>{t(shortfall ? "games.archive.space.shortfallNote" : "games.archive.space.note")}</small>
    </>}
  </section>;
}
