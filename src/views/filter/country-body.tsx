import { useCountryPeople } from "@/lib/country-people";
import { useCountryCanon } from "@/lib/providers/wikidata-canon";
import type { MetaFilter } from "@/lib/view";
import { BrandBrowse } from "./brand-browse";
import { BrandFacts, useBrandStats } from "./brand-facts";
import { BoxOfficeRail, DecadesSection, FranchisesRail, LongestRunningRail } from "./brand-rails";
import { CountryCanon } from "./country-canon";
import { CountryPeopleRails } from "./country-people";
import { Rails } from "./rails";

type CountryFilter = MetaFilter & { kind: "country" };

export function CountryBody({ filter }: { filter: CountryFilter }) {
  const { details, stats } = useBrandStats(filter);
  const canon = useCountryCanon(filter.iso, filter.mediaType);
  const people = useCountryPeople(filter.iso);
  return (
    <>
      <BrandFacts filter={filter} details={details} stats={stats} />
      <CountryCanon name={filter.name} mediaType={filter.mediaType} titles={canon} />
      <Rails filter={filter} />
      {stats && filter.mediaType === "movie" && <BoxOfficeRail stats={stats} />}
      {stats && <FranchisesRail stats={stats} name={filter.name} />}
      {stats && filter.mediaType === "tv" && <LongestRunningRail stats={stats} name={filter.name} />}
      <CountryPeopleRails name={filter.name} people={people} />
      {stats && <DecadesSection filter={filter} stats={stats} />}
      <BrandBrowse filter={filter} />
    </>
  );
}
