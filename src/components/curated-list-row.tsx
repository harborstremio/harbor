import { useMemo } from "react";
import nytLogo from "@/assets/awards/nyt-logo.svg";
import { CuratedCardBadge } from "@/components/curated-card-badge";
import { PickCard } from "@/components/pick-card";
import { useT } from "@/lib/i18n";
import { curatedList, itemMeta } from "@/lib/curated/registry";
import type { CuratedList, ListBrand } from "@/lib/curated/types";
import { useView } from "@/lib/view";
import { Row } from "./row";

const BRAND_MARK: Record<ListBrand, { src: string; alt: string; height: number }> = {
  nyt: { src: nytLogo, alt: "The New York Times", height: 13 },
};

function ListHeading({ list, label }: { list: CuratedList; label: string }) {
  const mark = list.brand ? BRAND_MARK[list.brand] : undefined;
  if (!mark) return <>{label}</>;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <img
        src={mark.src}
        alt={mark.alt}
        style={{ height: mark.height }}
        className="w-auto shrink-0 opacity-80 dark:invert"
        draggable={false}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function CuratedListRow({ listId, title }: { listId: string; title?: string }) {
  const t = useT();
  const { openCuratedList } = useView();
  const list = curatedList(listId);
  const cards = useMemo(
    () => (list ? list.head.map((item) => ({ item, meta: itemMeta(list, item) })) : []),
    [list],
  );

  if (!list || cards.length === 0) return null;
  const label = title ?? t(list.title);
  return (
    <Row
      title={<ListHeading list={list} label={label} />}
      min={180}
      shape="portrait"
      scrollKey={`discover:list:${list.id}`}
      onViewAll={() => openCuratedList(list.id)}
    >
      {cards.map(({ item, meta }) => (
        <span key={meta.id} className="relative block min-w-0">
          <PickCard meta={meta} />
          <CuratedCardBadge list={list} item={item} />
        </span>
      ))}
    </Row>
  );
}
