import { useMemo } from "react";
import { PickCard } from "@/components/pick-card";
import { Row, usePosterRow } from "@/components/row";
import { useT } from "@/lib/i18n";
import { canonMeta, MIN_CANON, type CanonTitle } from "@/lib/providers/wikidata-canon";
import { RailHeading } from "./brand-rails";

export function CountryCanon({
  name,
  mediaType,
  titles,
}: {
  name: string;
  mediaType: "movie" | "tv";
  titles: CanonTitle[] | null;
}) {
  const t = useT();
  const posterRow = usePosterRow();
  const metas = useMemo(
    () => (titles ?? []).map((title) => canonMeta(title, mediaType)),
    [titles, mediaType],
  );
  if (titles !== null && metas.length < MIN_CANON) return null;
  const kicker =
    mediaType === "tv"
      ? t("The series that carried {name} beyond its own borders", { name })
      : t("The films that carried {name} beyond its own borders", { name });
  return (
    <Row
      {...posterRow}
      title={<RailHeading title={t("The canon")} kicker={kicker} />}
      scrollKey={`country:canon:${mediaType}:${name}`}
    >
      {metas.length > 0
        ? metas.map((meta) => <PickCard key={meta.id} meta={meta} />)
        : Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`${posterRow.shape === "landscape" ? "aspect-[16/9]" : "aspect-[2/3]"} animate-pulse rounded-xl bg-elevated/40`}
            />
          ))}
    </Row>
  );
}
