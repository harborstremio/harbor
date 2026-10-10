import { useEffect, useMemo, useState } from "react";
import { PickCard } from "@/components/pick-card";
import { Row, usePosterRow } from "@/components/row";
import { loadListItems } from "@/lib/curated/items";
import { curatedList, itemMeta } from "@/lib/curated/registry";
import type { CuratedListItem } from "@/lib/curated/types";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { RailHeading } from "./brand-rails";

const LIST_ID = "nbr-top-ten";
const MIN_TITLES = 5;

export function YearTopTen({ year }: { year: number }) {
  const t = useT();
  const posterRow = usePosterRow();
  const { openCuratedList } = useView();
  const list = curatedList(LIST_ID);
  const [items, setItems] = useState<readonly CuratedListItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadListItems(LIST_ID).then((all) => {
      if (alive) setItems(all);
    });
    return () => {
      alive = false;
    };
  }, []);

  const honoured = useMemo(
    () => (items ?? []).filter((item) => item.awardYear === year),
    [items, year],
  );

  if (!list || honoured.length < MIN_TITLES) return null;
  return (
    <Row
      {...posterRow}
      title={
        <RailHeading
          title={t(list.curator)}
          kicker={t("Top ten films of {year}", { year })}
        />
      }
      scrollKey={`year:top-ten:${year}`}
      onViewAll={() => openCuratedList(LIST_ID)}
    >
      {honoured.map((item) => (
        <PickCard key={item.imdb} meta={itemMeta(list, item)} />
      ))}
    </Row>
  );
}
