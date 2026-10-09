import { useState } from "react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { loadPokemonMove } from "@/lib/games/pokemon";
import { pokeLabel, type parsePokeMoves } from "@/lib/games/pokemon-data";
import type { PokemonEdition } from "@/lib/games/pokemon-games";
import type { PokemonMoveDetail } from "@/lib/games/pokemon-move-details";
import { PokemonStatus } from "./game-pokemon-shared";
import { usePokemonFeed } from "./use-pokemon-feed";

export function PokemonTypeBadge({ type }: { type: string }) {
  return <span className="pokemon-type-badge" data-type={type}>{pokeLabel(type)}</span>;
}
function MoveCategory({ category }: { category: string }) {
  const t = useT();
  return <span className="pokemon-move-category" data-category={category}><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
    {category === "physical" ? <path d="m10 2 2 5 5-3-2 5 3 2-5 2 1 5-4-3-4 3 1-5-5-2 5-2-2-5 5 3Z" fill="currentColor"/> : category === "special" ? <g fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="10" cy="10" rx="8" ry="6"/><ellipse cx="10" cy="10" rx="4" ry="3"/></g> : <g fill="currentColor"><circle cx="10" cy="10" r="6" opacity=".3"/><circle cx="10" cy="10" r="2.5"/></g>}
  </svg>{t(`games.pokemon.move.${category}`)}</span>;
}
export function PokemonMoves({ moves, edition, active }: { moves: ReturnType<typeof parsePokeMoves>; edition: PokemonEdition; active: boolean }) {
  const t = useT(), language = useUiLanguage(), [limit, setLimit] = useState(12);
  const shown = moves.slice(0, limit), ids = [...new Set(shown.map(move => move.id))];
  const feed = usePokemonFeed(`${edition.key}:${language}:${ids.join(",")}`, active, async signal => {
    const details: Record<number, PokemonMoveDetail> = {};
    for (let i = 0; i < ids.length; i += 4) {
      signal.throwIfAborted();
      await Promise.all(ids.slice(i, i + 4).map(async id => { try { details[id] = await loadPokemonMove(id, edition, language, signal); } catch { signal.throwIfAborted(); } }));
    }
    return details;
  });
  return <><p className="pokemon-note">{t("games.pokemon.editionMoves")}</p>{feed.busy ? <p className="pokemon-note" role="status">{t("common.loading")}</p> : <PokemonStatus feed={feed}/>}
    <div className="pokemon-moves pokemon-move-details">{shown.map((move, index) => {
      const detail = feed.data?.[move.id];
      return <article key={`${move.id}:${index}`}><header><strong>{detail?.name ?? pokeLabel(move.name)}</strong><span>{pokeLabel(move.method)}{move.level > 0 ? ` · ${t("games.pokemon.level", { level: move.level })}` : ""}</span></header>
        {detail && <><div className="pokemon-move-badges"><PokemonTypeBadge type={detail.type}/><MoveCategory category={detail.category}/></div>
          <dl>{(["power", "accuracy", "pp"] as const).map(key => <div key={key}><dt>{t(`games.pokemon.move.${key}`)}</dt><dd>{detail[key] == null ? "—" : `${detail[key]}${key === "accuracy" ? "%" : ""}`}</dd></div>)}</dl>
          {detail.description && <p>{detail.description}</p>}</>}
      </article>;
    })}</div>
    {feed.data && ids.some(id => !feed.data?.[id]) && <button className="pokemon-more" onClick={feed.retry}>{t("common.retry")}</button>}
    {moves.length > limit && <button className="pokemon-more" onClick={() => setLimit(value => value + 12)}>{t("games.pokemon.loadMore")}</button>}
    {!moves.length && <p className="pokemon-note">{t("games.pokemon.noMoves")}</p>}
  </>;
}
