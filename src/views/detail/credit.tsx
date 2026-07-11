import type { PersonRef } from "@/lib/providers/tmdb";
import { useView } from "@/lib/view";

export function Credit({ label, people }: { label: string; people: PersonRef[] }) {
  const { openPerson } = useView();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">{label}</span>
      <span className="text-[15px] leading-snug text-ink">
        {people.map((p, i) => {
          const resolved = p.id > 0;
          return (
            <span key={`${p.id}-${i}`}>
              {resolved ? (
                <button
                  data-person-card
                  onClick={() => openPerson(p.id)}
                  className="cursor-pointer rounded text-ink underline-offset-4 transition-colors hover:text-accent hover:underline"
                >
                  {p.name}
                </button>
              ) : (
                <span className="text-ink">{p.name}</span>
              )}
              {i < people.length - 1 && ", "}
            </span>
          );
        })}
      </span>
    </div>
  );
}
