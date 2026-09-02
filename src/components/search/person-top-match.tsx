import { ArrowRight } from "lucide-react";
import type { SearchPerson } from "@/lib/search";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

export function matchPersonForQuery(
  people: SearchPerson[] | undefined,
  query: string,
): SearchPerson | null {
  const p = people?.[0];
  if (!p || !p.profile) return null;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const q = norm(query);
  const n = norm(p.name);
  if (q.length < 3 || !n) return null;
  return n === q || n.startsWith(q) || q.startsWith(n) ? p : null;
}

export function PersonTopMatch({
  person,
  onClose,
  onOpenPerson,
}: {
  person: SearchPerson;
  onClose: () => void;
  onOpenPerson?: (p: SearchPerson) => void;
}) {
  const { openPerson } = useView();
  const t = useT();
  const open = () => {
    if (onOpenPerson) {
      onOpenPerson(person);
      return;
    }
    onClose();
    openPerson(person.id);
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-edge-soft bg-elevated">
      <button
        type="button"
        onClick={open}
        aria-label={t("Explore {name}", { name: person.name })}
        className="group flex w-full items-center gap-5 p-4 text-start transition-colors duration-150 hover:bg-raised active:scale-[0.997]"
      >
        <div className="h-[112px] w-[112px] shrink-0 overflow-hidden rounded-full ring-1 ring-edge-soft">
          <img
            src={`https://image.tmdb.org/t/p/h632${person.profile}`}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent">
            {t("Top match")}
          </span>
          <h2
            className="mt-1 truncate text-[clamp(22px,2.2vw,30px)] font-medium leading-[1.1] tracking-tight text-ink"
            style={{ fontFamily: "var(--font-display, 'Fraunces')" }}
          >
            {person.name}
          </h2>
          {person.knownFor && (
            <p className="mt-1.5 truncate text-[13px] text-ink-muted">{person.knownFor}</p>
          )}
        </div>
        <div className="me-1 inline-flex h-10 shrink-0 items-center gap-2 self-center rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-opacity group-hover:opacity-90">
          {t("Explore")}
          <ArrowRight size={14} strokeWidth={2.4} className="dir-icon" />
        </div>
      </button>
    </section>
  );
}
