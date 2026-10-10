import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { PickCard } from "@/components/pick-card";
import { Row, usePosterRow } from "@/components/row";
import type { Meta } from "@/lib/cinemeta";
import { type Spotlight } from "@/lib/feed/genre-spotlights";
import { useT } from "@/lib/i18n";
import { useClaimSeenIds } from "@/lib/feed/seen-ids";
import { genreEquivalents } from "@/lib/feed/tags";
import {
  creditToMeta,
  tmdbPerson,
  tmdbPersonIdByName,
  type PersonCredit,
} from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { SPOTLIGHT_SELF_TIMEOUT_MS, SpotlightGateContext } from "./spotlight-gate";

const DIRECTOR_JOBS = new Set(["Director"]);
const WRITER_JOBS = new Set(["Writer", "Screenplay", "Story", "Teleplay"]);

function spotlightCredits(
  person: { cast: PersonCredit[]; crew: PersonCredit[] },
  spotlight: Spotlight,
  genreId: number,
): PersonCredit[] {
  const dept = spotlight.dept;
  const jobs = dept === "Directing" ? DIRECTOR_JOBS : dept === "Writing" ? WRITER_JOBS : null;
  const pool = jobs
    ? person.crew.filter((c) => jobs.has(c.job ?? ""))
    : spotlight.presenter
      ? person.cast
      : person.cast.filter((c) => !isCameo(c));

  const related = spotlight.relatedGenreIds ?? [];
  const accepted = new Set<number>([
    ...genreEquivalents(genreId),
    ...related.flatMap(genreEquivalents),
  ]);
  const matched = pool.filter(
    (c) =>
      !!c.poster &&
      (spotlight.presenter || c.mediaType !== "tv" || (c.episodeCount ?? 0) >= 2) &&
      (c.genreIds ?? []).some((id) => accepted.has(id)),
  );

  const seen = new Set<number>();
  const unique: PersonCredit[] = [];
  for (const c of matched) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    unique.push(c);
  }

  unique.sort((a, b) => {
    const sa =
      (a.voteAverage || 0) *
      Math.log2(2 + (a.voteCount || 0)) *
      (0.7 + jitter(`${spotlight.name}:${a.id}`) * 0.6);
    const sb =
      (b.voteAverage || 0) *
      Math.log2(2 + (b.voteCount || 0)) *
      (0.7 + jitter(`${spotlight.name}:${b.id}`) * 0.6);
    return sb - sa;
  });

  return unique;
}

function jitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function isCameo(c: PersonCredit): boolean {
  const ch = (c.character ?? "").toLowerCase().trim();
  if (!ch) return false;
  if (ch.includes("(uncredited)") || ch.includes("archive footage") || ch.includes("archival footage")) return true;
  if (ch === "self" || ch === "himself" || ch === "herself" || ch === "themselves") return true;
  if (ch.startsWith("self ") || ch.startsWith("himself ") || ch.startsWith("herself ")) return true;
  return false;
}

export function SpotlightSection({
  spotlight,
  genreId,
}: {
  spotlight: Spotlight;
  genreId: number;
}) {
  const t = useT();
  const posterRow = usePosterRow();
  const { settings } = useSettings();
  const { openPerson } = useView();
  const claim = useClaimSeenIds(`spotlight:${spotlight.name}`);
  const { markDone } = useContext(SpotlightGateContext);
  const [personId, setPersonId] = useState<number | null>(null);
  const [personLookupDone, setPersonLookupDone] = useState(false);
  const [items, setItems] = useState<Meta[] | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const doneCalledRef = useRef(false);
  const reportDone = useCallback(() => {
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;
    markDone();
  }, [markDone]);

  useEffect(() => {
    doneCalledRef.current = false;
    const safety = window.setTimeout(reportDone, SPOTLIGHT_SELF_TIMEOUT_MS);
    return () => window.clearTimeout(safety);
  }, [spotlight, genreId, reportDone]);

  useEffect(() => {
    let cancelled = false;
    setPersonId(null);
    setPersonLookupDone(false);
    if (!settings.tmdbKey) {
      setPersonLookupDone(true);
      return;
    }
    tmdbPersonIdByName(settings.tmdbKey, spotlight.query ?? spotlight.name, spotlight.dept)
      .then((id) => {
        if (cancelled) return;
        setPersonId(id);
        setPersonLookupDone(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPersonLookupDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey, spotlight.name, spotlight.query, spotlight.dept]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    if (!settings.tmdbKey) {
      setItems([]);
      reportDone();
      return;
    }
    if (!personLookupDone) return;
    if (personId == null) {
      setItems([]);
      reportDone();
      return;
    }
    tmdbPerson(settings.tmdbKey, personId)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          setItems([]);
          reportDone();
          return;
        }
        setProfileUrl(
          p.profilePath ? `https://image.tmdb.org/t/p/h632${p.profilePath}` : null,
        );
        const credits = spotlightCredits(p, spotlight, genreId);
        const metas = credits.map(creditToMeta);
        claim(metas);
        setItems(metas);
        reportDone();
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        reportDone();
      });
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey, personId, personLookupDone, genreId, spotlight, claim, reportDone]);

  if (items && items.length === 0) return null;

  const title = (
    <span className="flex flex-col">
      <span className="text-[20px] font-medium tracking-tight text-ink">
        {t("{name}'s {sub}", { name: spotlight.name, sub: t(spotlight.sub) })}
      </span>
      <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
        {t("Spotlight")}
      </span>
    </span>
  );

  return (
    <Row {...posterRow} title={title}>
      <button
        type="button"
        onClick={() => personId != null && openPerson(personId)}
        disabled={personId == null}
        style={{ gridColumn: "span 2" }}
        className="harbor-spot-card group relative h-[var(--row-poster-height,216px)] w-full min-w-[280px] shrink-0 overflow-hidden rounded-xl border border-edge-soft text-start transition-transform duration-300 hover:-translate-y-0.5"
      >
        {profileUrl ? (
          <img
            src={profileUrl}
            alt={spotlight.name}
            loading="lazy"
            decoding="async"
            className="harbor-spot-art absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "center 22%" }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-elevated to-canvas" />
        )}
        <div
          aria-hidden
          className="harbor-spot-scrim absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, oklch(0.10 0.02 260) 0%, oklch(0.10 0.02 260 / 0.65) 36%, transparent 78%)",
          }}
        />
        <div className="absolute inset-x-4 bottom-3.5 flex flex-col gap-1">
          <span className="harbor-spot-sub text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            {t(spotlight.sub)}
          </span>
          <span className="harbor-spot-name font-display text-[26px] font-medium leading-[0.98] tracking-tight text-ink drop-shadow-[0_2px_18px_rgba(0,0,0,0.4)]">
            {spotlight.name}
          </span>
        </div>
      </button>
      {items
        ? items.map((m) => (
            <PickCard key={m.id} meta={m} />
          ))
        : Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`${posterRow.shape === "landscape" ? "aspect-[16/9]" : "aspect-[2/3]"} animate-pulse rounded-xl bg-elevated/40`} />
          ))}
    </Row>
  );
}
