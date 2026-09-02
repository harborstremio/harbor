import { useEffect, useMemo, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { useT } from "@/lib/i18n";
import { useScrollMemory, useView } from "@/lib/view";
import {
  fetchRankManifest,
  type HarborRankExplanation,
  type PeopleDept,
  type PersonRankEntry,
  type RankSource,
} from "@/lib/harbor-rank";
import { isHarborExplanation, usePeopleRankings } from "@/lib/people-rankings";
import { PeopleSourceSwitch } from "./people/people-source-switch";
import { PeopleFilterBar } from "./people/people-filter-bar";
import { PeopleRankList } from "./people/people-rank-list";
import { PeopleHero } from "./people/people-hero";
import { PeopleJumpIndex, presentBands } from "./people/people-tier-band";
import { HowHarborRankWorks } from "./people/how-harbor-rank-works";

type Country = {
  iso: string;
  name: string;
  code?: string | null;
  depts?: Partial<Record<PeopleDept, number>>;
  file?: boolean;
  enough?: boolean;
};
type Person = HarborRankExplanation | PersonRankEntry;

type PeopleInit = {
  source?: RankSource;
  dept?: PeopleDept;
  focusSource?: boolean;
  nonce: number;
} | null;

function heroHasArt(person: Person, source: RankSource): boolean {
  if (source === "harbor") return true;
  if (person.profilePath) return true;
  return "knownFor" in person && (person.knownFor?.length ?? 0) > 0;
}

export function PeopleView({ init }: { init: PeopleInit }) {
  const t = useT();
  const { openPerson, openMeta, openSettings } = useView();
  const scrollRef = useRef<HTMLElement>(null);

  const [source, setSource] = useState<RankSource>(init?.source ?? "harbor");
  const [dept, setDept] = useState<PeopleDept>(init?.dept ?? "Acting");
  const [country, setCountry] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [sources, setSources] = useState<RankSource[] | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [solid, setSolid] = useState(false);

  useScrollMemory("people", scrollRef);

  useEffect(() => {
    let cancelled = false;
    fetchRankManifest().then((m) => {
      if (cancelled || !m) return;
      if (m.countries) setCountries(m.countries);
      if (Array.isArray(m.sources) && m.sources.length > 0) setSources(m.sources);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!init) return;
    if (init.source) setSource(init.source);
    if (init.dept) setDept(init.dept);
    if (init.focusSource) {
      const el = scrollRef.current;
      el?.scrollTo({ top: 0, behavior: "auto" });
      requestAnimationFrame(() => el?.scrollTo({ top: 0, behavior: "auto" }));
    }
  }, [init?.nonce]);

  useEffect(() => {
    setExpandedId(null);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [source, dept, country, genre]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setSolid(el.scrollTop > 4);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const countryEntry = useMemo(
    () => (country ? countries.find((c) => c.iso === country) : undefined),
    [countries, country],
  );
  const serverCountry = countryEntry?.file && countryEntry.code ? countryEntry.code.toLowerCase() : null;
  const { status, people } = usePeopleRankings({
    source,
    dept,
    country: source === "harbor" ? serverCountry : null,
    nonce: reloadNonce,
  });

  const filtered = useMemo<Person[]>(() => {
    const q = query.trim().toLowerCase();
    const all = people as Person[];
    if (!q && !genre && !country) return all;
    let base = all.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (country && !serverCountry && p.country !== country) return false;
      if (genre) {
        if (p.genreScores) return (p.genreScores[genre] ?? 0) > 0;
        return (p.genres ?? []).includes(genre);
      }
      return true;
    });
    if (genre) {
      base = [...base].sort((a, b) => (b.genreScores?.[genre] ?? 0) - (a.genreScores?.[genre] ?? 0));
    }
    return base.map((p, i) => ({ ...p, rank: i + 1 }));
  }, [people, query, genre, country]);

  const heroCandidate = filtered[0];
  const heroEligible = (status === "ready" || status === "offline") && query.trim() === "";
  const heroShown = heroEligible && !!heroCandidate && heroHasArt(heroCandidate, source);

  const topScore = useMemo(() => {
    if (source !== "harbor") return null;
    for (const p of filtered) if (isHarborExplanation(p) && p.score !== null) return p.score;
    return null;
  }, [filtered, source]);

  const bands = useMemo(() => {
    const explained = source === "harbor" ? (filtered as HarborRankExplanation[]) : null;
    const rankedAll: Person[] = explained ? explained.filter((p) => p.score !== null) : filtered;
    const body = heroShown && heroCandidate ? rankedAll.filter((p) => p.id !== heroCandidate.id) : rankedAll;
    return presentBands(body.map((p) => p.rank));
  }, [filtered, source, heroShown, heroCandidate]);

  return (
    <main ref={scrollRef} className="absolute inset-0 z-40 overflow-y-auto bg-canvas">
      <div className="relative isolate">
        {heroShown && heroCandidate ? (
          <>
            <h1 className="sr-only">{t("Top People")}</h1>
            <PeopleHero
              person={heroCandidate}
              source={source}
              total={filtered.length}
              onOpenPerson={openPerson}
              onOpenMeta={openMeta}
              onExplain={() => setExplainOpen(true)}
            />
          </>
        ) : (
          <header className="flex flex-col justify-end px-12 pb-6 pt-28">
            <h1 className="font-display text-[76px] font-medium leading-[0.95] tracking-tight text-ink">
              {t("Top People")}
            </h1>
          </header>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3 px-12">
          <PeopleSourceSwitch
            source={source}
            sources={sources}
            onSource={setSource}
            onExplain={() => setExplainOpen(true)}
          />
          <PeopleJumpIndex bands={bands} scrollRef={scrollRef} />
        </div>

        <div className="px-12 pb-6 pt-6">
          <PeopleRankList
            key={`${source}:${dept}:${country ?? "all"}:${genre ?? "all"}`}
            status={status}
            people={filtered}
            source={source}
            topScore={topScore}
            heroId={heroShown && heroCandidate ? heroCandidate.id : null}
            heroEligible={heroEligible}
            expandedId={expandedId}
            onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
            onOpenPerson={openPerson}
            onOpenMeta={openMeta}
            onClearFilters={() => {
              setQuery("");
              setCountry(null);
              setGenre(null);
            }}
            onOpenSettings={() => openSettings("account")}
            onRetry={() => setReloadNonce((n) => n + 1)}
          />
        </div>

        <div className="sticky bottom-0 z-30 px-12 pb-4 pt-3">
          <div
            className={`rounded-2xl px-5 transition-colors duration-250 ease-out motion-reduce:transition-none ${
              solid ? "bg-canvas/95 shadow-[0_-8px_28px_-16px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft backdrop-blur" : "bg-transparent"
            }`}
          >
            <PeopleFilterBar
              dept={dept}
              onDept={setDept}
              country={country}
              onCountry={setCountry}
              genre={genre}
              onGenre={setGenre}
              query={query}
              onQuery={setQuery}
              countries={countries}
              resultCount={query.trim() || genre || country ? { shown: filtered.length, total: people.length } : null}
            />
          </div>
        </div>
      </div>

      <HowHarborRankWorks open={explainOpen} onClose={() => setExplainOpen(false)} />
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}
