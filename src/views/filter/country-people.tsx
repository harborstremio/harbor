import { useT } from "@/lib/i18n";
import type { CountryFace, CountryPeople } from "@/lib/country-people";
import { PeopleRail } from "./brand-people";

export function CountryPeopleRails({ name, people }: { name: string; people: CountryPeople }) {
  const t = useT();
  const note = (p: CountryFace) => {
    if (p.local <= 0) return "";
    if (p.local === 1) return t("1 title from {name}", { name });
    return t("{n} titles from {name}", { n: p.local, name });
  };
  return (
    <>
      <PeopleRail
        title={t("Faces of {name}", { name })}
        kicker={t("The country's biggest names, ranked across their whole careers")}
        people={people.faces}
        note={note}
      />
      <PeopleRail
        title={t("Behind the camera")}
        kicker={t("The directors from {name}, ranked across their whole careers", { name })}
        people={people.directors}
        note={note}
      />
    </>
  );
}
