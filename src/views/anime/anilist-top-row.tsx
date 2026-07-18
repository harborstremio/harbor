import { PickCard } from "@/components/pick-card";
import { PinHomeButton } from "@/components/pin-home-button";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { useAnilistTop, useAnilistTrending } from "@/lib/use-anilist-top";

export function AnilistTrendingRow() {
  const t = useT();
  const metas = useAnilistTrending();
  if (metas.length === 0) return null;
  return (
    <div data-scroll-anchor="row:anilist-trending">
      <Row
        title={
          <span className="inline-flex items-center gap-2">
            {t("Trending on AniList")}
            <PinHomeButton
              id="anilist:trending"
              source="anilist"
              name={t("Trending on AniList")}
              params={{ railKey: "trending" }}
            />
          </span>
        }
        scrollKey="anime:anilist-trending"
      >
        {metas.map((m, i) => (
          <PickCard key={`${m.id}-${i}`} meta={m} />
        ))}
      </Row>
    </div>
  );
}

export function AnilistTopRow() {
  const t = useT();
  const metas = useAnilistTop();
  if (metas.length === 0) return null;
  return (
    <div data-scroll-anchor="row:anilist-top">
      <Row
        title={
          <span className="inline-flex items-center gap-2">
            {t("Top 100 on AniList")}
            <PinHomeButton
              id="anilist:top100"
              source="anilist"
              name={t("Top 100 on AniList")}
              params={{ railKey: "top100" }}
            />
          </span>
        }
        scrollKey="anime:anilist-top"
      >
        {metas.map((m, i) => (
          <PickCard key={`${m.id}-${i}`} meta={m} />
        ))}
      </Row>
    </div>
  );
}
