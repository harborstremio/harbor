import { useEffect, useRef, useState } from "react";
import { NavChevron } from "@/components/nav-arrow";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import type { AtlasRoute, GameConnection } from "@/lib/games/igdb-data";
import type { StudioProfile } from "@/lib/games/studio-data";
import { StudioLogo } from "./game-studio-logo";

/** A reserved relationship strip keeps changing company families out of document flow. */
export function GameStudioRelations({ profile, browse }: { profile?: StudioProfile; browse: (route: AtlasRoute) => void }) {
  const t = useT(), root = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState(4), [page, setPage] = useState(0);
  useEffect(() => {
    const node = root.current; if (!node) return;
    const measure = () => setSlots(Math.max(1, Math.min(5, Math.floor((node.clientWidth - 95) / 190))));
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setPage(0), [profile?.id, slots]);
  const relations = profile ? [
    ...(profile.parent ? [{ company: profile.parent, parent: true }] : []),
    ...profile.children.map(company => ({ company, parent: false })),
  ] : [];
  const pages = Math.ceil(relations.length / slots), current = Math.min(page, Math.max(0, pages - 1));
  const open = (company: GameConnection) => browse({ kind: "company", ...company, includeSubsidiaries: true });
  return <div className="games-studio-relations" ref={root} role="group" aria-label={t("games.studios.related")} aria-busy={!profile}>
    <div className="games-studio-relation-track" style={{ gridTemplateColumns: `repeat(${slots},minmax(0,1fr))` }}>
      {profile ? relations.slice(current * slots, (current + 1) * slots).map(({ company, parent }) => <HoverTooltip key={company.id} label={company.name} sublabel={t(parent ? "games.studios.partOf" : "games.studios.related")} mark={<StudioLogo className="games-studio-relation-mark" studio={company}/>} arrow side="top">
        <button onClick={() => open(company)}>
          <StudioLogo studio={company}/>
          <span>{parent && <small>{t("games.studios.partOf")}</small>}<strong>{company.name}</strong></span>
        </button>
      </HoverTooltip>) : Array.from({ length: slots }, (_, index) => <i key={index} aria-hidden="true" />)}
    </div>
    {pages > 1 && <div className="games-page-controls"><button className="games-icon-button" aria-label={t("common.previous")} disabled={!current} onClick={() => setPage(current - 1)}><NavChevron dir="left" size={17}/></button><button className="games-icon-button" aria-label={t("common.next")} disabled={current === pages - 1} onClick={() => setPage(current + 1)}><NavChevron dir="right" size={17}/></button></div>}
  </div>;
}
