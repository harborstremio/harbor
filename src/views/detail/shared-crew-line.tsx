import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import type { SharedCrewFilm } from "@/lib/providers/wikidata-graph";
import { GraphPanel, GraphPanelRow, useAnchor } from "./graph-panel";

export function SharedCrewLine({ films }: { films: SharedCrewFilm[] }) {
  const t = useT();
  const { openMeta } = useView();
  const { anchor, open, close } = useAnchor();

  if (films.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="col-span-full -mx-1 flex min-h-11 w-fit max-w-full items-center rounded-md px-1 text-[13px] text-ink-subtle underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        {films.length === 1
          ? t("Shares crew with 1 other film")
          : t("Shares crew with {n} other films", { n: films.length })}
      </button>
      {anchor && (
        <GraphPanel
          title={t("Shares crew with")}
          subtitle={t("Three or more of the same crew")}
          anchor={anchor}
          onClose={close}
        >
          {films.map((film) => (
            <li key={film.metaId}>
              <GraphPanelRow
                lead={String(film.shared)}
                name={film.name}
                note={film.who.join(", ")}
                posterId={film.metaId}
                onClick={() => {
                  openMeta({ id: film.metaId, type: "movie", name: film.name });
                  close();
                }}
              />
            </li>
          ))}
        </GraphPanel>
      )}
    </>
  );
}
