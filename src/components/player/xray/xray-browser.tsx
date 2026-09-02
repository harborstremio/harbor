import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { UiIcon } from "@/components/ui-icon";
import type { Meta } from "@/lib/cinemeta";
import type { CrewEntry, TmdbDetail } from "@/lib/providers/tmdb";
import { useT } from "@/lib/i18n";
import { XrayTile, type XrayPerson } from "./xray-actor-card";
import { XrayAbout } from "./xray-about";
import { XrayScene } from "./xray-scene";

type TabId = "in-scene" | "cast" | "crew" | "about";

const CREW_PRIORITY: Record<string, number> = {
  Director: 0,
  Creator: 0,
  Writer: 1,
  Screenplay: 1,
  Story: 1,
  "Original Music Composer": 2,
  Composer: 2,
  Music: 2,
  "Director of Photography": 3,
  Editor: 4,
  Producer: 5,
  "Executive Producer": 6,
};

function crewPeople(crew: CrewEntry[]): XrayPerson[] {
  const byId = new Map<number, { name: string; jobs: string[]; profilePath: string | null; best: number }>();
  for (const c of crew) {
    const pr = CREW_PRIORITY[c.job];
    if (pr === undefined) continue;
    const e = byId.get(c.id) ?? { name: c.name, jobs: [], profilePath: c.profilePath, best: 99 };
    if (!e.jobs.includes(c.job)) e.jobs.push(c.job);
    e.best = Math.min(e.best, pr);
    if (!e.profilePath && c.profilePath) e.profilePath = c.profilePath;
    byId.set(c.id, e);
  }
  return [...byId.entries()]
    .map(([id, e]) => ({ id, name: e.name, sub: e.jobs.join(", "), profilePath: e.profilePath, best: e.best }))
    .sort((a, b) => a.best - b.best || a.name.localeCompare(b.name))
    .map(({ best, ...p }) => p);
}

function castPeople(details: TmdbDetail | null): XrayPerson[] {
  return (details?.cast ?? []).map((c) => ({ id: c.id, name: c.name, sub: c.character, profilePath: c.profilePath }));
}

export function XrayBrowser({
  meta,
  details,
  people,
  onPlayVideo,
  onClose,
}: {
  meta: Meta;
  details: TmdbDetail | null;
  people: XrayPerson[];
  onPlayVideo?: (ytId: string, name: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const cast = useMemo(() => castPeople(details), [details]);
  const crew = useMemo(() => (details ? crewPeople(details.crew) : []), [details]);
  const hasAbout = !!(details?.overview || meta.description);

  const tabs = useMemo(() => {
    const list: Array<{ id: TabId; label: string }> = [{ id: "in-scene", label: t("In scene") }];
    if (cast.length) list.push({ id: "cast", label: t("Cast") });
    if (crew.length) list.push({ id: "crew", label: t("Crew") });
    if (hasAbout) list.push({ id: "about", label: t("About") });
    return list;
  }, [cast.length, crew.length, hasAbout, t]);

  const [tab, setTab] = useState<TabId>(people.length ? "in-scene" : cast.length ? "cast" : "in-scene");

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-2xl animate-xray-open motion-reduce:animate-none">
      <header className="flex items-center gap-5 px-6 pt-14 sm:px-9">
        <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.24em] text-white">
          <UiIcon name="xray" className="h-[15px] w-[15px] text-accent" /> {t("X-Ray")}
        </span>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors ${
                tab === tb.id ? "text-white" : "text-white/45 hover:text-white/80"
              }`}
            >
              {tb.label}
              {tab === tb.id && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          <X size={17} strokeWidth={2.2} />
        </button>
      </header>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-6 pb-12 sm:px-9">
        <div key={tab} className="mx-auto w-full max-w-[1440px] animate-media-swap motion-reduce:animate-none">
          {!details && !people.length ? (
            <Empty label={t("Add a TMDB key in Settings to see the cast, crew, and details.")} />
          ) : tab === "about" ? (
            <XrayAbout meta={meta} details={details} onPlayVideo={onPlayVideo} />
          ) : tab === "in-scene" ? (
            <XrayScene
              people={people}
              poster={details?.poster || meta.poster}
              showName={details?.title || meta.name}
              onOpenAbout={hasAbout ? () => setTab("about") : undefined}
            />
          ) : (
            <Grid people={tab === "crew" ? crew : cast} emptyLabel={emptyFor(t, tab)} />
          )}
        </div>
      </div>
    </div>
  );
}

function emptyFor(t: (s: string) => string, tab: TabId): string {
  if (tab === "in-scene") return t("No one recognized on screen right now.");
  if (tab === "crew") return t("No crew information for this title.");
  return t("No cast information for this title.");
}

function Grid({ people, emptyLabel }: { people: XrayPerson[]; emptyLabel: string }) {
  if (people.length === 0) return <Empty label={emptyLabel} />;
  return (
    <div className="grid grid-cols-3 gap-x-5 gap-y-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
      {people.map((p) => (
        <XrayTile key={`${p.id}:${p.sub ?? ""}`} person={p} />
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center px-6 text-center text-[14px] leading-relaxed text-white/55">
      {label}
    </div>
  );
}
