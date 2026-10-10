import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { SimsCreatorContent } from "@/lib/games/sims";
import packageIcon from "@/assets/settings-icons/package.svg";

type Props = { content: SimsCreatorContent | undefined; select?: (page: string, trigger: HTMLElement) => void; disabled?: boolean; expanded?: boolean; focusItem?: number };

export function GameSimsCreatorContent(props: Props) {
  const { content } = props;
  if (!content) return null;
  const notes = content.notes;
  return <>
    {(content.listed || content.items.length > 0 || !notes?.items.length) && <CreatorList {...props} content={content}/>}
    {notes && (notes.items.length > 0 || notes.partial) && <CreatorList {...props} content={notes} notes offset={content.items.length}/>}
  </>;
}

function CreatorList({ content, select, disabled = false, expanded = false, focusItem, notes = false, offset = 0 }: Omit<Props, "content"> & { content: Pick<SimsCreatorContent, "items" | "partial">; notes?: boolean; offset?: number }) {
  const t = useT(), [limit, setLimit] = useState(12), root = useRef<HTMLDetailsElement>(null);
  const localFocus = focusItem !== undefined && focusItem >= offset && focusItem < offset + content.items.length ? focusItem - offset : undefined;
  useEffect(() => { setLimit(12); }, [content]);
  useEffect(() => {
    if (localFocus === undefined || disabled) return;
    if (limit <= localFocus) { setLimit(Math.ceil((localFocus + 1) / 12) * 12); return; }
    root.current?.querySelector<HTMLButtonElement>(`[data-sims-creator-item="${offset + localFocus}"]`)?.focus({ preventScroll: true });
  }, [localFocus, offset, limit, disabled]);
  const declarations = [...new Set(content.items.map(item => item.included))];
  const label = (value: boolean | null) => t(value === true ? "games.sims.creatorCcIncluded" : value === false ? "games.sims.creatorCcSeparate" : "games.sims.creatorCcUnspecified");
  return <details ref={root} className={`games-sims-creator-content${notes ? " games-sims-creator-notes" : ""}`} open={expanded || localFocus !== undefined || undefined}>
    <summary>{t(notes ? "games.sims.creatorNotesTitle" : "games.sims.creatorCcTitle", { count: content.items.length })}<ChevronDown size={16}/></summary>
    <p>{t(notes ? "games.sims.creatorNotesNote" : "games.sims.creatorCcNote")}</p>
    {content.partial && <p role="status">{t("games.sims.creatorCcPartial")}</p>}
    {!notes && content.items.length === 0 && <p>{t("games.sims.creatorCcEmpty")}</p>}
    {!notes && declarations.length === 1 && <small>{label(declarations[0])}</small>}
    <div>{content.items.slice(0, limit).map((item, index) => <article key={`${index}:${item.title}`}>
      <span className="games-sims-file-icon" style={{ maskImage: `url("${packageIcon}")` }} aria-hidden="true"/>
      <div><strong dir="auto">{item.title}</strong><small dir="auto">{item.creator}{item.creator && item.page && " · "}{item.page && new URL(item.page).hostname}</small>{!notes && declarations.length > 1 && <small>{label(item.included)}</small>}
        {item.page ? <button className="games-detail-text-button" data-sims-creator-item={offset + index} disabled={disabled} onClick={event => item.project && select ? select(item.page!, event.currentTarget) : void openUrl(item.page!)}>{t(item.project && select ? "games.sims.creatorCcFiles" : "games.sims.creatorCcOpen")}{!(item.project && select) && <ArrowUpRight size={13}/>}</button> : <small>{t("games.sims.creatorCcNoLink")}</small>}
      </div>
    </article>)}</div>
    {content.items.length > limit && <button className="games-button" onClick={() => setLimit(n => n + 12)}>{t("games.details.showMore")}</button>}
  </details>;
}
