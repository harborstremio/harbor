import { Poster } from "@/components/poster";
import type { CastEntry, PersonRef, TmdbDetail } from "@/lib/providers/tmdb";
import { useT } from "@/lib/i18n";
import { HIDE_SCROLL } from "./data";
import { dedupeCast } from "./anime-data";
import { Line, SectionTitle } from "./ui";

type OnPerson = (id: number, name: string) => void;

export function CrewSection({ detail, onPerson }: { detail: TmdbDetail; onPerson?: OnPerson }) {
  const t = useT();
  const groups: Array<{ label: string; people: PersonRef[] }> = [];
  if (detail.directors.length > 0)
    groups.push({
      label: detail.directors.length === 1 ? t("Director") : t("Directors"),
      people: detail.directors,
    });
  if (detail.creators.length > 0)
    groups.push({
      label: detail.creators.length === 1 ? t("Creator") : t("Creators"),
      people: detail.creators,
    });
  if (detail.writers.length > 0)
    groups.push({
      label: detail.writers.length === 1 ? t("Writer") : t("Writers"),
      people: detail.writers.slice(0, 4),
    });
  if (groups.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t("Crew")}</SectionTitle>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {groups.map((g) => (
          <div key={g.label} className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              {g.label}
            </span>
            <span className="text-[13.5px] leading-snug text-ink">
              {g.people.map((p, i) => (
                <span key={`${p.id}-${i}`}>
                  <PersonName person={p} onPerson={onPerson} />
                  {i < g.people.length - 1 && ", "}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PersonName({ person, onPerson }: { person: PersonRef; onPerson?: OnPerson }) {
  if (!onPerson || person.id <= 0) return <span className="text-ink">{person.name}</span>;
  return (
    <button
      type="button"
      onClick={() => onPerson(person.id, person.name)}
      className="rounded text-ink underline decoration-edge-soft underline-offset-[3px] transition-colors active:text-accent active:decoration-accent motion-reduce:transition-none"
    >
      {person.name}
    </button>
  );
}

export function CastRow({ cast, onPerson }: { cast: CastEntry[]; onPerson?: OnPerson }) {
  const t = useT();
  const shown = dedupeCast(cast).slice(0, 20);
  return (
    <section className="flex flex-col gap-3.5">
      <SectionTitle>{t("Cast")}</SectionTitle>
      <div
        className={`-mx-5 flex snap-x snap-proximity gap-3.5 overflow-x-auto px-5 ${HIDE_SCROLL}`}
      >
        {shown.map((c, i) => (
          <CastChip key={`${c.id}-${i}`} cast={c} onPerson={onPerson} />
        ))}
      </div>
    </section>
  );
}

function CastChip({ cast, onPerson }: { cast: CastEntry; onPerson?: OnPerson }) {
  const photo = cast.profilePath
    ? cast.profilePath.startsWith("http")
      ? cast.profilePath
      : `https://image.tmdb.org/t/p/w185${cast.profilePath}`
    : undefined;
  const linkable = !!onPerson && cast.id > 0;
  const Wrap: "button" | "div" = linkable ? "button" : "div";
  const wrapProps = linkable
    ? { onClick: () => onPerson!(cast.id, cast.name), type: "button" as const }
    : {};
  return (
    <Wrap
      {...wrapProps}
      className={`flex w-[88px] shrink-0 snap-start flex-col gap-2 text-start ${
        linkable ? "transition-transform active:scale-[0.97] motion-reduce:transition-none" : ""
      }`}
    >
      <Poster src={photo} seed={String(cast.id)} ratio="portrait" lazy className="rounded-xl" />
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-1 text-[12.5px] font-medium text-ink">{cast.name}</p>
        {cast.character && (
          <p className="line-clamp-1 text-[11.5px] leading-tight text-ink-subtle">
            {cast.character}
          </p>
        )}
      </div>
    </Wrap>
  );
}

export function CastSkeleton() {
  const t = useT();
  return (
    <section className="flex flex-col gap-3.5">
      <SectionTitle>{t("Cast")}</SectionTitle>
      <div className={`-mx-5 flex gap-3.5 overflow-x-auto px-5 ${HIDE_SCROLL}`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex w-[88px] shrink-0 flex-col gap-2">
            <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-elevated/70" />
            <Line className="w-3/4" />
          </div>
        ))}
      </div>
    </section>
  );
}
