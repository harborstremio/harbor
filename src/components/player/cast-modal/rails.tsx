import { ImdbIcon } from "@/components/icons/imdb-icon";
import type { Meta } from "@/lib/cinemeta";
import { IMG } from "@/lib/providers/tmdb/tmdb-client";
import { useMetaWatched } from "@/lib/watched-flag";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCardImdb } from "./use-card-imdb";
import { useCardPoster } from "./use-card-poster";

export function RailSection({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2 px-1">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">{label}</h3>
        {count != null && count > 0 && <span className="text-[11px] text-white/30">{count}</span>}
      </div>
      {children}
    </section>
  );
}

const RAIL =
  "flex gap-3 overflow-x-auto px-0.5 py-2 [scrollbar-width:none] [scroll-snap-type:x_proximity] [&::-webkit-scrollbar]:hidden";

function ScrollRail({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nudge = (dir: number) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.82, behavior: "smooth" });
  };

  return (
    <div className="group/rail relative">
      <div ref={ref} onScroll={update} className={RAIL}>
        {children}
      </div>
      {canLeft && <RailArrow dir="left" onClick={() => nudge(-1)} />}
      {canRight && <RailArrow dir="right" onClick={() => nudge(1)} />}
    </div>
  );
}

function RailArrow({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  const Icon = dir === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "left" ? "Scroll left" : "Scroll right"}
      className={`absolute top-[42%] z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/75 text-white opacity-0 ring-1 ring-white/15 backdrop-blur-sm transition-opacity duration-150 hover:bg-black/95 group-hover/rail:opacity-100 ${dir === "left" ? "left-0" : "right-0"}`}
    >
      <Icon size={20} strokeWidth={2.5} />
    </button>
  );
}

function profileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${IMG}/w185${path}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export type Person = {
  id: number;
  name: string;
  role: string;
  profilePath: string | null;
};

function PersonCard({ person, onOpen }: { person: Person; onOpen?: (p: Person) => void }) {
  const src = profileUrl(person.profilePath);
  const clickable = !!onOpen && person.id > 0;
  const body = (
    <>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-white/[0.06] ring-1 ring-white/10 transition duration-200 group-hover:ring-white/25 group-hover:brightness-110">
        {src ? (
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[22px] font-semibold text-white/40">
            {initials(person.name)}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="line-clamp-1 text-[12.5px] font-semibold leading-tight text-white/90">{person.name}</span>
        {person.role && <span className="line-clamp-1 text-[11.5px] leading-tight text-white/45">{person.role}</span>}
      </div>
    </>
  );
  const cls =
    "group flex w-[104px] shrink-0 flex-col gap-2 text-start [scroll-snap-align:start]" +
    (clickable ? " cursor-pointer" : " cursor-default");
  return clickable ? (
    <button type="button" onClick={() => onOpen!(person)} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function PeopleRail({ people, onOpen }: { people: Person[]; onOpen?: (p: Person) => void }) {
  return (
    <ScrollRail>
      {people.map((p, i) => (
        <PersonCard key={`${p.id}-${i}`} person={p} onOpen={onOpen} />
      ))}
    </ScrollRail>
  );
}

function PosterCard({ meta, onOpen, grid }: { meta: Meta; onOpen: (m: Meta) => void; grid?: boolean }) {
  const watched = useMetaWatched(meta.id, meta.type);
  const { imdb } = useCardImdb(meta);
  const { src, onError } = useCardPoster(meta);
  return (
    <button
      type="button"
      onClick={() => onOpen(meta)}
      className={`group flex flex-col gap-1.5 text-start ${grid ? "w-full" : "w-[116px] shrink-0 [scroll-snap-align:start]"}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-white/[0.06] ring-1 ring-white/10 transition duration-200 group-hover:scale-[1.04] group-hover:ring-white/25">
        {src ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            onError={onError}
            className={`h-full w-full object-cover ${watched ? "brightness-[0.6]" : ""}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-[12px] font-medium text-white/45">
            {meta.name}
          </div>
        )}
        {imdb ? (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10.5px] font-bold text-white backdrop-blur-sm">
            <ImdbIcon className="h-[11px] w-auto rounded-[2px]" />
            {imdb}
          </span>
        ) : meta.imdbRating ? (
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10.5px] font-bold text-amber-300 backdrop-blur-sm">
            {meta.imdbRating}
          </span>
        ) : null}
        {watched && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/90 text-black ring-1 ring-black/20">
            <Check size={12} strokeWidth={3.2} />
          </span>
        )}
      </div>
      <span className="line-clamp-1 text-[12.5px] font-medium text-white/90">{meta.name}</span>
      {meta.releaseInfo && <span className="text-[11px] text-white/40">{meta.releaseInfo}</span>}
    </button>
  );
}

export function PosterRail({ items, onOpen }: { items: Meta[]; onOpen: (m: Meta) => void }) {
  return (
    <ScrollRail>
      {items.map((m) => (
        <PosterCard key={m.id} meta={m} onOpen={onOpen} />
      ))}
    </ScrollRail>
  );
}

export function PosterGrid({ items, onOpen }: { items: Meta[]; onOpen: (m: Meta) => void }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-5">
      {items.map((m) => (
        <PosterCard key={m.id} meta={m} onOpen={onOpen} grid />
      ))}
    </div>
  );
}

export function RailSkeleton({ portrait }: { portrait?: boolean }) {
  return (
    <div className={RAIL}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={`shrink-0 ${portrait ? "w-[104px]" : "w-[116px]"} flex flex-col gap-2`}>
          <div
            className={`w-full animate-pulse rounded-xl bg-white/[0.07] ${portrait ? "aspect-[3/4]" : "aspect-[2/3]"}`}
          />
          <div className="h-2.5 w-3/4 animate-pulse rounded bg-white/[0.07]" />
        </div>
      ))}
    </div>
  );
}
