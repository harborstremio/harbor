import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { IMG } from "@/lib/providers/tmdb/tmdb-client";
import { creditToMeta, tmdbPerson, tmdbPersonCached, type PersonDetail } from "@/lib/providers/tmdb/tmdb-people";
import { dedupe, isCameoOrGuest, notableScore } from "@/views/person/person-utils";
import { Loader2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { PosterRail, RailSection, RailSkeleton } from "./rails";

function fmtYear(d: string | null): string {
  return d?.slice(0, 4) ?? "";
}

export function PersonPanel({
  personId,
  name,
  tmdbKey,
  onOpenTitle,
}: {
  personId: number;
  name: string;
  tmdbKey: string | null;
  onOpenTitle: (m: Meta) => void;
}) {
  const t = useT();
  const [person, setPerson] = useState<PersonDetail | null>(() => tmdbPersonCached(personId) ?? null);
  const [loading, setLoading] = useState(!person);
  const [expanded, setExpanded] = useState(false);
  const bioRef = useRef<HTMLParagraphElement>(null);
  const [bioClamped, setBioClamped] = useState(false);

  useEffect(() => {
    if (!tmdbKey || person) return;
    let cancelled = false;
    setLoading(true);
    tmdbPerson(tmdbKey, personId)
      .then((p) => {
        if (!cancelled) setPerson(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tmdbKey, personId, person]);

  const displayName = person?.name || name;
  const photo = person?.profilePath ? `${IMG}/w342${person.profilePath}` : null;
  const facts = [
    person?.knownForDepartment,
    fmtYear(person?.birthday ?? null) && `${t("Born")} ${fmtYear(person?.birthday ?? null)}`,
    person?.placeOfBirth,
  ].filter(Boolean) as string[];
  const bio = person?.biography?.trim() ?? "";

  const sortedCast = useMemo(
    () => (person ? dedupe(person.cast).sort((a, b) => b.popularity - a.popularity) : []),
    [person],
  );
  const knownFor = useMemo(
    () =>
      sortedCast
        .filter((c) => !isCameoOrGuest(c) && c.poster)
        .sort((a, b) => notableScore(b) - notableScore(a))
        .slice(0, 20)
        .map(creditToMeta),
    [sortedCast],
  );
  const movies = useMemo(
    () => sortedCast.filter((c) => c.mediaType === "movie" && c.poster).map(creditToMeta),
    [sortedCast],
  );
  const shows = useMemo(
    () => sortedCast.filter((c) => c.mediaType === "tv" && c.poster).map(creditToMeta),
    [sortedCast],
  );

  useLayoutEffect(() => {
    const el = bioRef.current;
    if (!el || expanded) return;
    const measure = () => setBioClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bio, expanded]);

  return (
    <div className="flex flex-col gap-7 px-6 pb-8 pt-1 sm:px-8">
      <div className="flex gap-5">
        <div className="h-48 w-32 shrink-0 overflow-hidden rounded-xl bg-white/[0.06] ring-1 ring-white/12 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8)]">
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[30px] font-semibold text-white/40">
              {displayName.trim()[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="text-[26px] font-semibold leading-[1.1] text-white">{displayName}</h2>
          {facts.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-medium text-white/60">
              {facts.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-2.5">
                  {i > 0 && <span className="text-white/30">·</span>}
                  {f}
                </span>
              ))}
            </div>
          )}
          {bio && (
            <div className="pt-0.5">
              <p ref={bioRef} className={`text-[14px] leading-relaxed text-white/72 ${expanded ? "" : "line-clamp-4"}`}>
                {bio}
              </p>
              {bioClamped && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 text-[12.5px] font-semibold text-white/55 transition-colors hover:text-white/90"
                >
                  {expanded ? t("Show less") : t("Read more")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {loading && knownFor.length === 0 ? (
        <RailSection label={t("Known For")}>
          <RailSkeleton />
        </RailSection>
      ) : (
        <>
          {knownFor.length > 0 && (
            <RailSection label={t("Known For")}>
              <PosterRail items={knownFor} onOpen={onOpenTitle} />
            </RailSection>
          )}
          {movies.length > 0 && (
            <RailSection label={t("Movies")} count={movies.length}>
              <PosterRail items={movies} onOpen={onOpenTitle} />
            </RailSection>
          )}
          {shows.length > 0 && (
            <RailSection label={t("Shows")} count={shows.length}>
              <PosterRail items={shows} onOpen={onOpenTitle} />
            </RailSection>
          )}
          {!loading && knownFor.length === 0 && movies.length === 0 && shows.length === 0 && !bio && (
            <p className="px-1 text-[13.5px] text-white/55">{t("No details available for this person.")}</p>
          )}
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-2">
          <Loader2 size={16} className="animate-spin text-white/40" />
        </div>
      )}
    </div>
  );
}
