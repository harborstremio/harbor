import { Poster } from "@/components/poster";
import { Row } from "@/components/row";
import type { AwardPerson } from "@/lib/awards/award-page";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

export function PeopleRail({
  title,
  people,
  loading,
  tint,
}: {
  title: string;
  people: AwardPerson[];
  loading: boolean;
  tint: string;
}) {
  if (!loading && people.length === 0) return null;
  const skeleton = loading && people.length === 0;
  return (
    <Row title={title} min={148}>
      {skeleton
        ? Array.from({ length: 8 }).map((_, i) => <PersonSkeleton key={i} />)
        : people.map((p) => <PersonCard key={p.id} person={p} tint={tint} />)}
    </Row>
  );
}

function PersonCard({ person, tint }: { person: AwardPerson; tint: string }) {
  const t = useT();
  const { openPerson } = useView();
  return (
    <button onClick={() => openPerson(person.id)} className="group flex w-full min-w-0 flex-col gap-2.5 text-start">
      <div className="relative transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:-translate-y-1.5">
        <Poster
          src={person.photo ?? undefined}
          seed={String(person.id)}
          ratio="portrait"
          className="rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] transition-[box-shadow] duration-300 group-hover:shadow-[0_22px_44px_-14px_rgba(0,0,0,0.6)]"
        />
        {person.wins > 1 && (
          <span
            className="absolute end-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-canvas shadow-sm"
            style={{ backgroundColor: tint }}
            title={t("{n} wins", { n: person.wins })}
          >
            {person.wins}×
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="line-clamp-1 text-[13.5px] font-semibold text-ink">{person.name}</span>
        {person.work && <span className="line-clamp-1 text-[11.5px] text-ink-subtle">{person.work}</span>}
      </div>
    </button>
  );
}

function PersonSkeleton() {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="aspect-[2/3] animate-pulse rounded-xl bg-elevated/40" />
      <div className="flex flex-col gap-1.5">
        <div className="h-3 w-3/4 rounded bg-elevated/35" />
        <div className="h-2.5 w-1/2 rounded bg-elevated/25" />
      </div>
    </div>
  );
}
