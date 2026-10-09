import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { fetchFeaturedPeople, type FeaturedPerson, type RankManifest } from "@/lib/harbor-rank";

const MAX_NAMES = 4;

export function BornToday({
  manifest,
  onOpenPerson,
}: {
  manifest: RankManifest | null;
  onOpenPerson: (id: number) => void;
}) {
  const t = useT();
  const [people, setPeople] = useState<FeaturedPerson[]>([]);
  const file = manifest?.featured?.find((f) => f.key === "born-today")?.file;

  useEffect(() => {
    if (!file) {
      setPeople([]);
      return;
    }
    let cancelled = false;
    fetchFeaturedPeople(file).then((list) => {
      if (!cancelled) setPeople(list.filter((p) => !p.deathday).slice(0, MAX_NAMES));
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (people.length === 0) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-ink-subtle">
      <span>{t("Born today")}</span>
      <span className="flex flex-wrap items-baseline gap-x-1">
        {people.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpenPerson(p.id)}
            className="rounded-sm text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-subtle motion-reduce:transition-none"
          >
            {p.name}
            {i < people.length - 1 ? "," : ""}
          </button>
        ))}
      </span>
    </p>
  );
}
