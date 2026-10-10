import { useCallback, useState } from "react";
import type { SportsGame } from "@/lib/sports/espn-types";
import { gameKey } from "@/lib/sports/hub-cache";
import { BpRowHeader } from "../bp-row-header";
import { BpSportsCard } from "./bp-sports-card";
import type { BpSportsRowModel, BpSportsSelect } from "./bp-sports-types";

export const BP_SPORTS_TRACK =
  "flex gap-[clamp(12px,1.05vw,22px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const DESCRIPTION =
  "mb-[clamp(2px,0.3vh,6px)] line-clamp-1 px-[var(--bp-gutter)] text-[calc(clamp(11.5px,1.5vh,17px)*var(--bp-up,1))] font-semibold text-[color-mix(in_oklab,var(--color-ink)_44%,transparent)] transition-colors duration-[var(--bp-focus-fade)] ease-[var(--bp-ease)] [[data-bp-row-focus]_&]:text-ink-subtle motion-reduce:transition-none";

const CHUNK = 12;
const LOOKAHEAD = 4;

export function BpSportsRow({
  row,
  onSelect,
  autofocusFirst,
  onFocusGame,
}: {
  row: BpSportsRowModel;
  onSelect: BpSportsSelect;
  autofocusFirst?: boolean;
  onFocusGame?: (game: SportsGame) => void;
}) {
  const [shown, setShown] = useState(CHUNK);

  const onCardFocus = useCallback(
    (index: number, game: SportsGame) => {
      setShown((current) => (index >= current - LOOKAHEAD ? current + CHUNK : current));
      onFocusGame?.(game);
    },
    [onFocusGame],
  );

  if (!row.games.length) return null;

  return (
    <section data-bp-row data-bp-row-key={row.key} aria-label={row.title} className="relative">
      <BpRowHeader title={row.title} />
      {row.description ? (
        <p dir="auto" className={DESCRIPTION}>
          {row.description}
        </p>
      ) : null}
      <div data-bp-scroll-x className={BP_SPORTS_TRACK}>
        {row.games.slice(0, shown).map((game, i) => (
          <BpSportsCard
            key={`${gameKey(game)}-${i}`}
            game={game}
            onSelect={onSelect}
            autofocus={autofocusFirst && i === 0}
            onFocusGame={(focused) => onCardFocus(i, focused)}
          />
        ))}
      </div>
    </section>
  );
}
