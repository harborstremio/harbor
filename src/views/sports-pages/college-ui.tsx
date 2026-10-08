import { ArrowLeft, ExternalLink, Newspaper, PlayCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { collegeHue, divisionLabel, monogram, type College } from "@/lib/jl/sports/colleges";
import {
  isDirectStream,
  isLiveNow,
  logoUrl,
  matchupText,
  type RosterPlayer,
  type SchoolEvent,
  type SchoolStory,
} from "@/lib/jl/sports/sidearm";
import { useView } from "@/lib/view";
import { openInAppBrowser } from "@/lib/window";

/** Shared building blocks for the College Sports pages (colleges, school, student-athlete). */

export type Loadable<T> = { state: "loading" } | { state: "ready"; value: T } | { state: "failed" };

/** Runs `load` whenever `deps` change; stale results are dropped. */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[]): Loadable<T> {
  const key = JSON.stringify(deps);
  const [result, setResult] = useState<{ key: string; value: Loadable<T> } | null>(null);
  useEffect(() => {
    let alive = true;
    load().then(
      (value) => alive && setResult({ key, value: { state: "ready", value } }),
      () => alive && setResult({ key, value: { state: "failed" } }),
    );
    return () => {
      alive = false;
    };
    // `load` is a fresh closure every render; `key` captures what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result && result.key === key ? result.value : { state: "loading" };
}

export function PageShell({ children }: { children: ReactNode }) {
  const t = useT();
  const { goBack } = useView();
  return (
    <main className="relative h-full overflow-y-auto bg-canvas px-6 pb-20 pt-24 md:px-12">
      <button
        type="button"
        onClick={goBack}
        aria-label={t("Back")}
        className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-elevated/80 text-ink shadow-lg ring-1 ring-edge-soft/50 transition-colors hover:bg-elevated hover:text-ink-muted"
      >
        <ArrowLeft size={20} className="dir-icon" />
      </button>
      <div className="flex flex-col gap-8">{children}</div>
    </main>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink-subtle border-t-transparent" />
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-edge-soft/55 bg-elevated px-5 py-4 text-[14px] text-ink-muted">
      {children}
    </p>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
        {children}
      </h2>
      {aside && <span className="text-[12px] text-ink-subtle/80">{aside}</span>}
    </div>
  );
}

export function Shelf({
  title,
  aside,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle aside={aside}>{title}</SectionTitle>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">{children}</div>
    </section>
  );
}

export function Chip({
  label,
  active,
  onClick,
}: {
  label: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-medium transition-colors ${
        active
          ? "border-accent/40 bg-accent-soft text-accent"
          : "border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

/** The school's mark from its site, else a monogram on the school's colour. */
export function SchoolMark({
  college,
  size,
}: {
  college: Pick<College, "id" | "name" | "site">;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const h = collegeHue(college.id);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 ring-edge-soft/50"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(160deg, hsl(${h} 55% 32%) 0%, hsl(${(h + 40) % 360} 50% 18%) 100%)`,
      }}
    >
      {college.site && !failed ? (
        <img
          src={logoUrl(college.site)}
          alt=""
          draggable={false}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-[78%] w-[78%] object-contain drop-shadow-md"
        />
      ) : (
        <span
          className="font-black tracking-wider text-white/85"
          style={{ fontSize: Math.max(12, size * 0.3) }}
        >
          {monogram(college.name)}
        </span>
      )}
    </span>
  );
}

export function collegeLine(c: College): string {
  return [
    divisionLabel(c.division) + (c.subdivision ? ` · ${c.subdivision}` : ""),
    c.conference,
    c.state,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function CollegeCard({ college, onOpen }: { college: College; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-w-0 items-center gap-3 rounded-xl border border-edge-soft/55 bg-elevated p-3 text-start transition-colors hover:border-edge"
    >
      <SchoolMark college={college} size={48} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">
          {college.name}
        </span>
        <span className="truncate text-[11.5px] text-ink-subtle">{collegeLine(college)}</span>
      </span>
    </button>
  );
}

export function fmtWhen(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return allDay
    ? date
    : `${date} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

/** Opens a school's stream: in the player when it is a direct stream, else in the in-app browser. */
export function useWatchStream() {
  const { openPlayer } = useView();
  return (url: string, title: string, subtitle?: string) => {
    if (!isDirectStream(url)) {
      openInAppBrowser(url, title);
      return;
    }
    openPlayer({
      meta: {
        id: `college:${url}`,
        type: "tv",
        name: title,
        description: subtitle ?? "",
        releaseInfo: "Live",
      },
      url,
      title,
      subtitle,
      notWebReady: true,
      isLive: true,
    });
  };
}

function ResultBadge({ e }: { e: SchoolEvent }) {
  if (!e.result) return null;
  const tone =
    e.result === "W"
      ? "bg-emerald-500/15 text-emerald-400"
      : e.result === "L"
        ? "bg-danger/15 text-danger"
        : "bg-canvas/60 text-ink-muted";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${tone}`}>
      {e.result} {e.score}
    </span>
  );
}

/** A game card: when, sport, matchup, result, and the school's own stream. */
export function GameCard({
  event: e,
  college,
  onOpenCollege,
  now,
}: {
  event: SchoolEvent;
  college?: College;
  onOpenCollege?: () => void;
  now: number;
}) {
  const t = useT();
  const watch = useWatchStream();
  const live = isLiveNow(e, now);
  const name = college?.name ?? "";
  return (
    <div className="flex w-[280px] shrink-0 flex-col gap-2 rounded-xl border border-edge-soft/55 bg-elevated p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
          {e.sport ?? t("Game")}
        </span>
        {live ? (
          <span className="flex h-[18px] items-center rounded bg-danger px-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-white">
            {t("Live")}
          </span>
        ) : e.result ? (
          <ResultBadge e={e} />
        ) : (
          <span className="text-[11px] text-ink-subtle">{fmtWhen(e.start, e.allDay)}</span>
        )}
      </div>
      {college && onOpenCollege && (
        <button
          type="button"
          onClick={onOpenCollege}
          className="flex items-center gap-2 text-start"
        >
          <SchoolMark college={college} size={24} />
          <span className="truncate text-[13px] font-semibold text-ink hover:underline">
            {college.name}
          </span>
        </button>
      )}
      <p className="line-clamp-2 text-[13.5px] font-medium text-ink">{matchupText(e)}</p>
      {e.location && <p className="truncate text-[11.5px] text-ink-subtle">{e.location}</p>}
      <div className="mt-auto flex gap-1.5 pt-1">
        {e.stream && (
          <button
            type="button"
            onClick={() =>
              watch(
                e.stream ?? "",
                [name, matchupText(e)].filter(Boolean).join(" "),
                e.sport ?? undefined,
              )
            }
            className="flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            <PlayCircle size={13} />
            {e.result ? t("Replay") : t("Watch")}
          </button>
        )}
        {e.url && (
          <button
            type="button"
            onClick={() => openInAppBrowser(e.url ?? "", matchupText(e))}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-edge-soft px-3 text-[12px] font-medium text-ink-muted hover:text-ink"
          >
            <ExternalLink size={12} />
            {t("Game info")}
          </button>
        )}
      </div>
    </div>
  );
}

export function RosterCard({ player: p, onOpen }: { player: RosterPlayer; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-[150px] shrink-0 flex-col gap-2 rounded-xl text-start"
    >
      <span className="relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-elevated ring-1 ring-edge-soft/55">
        {p.photo && !failed ? (
          <img
            src={p.photo}
            alt=""
            loading="lazy"
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-4xl font-black text-ink-subtle/60">
            {p.name.charAt(0)}
          </span>
        )}
        {p.number && (
          <span className="absolute start-2 top-2 rounded-md bg-ink px-1.5 py-0.5 text-[12px] font-black text-canvas">
            #{p.number}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{p.name}</span>
      <span className="-mt-1.5 truncate text-[11.5px] text-ink-subtle">
        {[p.position, p.year].filter(Boolean).join(" · ")}
      </span>
    </button>
  );
}

export function NewsCard({ story }: { story: SchoolStory }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => openInAppBrowser(story.url, story.title)}
      className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border border-edge-soft/55 bg-elevated text-start transition-colors hover:border-edge"
    >
      <span className="flex aspect-video w-full items-center justify-center bg-canvas/60">
        {story.image && !failed ? (
          <img
            src={story.image}
            alt=""
            loading="lazy"
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <Newspaper size={22} className="text-ink-subtle" />
        )}
      </span>
      <span className="flex flex-col gap-1 p-3">
        <span className="line-clamp-2 text-[13px] font-semibold text-ink">{story.title}</span>
        {story.published && (
          <span className="text-[11px] text-ink-subtle">{fmtWhen(story.published, true)}</span>
        )}
      </span>
    </button>
  );
}
