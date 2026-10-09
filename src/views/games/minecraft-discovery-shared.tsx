import type { RefObject } from "react";
import { useT } from "@/lib/i18n";

export function DiscoveryFooter({ feed, unavailable }: { feed: { items: unknown[]; busy: boolean; error: string; next: string; sentinel: RefObject<HTMLDivElement | null>; retry: () => void; more: () => void }; unavailable: string }) {
  const t = useT();
  return <>
    {feed.busy && <div className="mc-discovery-skeletons" aria-label={t("common.loading")} role="status">{Array.from({ length: feed.items.length ? 2 : 5 }, (_, i) => <div key={i}><i/><span><i/><i/><i/></span></div>)}</div>}
    {!!feed.error && <div className="mc-catalog-error" role="alert"><span>{unavailable}</span><button className="games-button" onClick={feed.retry}>{t("common.retry")}</button></div>}
    {!feed.busy && !feed.error && !feed.items.length && <p className="mc-catalog-empty">{t("games.minecraft.catalog.empty")}</p>}
    <div ref={feed.sentinel} className="mc-discovery-more">{!!feed.next && !feed.error && <button className="games-button" disabled={feed.busy} onClick={feed.more}>{t("games.minecraft.discovery.loadMore")}</button>}</div>
  </>;
}
