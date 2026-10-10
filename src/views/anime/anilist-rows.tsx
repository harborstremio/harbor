import { PickCard } from "@/components/pick-card";
import { PinHomeButton } from "@/components/pin-home-button";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { useAnilistAnimeRailsState } from "@/lib/use-anilist-anime-rails";
import { AnimeRowStatus } from "./anime-row-status";

export function AnilistRows() {
  const t = useT();
  const { rails, loading, error, retry } = useAnilistAnimeRailsState();
  return (
    <>
      {(error || (loading && rails.length === 0)) && <AnimeRowStatus title={t("Your AniList")} loading={loading} onRetry={retry} />}
      {rails.map((rail) => {
        const label =
          rail.key === "recommended"
            ? t("Recommended for you")
            : t("Your AniList: {name}", { name: rail.title });
        return (
          <div key={rail.key} data-scroll-anchor={`row:anilist:${rail.key}`}>
            <Row
              title={
                <span className="inline-flex items-center gap-2">
                  {label}
                  <PinHomeButton id={`anilist:${rail.key}`} source="anilist" name={label} params={{ railKey: rail.key }} />
                </span>
              }
              scrollKey={`anime:anilist:${rail.key}`}
            >
              {rail.metas.map((m, i) => (
                <PickCard key={`${m.id}-${i}`} meta={m} />
              ))}
            </Row>
          </div>
        );
      })}
    </>
  );
}
