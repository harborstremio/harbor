import { Poster } from "@/components/poster";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { IMG } from "@/lib/providers/tmdb/tmdb-client";
import { useView } from "@/lib/view";
import { COLLAB_RAIL_MIN, type Collaborator } from "./collaborator-rank";

export function CollaboratorRail({ people }: { people: Collaborator[] }) {
  const t = useT();
  if (people.length < COLLAB_RAIL_MIN) return null;
  return (
    <Row title={t("Frequent Collaborators")} min={148}>
      {people.map((p) => (
        <CollaboratorCard key={p.id} person={p} />
      ))}
    </Row>
  );
}

function CollaboratorCard({ person }: { person: Collaborator }) {
  const t = useT();
  const { openPerson } = useView();
  const shared = t("{n} titles together", { n: person.titles });
  return (
    <button
      onClick={() => openPerson(person.id)}
      className="group flex w-full min-w-0 flex-col gap-2.5 text-start"
    >
      <Poster
        src={person.profilePath ? `${IMG}/w342${person.profilePath}` : undefined}
        seed={String(person.id)}
        ratio="portrait"
        className="rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:-translate-y-1.5 group-hover:shadow-[0_22px_44px_-14px_rgba(0,0,0,0.6)]"
      />
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="line-clamp-1 text-[13.5px] font-semibold text-ink">{person.name}</span>
        <span className="line-clamp-1 text-[11.5px] text-ink-subtle">
          {person.role ? `${t(person.role)} · ${shared}` : shared}
        </span>
      </div>
    </button>
  );
}
