import { accoladesFor } from "@/lib/curated/accolades";
import { CRITERION_LIST_ID, spineFor } from "@/lib/curated/spine";
import { inductionYear, REGISTRY_LIST_ID } from "@/lib/film-registry/inductions";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { Pill } from "./pill";

export function AccoladeBadges({ imdbId }: { imdbId: string | null | undefined }) {
  const t = useT();
  const { openCuratedList } = useView();
  const spine = spineFor(imdbId);
  const inducted = inductionYear(imdbId);
  const accolades = accoladesFor(imdbId);
  if (spine == null && inducted == null && accolades.length === 0) return null;
  return (
    <>
      {spine != null && (
        <Pill onClick={() => openCuratedList(CRITERION_LIST_ID)}>
          <span className="tabular-nums">{t("Spine {n}", { n: spine })}</span>
        </Pill>
      )}
      {inducted != null && (
        <Pill onClick={() => openCuratedList(REGISTRY_LIST_ID)}>
          <span>{t("Film Registry")}</span>
          <span className="tabular-nums">{inducted}</span>
        </Pill>
      )}
      {accolades.map((accolade) => (
        <Pill key={accolade.listId} onClick={() => openCuratedList(accolade.listId)}>
          <span>{t(accolade.badge)}</span>
          <span className="tabular-nums">{accolade.year}</span>
        </Pill>
      ))}
    </>
  );
}
