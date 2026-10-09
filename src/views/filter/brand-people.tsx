import { Row, usePosterRow } from "@/components/row";
import { CastCard } from "@/views/detail/cast-card";
import { useT } from "@/lib/i18n";
import type { BrandPerson, BrandStats } from "@/lib/providers/tmdb/tmdb-brands";
import type { MetaFilter } from "@/lib/view";

type Branded = MetaFilter & { kind: "studio" | "network"; id: number; name: string };

export function PeopleRail<T extends BrandPerson>({ title, kicker, people, note }: { title: string; kicker: string; people: T[]; note: (p: T) => string }) {
  const posterRow = usePosterRow();
  if (people.length === 0) return null;
  const heading = (
    <span className="flex flex-col">
      <span className="text-[20px] font-medium tracking-tight text-ink">{title}</span>
      <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">{kicker}</span>
    </span>
  );
  return (
    <Row {...posterRow} shape="portrait" min={148} title={heading}>
      {people.map((p) => (
        <CastCard key={p.id} cast={{ ...p, character: note(p) }} />
      ))}
    </Row>
  );
}

export function BrandPeople({ filter, stats }: { filter: Branded; stats: BrandStats | null }) {
  const t = useT();
  if (!stats) return null;
  return (
    <>
      <PeopleRail
        title={t("Faces of {name}", { name: filter.name })}
        kicker={t("The actors who appear most across {name} titles", { name: filter.name })}
        people={stats.faces}
        note={(p) => t("{n} titles", { n: p.titles })}
      />
      <PeopleRail
        title={t("Behind the camera")}
        kicker={t("The directors and creators {name} works with most", { name: filter.name })}
        people={stats.makers}
        note={(p) => `${p.character} · ${t("{n} titles", { n: p.titles })}`}
      />
    </>
  );
}
