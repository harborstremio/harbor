import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchRankList, peekRankSnapshot, type HarborRankExplanation } from "@/lib/harbor-rank";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

export function TopPeopleCta({ title }: { title?: string }) {
  const { openPeople } = useView();
  const t = useT();
  const [people, setPeople] = useState<HarborRankExplanation[]>([]);

  useEffect(() => {
    let cancelled = false;
    const snap = peekRankSnapshot("harbor", "Acting", null);
    if (snap && snap.source === "harbor") {
      setPeople(snap.list.filter((p) => p.profilePath).slice(0, 6));
    }
    fetchRankList("harbor", "Acting", null).then((r) => {
      if (cancelled || !r || r.source !== "harbor") return;
      setPeople(r.list.filter((p) => p.profilePath).slice(0, 6));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const top = people.slice(0, 6);

  return (
    <section>
      <button type="button" onClick={() => openPeople({ focusSource: true })} className="group block w-full text-start">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-[28px] font-medium leading-tight tracking-tight text-ink">
            {title ?? t("Top People")}
          </h2>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors group-hover:text-ink motion-reduce:transition-none">
            {t("The all-time greats")}
            <ArrowRight
              size={16}
              className="dir-icon transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 motion-reduce:transition-none"
            />
          </span>
        </div>

        {top.length > 0 ? (
          <ol className="grid grid-cols-4 gap-2.5 md:grid-cols-6">
            {top.map((p, i) => (
              <li
                key={p.id}
                className="relative aspect-[3/4] overflow-hidden rounded-xl bg-elevated/60 ring-1 ring-edge-soft"
              >
                <img
                  src={`https://image.tmdb.org/t/p/w342${p.profilePath}`}
                  alt={p.name}
                  loading="lazy"
                  draggable={false}
                  style={{ transitionDelay: `${i * 45}ms` }}
                  className="absolute inset-0 h-full w-full object-cover object-top brightness-[0.8] saturate-[0.9] transition-[filter] duration-[520ms] ease-out group-hover:brightness-100 group-hover:saturate-100 motion-reduce:!brightness-100 motion-reduce:!saturate-100 motion-reduce:transition-none"
                />
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-1/2"
                  style={{
                    background:
                      "linear-gradient(to top, var(--color-canvas) 6%, color-mix(in oklch, var(--color-canvas), transparent 40%) 42%, transparent)",
                  }}
                />
                <span className="absolute start-1.5 top-0.5 font-display text-[30px] font-semibold leading-none text-white/95 [text-shadow:0_2px_10px_rgba(0,0,0,0.85)]">
                  {i + 1}
                </span>
                <span className="absolute inset-x-1.5 bottom-1.5 truncate text-[12px] font-semibold text-ink [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
                  {p.name}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex h-[120px] items-center justify-center rounded-xl border border-edge-soft bg-canvas text-[15px] text-ink-muted">
            {t("Explore the all-time greatest actors, directors and more")}
          </div>
        )}
      </button>
    </section>
  );
}
