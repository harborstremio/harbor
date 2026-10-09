import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { GUTENDEX_ID } from "@/lib/ebook/gutendex";
import type { AdaptationFamily } from "@/lib/providers/wikidata-graph";
import { GraphPanel, GraphPanelRow, useAnchor } from "./graph-panel";

export function AdaptationRow({ family }: { family: AdaptationFamily }) {
  const t = useT();
  const { openMeta, openEBook } = useView();
  const { anchor, open, close } = useAnchor();
  const { source, siblings } = family;
  const reachable = siblings.length > 0 || !!source.gutenbergId;

  const facts = [
    source.authors.filter((name) => !/^https?:\/\//i.test(name)).join(" & "),
    source.year != null ? String(source.year) : "",
  ].filter(Boolean);

  const subtitle = [
    ...facts,
    siblings.length > 0
      ? siblings.length === 1
        ? t("One other screen version")
        : t("{n} other screen versions", { n: siblings.length })
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {reachable ? (
          <button
            type="button"
            onClick={open}
            className="rounded-md text-ink underline-offset-4 transition-colors hover:text-accent hover:underline"
          >
            {source.title}
          </button>
        ) : (
          <span className="text-ink">{source.title}</span>
        )}
        {facts.map((fact) => (
          <span key={fact} className="flex items-center">
            <span className="me-1.5 text-ink-subtle">·</span>
            <span className="text-ink-muted">{fact}</span>
          </span>
        ))}
      </span>
      {anchor && (
        <GraphPanel
          title={source.title}
          subtitle={subtitle || undefined}
          anchor={anchor}
          onClose={close}
          action={
            source.gutenbergId ? (
              <button
                type="button"
                onClick={() => {
                  openEBook(`source:${GUTENDEX_ID}:${source.gutenbergId}`);
                  close();
                }}
                className="mt-1.5 self-start rounded-md text-[11px] font-semibold text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                {t("Read it")}
              </button>
            ) : undefined
          }
        >
          {siblings.map((sibling) => (
            <li key={sibling.metaId}>
              <GraphPanelRow
                lead={sibling.year != null ? String(sibling.year) : ""}
                name={sibling.name}
                note={sibling.kind === "tv" ? t("Television") : undefined}
                posterId={sibling.metaId}
                onClick={() => {
                  openMeta({
                    id: sibling.metaId,
                    type: sibling.kind === "tv" ? "series" : "movie",
                    name: sibling.name,
                  });
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
