import { useState } from "react";
import type { CastEntry } from "@/lib/providers/tmdb/tmdb-details";

const HEADSHOT = "https://image.tmdb.org/t/p/w185";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

function CastFace({ person }: { person: CastEntry }) {
  const [failed, setFailed] = useState(false);
  const showImage = !!person.profilePath && !failed;
  return (
    <li className="flex w-[54px] shrink-0 flex-col items-center gap-1">
      <span className="flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-full bg-canvas ring-1 ring-edge-soft">
        {showImage ? (
          <img
            src={`${HEADSHOT}${person.profilePath}`}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="text-[12px] font-semibold text-ink-subtle">{initials(person.name)}</span>
        )}
      </span>
      <span
        dir="auto"
        className="line-clamp-2 text-center text-[10px] leading-[13px] text-ink-muted"
        title={person.character ? `${person.name} · ${person.character}` : person.name}
      >
        {person.name}
      </span>
    </li>
  );
}

export function ProgramCastRow({ cast }: { cast: CastEntry[] }) {
  if (!cast.length) return null;
  return (
    <ul className="flex list-none gap-2 overflow-hidden p-0">
      {cast.slice(0, 5).map((p) => (
        <CastFace key={p.id} person={p} />
      ))}
    </ul>
  );
}
