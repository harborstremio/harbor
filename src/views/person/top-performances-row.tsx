import { useT } from "@/lib/i18n";
import type { PersonCredit } from "@/lib/providers/tmdb";
import { FilmRow } from "./film-row";
import { useCreditImdbRatings } from "./use-credit-imdb-ratings";

export function TopPerformancesRow({ credits }: { credits: PersonCredit[] }) {
  const t = useT();
  const imdbRatings = useCreditImdbRatings(credits);
  return (
    <FilmRow
      title={t("IMDb Top")}
      credits={credits}
      showRole
      showRating
      imdbRatings={imdbRatings}
    />
  );
}
