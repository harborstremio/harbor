import { useState } from "react";

const IMG = "https://image.tmdb.org/t/p/w185";

export type XrayPerson = { id: number; name: string; sub?: string; profilePath: string | null };

function photoOf(p: XrayPerson): string | undefined {
  if (!p.profilePath) return undefined;
  return p.profilePath.startsWith("http") ? p.profilePath : `${IMG}${p.profilePath}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function Photo({ person, className }: { person: XrayPerson; className: string }) {
  const [ok, setOk] = useState(true);
  const src = photoOf(person);
  if (src && ok) {
    return <img src={src} alt="" loading="lazy" draggable={false} onError={() => setOk(false)} className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} flex items-center justify-center bg-white/[0.06] text-white/40`}>
      <span className="text-[15px] font-semibold tracking-wide">{initials(person.name)}</span>
    </div>
  );
}

export function XrayRailCard({ person }: { person: XrayPerson }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-1.5 py-1.5">
      <Photo person={person} className="h-12 w-12 shrink-0 rounded-[11px] ring-1 ring-white/12" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13.5px] font-semibold leading-tight text-white">{person.name}</span>
        {person.sub && <span className="truncate text-[12px] leading-tight text-white/55">{person.sub}</span>}
      </div>
    </div>
  );
}

export function XrayTile({ person }: { person: XrayPerson }) {
  return (
    <div className="group flex w-full flex-col gap-2.5">
      <div className="relative aspect-square overflow-hidden rounded-[16px] bg-white/[0.04] ring-1 ring-white/10 transition-shadow duration-200 ease-out group-hover:shadow-[0_20px_44px_-20px_rgba(0,0,0,0.9)] group-hover:ring-white/25">
        <Photo
          person={person}
          className="h-full w-full transition-transform duration-[450ms] ease-out group-hover:scale-[1.07] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="truncate text-[14px] font-semibold leading-tight text-white transition-colors group-hover:text-white">{person.name}</span>
        {person.sub && <span className="line-clamp-1 text-[12.5px] leading-tight text-white/55">{person.sub}</span>}
      </div>
    </div>
  );
}
