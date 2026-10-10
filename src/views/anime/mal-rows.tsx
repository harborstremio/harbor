import { PickCard } from "@/components/pick-card";
import { PinHomeButton } from "@/components/pin-home-button";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { useMalAnimeRailsState } from "@/lib/use-mal-anime-rails";
import { AnimeRowStatus } from "./anime-row-status";

export function MalRows() {
  const t = useT();
  const { rails, loading, error, retry } = useMalAnimeRailsState();
  return (
    <>
      {(error || (loading && rails.length === 0)) && <AnimeRowStatus title={t("Your MAL Lists")} loading={loading} onRetry={retry} />}
      {rails.map((rail) => (
        <div key={rail.key} data-scroll-anchor={`row:mal:${rail.key}`}>
          <Row
            title={
              <span className="inline-flex items-center gap-2">
                {t("Your MAL: {name}", { name: t(rail.title) })}
                <PinHomeButton
                  id={`mal:${rail.key}`}
                  source="mal"
                  name="Your MAL: {name}"
                  params={{ railKey: rail.key }}
                />
              </span>
            }
            scrollKey={`anime:mal:${rail.key}`}
          >
            {rail.metas.map((m, i) => (
              <PickCard key={`${m.id}-${i}`} meta={m} />
            ))}
          </Row>
        </div>
      ))}
    </>
  );
}
