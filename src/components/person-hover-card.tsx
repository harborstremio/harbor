import { AwardLogo, laurelColorFor } from "@/components/icons/award-logo";
import { Laurel } from "@/components/icons/laurel";
import { IMG } from "@/lib/providers/tmdb/tmdb-client";
import { tmdbPerson, tmdbPersonCached, type PersonCredit, type PersonDetail } from "@/lib/providers/tmdb/tmdb-people";
import { awardSummary, useAwards } from "@/lib/providers/wikidata";
import { useSettings } from "@/lib/settings";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const CARD_W = 320;
const CARD_H = 260;

export function PersonHoverCard({
  personId,
  anchor,
  onEnter,
  onLeave,
}: {
  personId: number;
  anchor: DOMRect;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const { settings } = useSettings();
  const [person, setPerson] = useState<PersonDetail | null>(() => tmdbPersonCached(personId) ?? null);

  useEffect(() => {
    if (tmdbPersonCached(personId)) {
      setPerson(tmdbPersonCached(personId)!);
      return;
    }
    let cancelled = false;
    tmdbPerson(settings.tmdbKey, personId)
      .then((p) => !cancelled && setPerson(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [personId, settings.tmdbKey]);

  const liveAwards = useAwards(person?.imdbId ?? undefined);
  const chips = useMemo(() => awardSummary(liveAwards ?? []).slice(0, 4), [liveAwards]);
  const knownFor = useMemo(() => topKnownFor(person), [person]);

  const gap = 10;
  const below = anchor.bottom + gap + CARD_H < window.innerHeight;
  const top = below ? anchor.bottom + gap : anchor.top - gap - CARD_H;
  const left = Math.max(12, Math.min(anchor.left - 8, window.innerWidth - CARD_W - 12));

  const photo = person?.profilePath ? `${IMG}/w185${person.profilePath}` : null;

  return createPortal(
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ left, top, width: CARD_W }}
      className="fixed z-[150] overflow-hidden rounded-2xl border border-edge bg-elevated/95 shadow-[0_24px_64px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-popover-in"
    >
      <div className="flex gap-3.5 p-4">
        {photo ? (
          <img
            src={photo}
            alt=""
            className="h-[68px] w-[68px] shrink-0 rounded-xl object-cover object-top ring-1 ring-edge-soft"
          />
        ) : (
          <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-xl bg-raised text-[20px] font-semibold text-ink-subtle ring-1 ring-edge-soft">
            {initials(person?.name ?? "")}
          </div>
        )}
        <div className="flex min-w-0 flex-col justify-center gap-0.5">
          <span className="truncate text-[15px] font-semibold leading-tight text-ink">{person?.name ?? "…"}</span>
          {person?.knownForDepartment && (
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
              {roleLabel(person.knownForDepartment)}
            </span>
          )}
          {person && <span className="text-[12px] text-ink-subtle">{lifeLine(person)}</span>}
        </div>
      </div>

      {person?.biography?.trim() && (
        <p className="px-4 pb-1 text-[12.5px] leading-relaxed text-ink-muted line-clamp-3">
          {firstSentences(person.biography)}
        </p>
      )}

      {knownFor.length > 0 && (
        <div className="flex items-baseline gap-1.5 px-4 pt-2 pb-1 text-[11.5px]">
          <span className="shrink-0 font-medium uppercase tracking-[0.14em] text-ink-subtle">Known for</span>
          <span className="truncate text-ink-muted">{knownFor.join(" · ")}</span>
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-edge-soft/60 px-4 py-2.5">
          {chips.map((c) => {
            const tint = laurelColorFor(c.type);
            return (
              <span
                key={c.type}
                className="flex items-center gap-1 text-[11px] font-semibold text-ink-muted"
                style={tint ? { color: tint } : undefined}
              >
                <Laurel size={26}>
                  <AwardLogo type={c.type} size={12} />
                </Laurel>
                {c.wins > 0 ? `${c.wins}` : `${c.nominations}`}
              </span>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}

function topKnownFor(person: PersonDetail | null): string[] {
  if (!person) return [];
  const all: PersonCredit[] = [...person.cast, ...person.crew];
  const seen = new Set<string>();
  return all
    .filter((c) => c.title && !seen.has(c.title) && (seen.add(c.title), true))
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, 3)
    .map((c) => c.title);
}

function roleLabel(dept: string): string {
  const d = dept.toLowerCase();
  if (d === "acting") return "Actor";
  if (d === "directing") return "Director";
  if (d === "writing") return "Writer";
  if (d === "production") return "Producer";
  if (d === "sound") return "Composer";
  if (d === "camera") return "Cinematographer";
  return dept;
}

function lifeLine(person: PersonDetail): string {
  const birthYear = person.birthday ? Number(person.birthday.slice(0, 4)) : null;
  const place = person.placeOfBirth?.split(",").pop()?.trim();
  if (birthYear && person.deathday) {
    return `${birthYear} – ${Number(person.deathday.slice(0, 4))}`;
  }
  const parts: string[] = [];
  if (birthYear) parts.push(`Born ${birthYear}`);
  if (place) parts.push(place);
  return parts.join(" · ");
}

function firstSentences(bio: string): string {
  const clean = bio.replace(/\s+/g, " ").trim();
  const cut = clean.slice(0, 240);
  return cut.length < clean.length ? `${cut.replace(/\s+\S*$/, "")}…` : clean;
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
