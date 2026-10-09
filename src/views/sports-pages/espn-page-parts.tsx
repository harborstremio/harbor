import { ArrowLeft, Loader2, Star } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import type { StandingColumn, StandingGroup } from "@/lib/jl/sports/espn-league";
import { resultFor } from "@/lib/jl/sports/espn-team";
import type { SportsGame } from "@/lib/sports/espn";
import { useView } from "@/lib/view";
import { statusText, TeamLine } from "@/views/live/live-home/jl-sports/jl-sports-hub";
import { isCurrentLiveGame } from "@/lib/jl/sports/presentation";

/** Shared pieces for the team, athlete and league pages. */

/** Load once per key; `null` data after a finished load means it failed or was empty. */
export function useLoad<T>(key: string, load: () => Promise<T>): { data: T | null; loading: boolean } {
  const [state, setState] = useState<{ key: string; data: T | null } | null>(null);
  useEffect(() => {
    let active = true;
    load()
      .then((data) => {
        if (active) setState({ key, data });
      })
      .catch(() => {
        if (active) setState({ key, data: null });
      });
    return () => {
      active = false;
    };
    // The key names the request; `load` is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state?.key === key ? state : null;
  return { data: current?.data ?? null, loading: !current };
}

export function PageShell({ children }: { children: ReactNode }) {
  const t = useT();
  const { goBack } = useView();
  return (
    <main className="relative h-full flex-1 overflow-y-auto px-6 pb-20 pt-24 md:px-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        onClick={goBack}
        aria-label={t("Back")}
        className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-elevated/80 text-ink shadow-lg ring-1 ring-edge-soft/50 transition-colors hover:bg-elevated hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <ArrowLeft size={20} className="dir-icon" />
      </button>
      <div className="flex flex-col gap-10">{children}</div>
    </main>
  );
}

export function PageHeader({
  image,
  round = false,
  eyebrow,
  title,
  facts,
  color,
  actions,
}: {
  image: string | null;
  round?: boolean;
  eyebrow?: ReactNode;
  title: string;
  facts: Array<string | null | undefined>;
  color?: string | null;
  actions?: ReactNode;
}) {
  const shown = facts.filter((f): f is string => !!f);
  return (
    <header className="relative overflow-hidden rounded-2xl border border-edge-soft/60 bg-gradient-to-br from-elevated via-canvas to-canvas p-6 md:p-8">
      {color && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: `radial-gradient(120% 100% at 85% 30%, #${color}88 0%, #${color}22 45%, transparent 75%)` }}
        />
      )}
      <div className="relative flex flex-wrap items-center gap-6">
        <Img
          src={image}
          className={`h-24 w-24 shrink-0 object-contain drop-shadow-xl md:h-32 md:w-32 ${round ? "rounded-full bg-canvas/60 object-cover object-top" : ""}`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {eyebrow && <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-ink-subtle">{eyebrow}</div>}
          <h1 className="text-3xl font-black leading-tight text-ink md:text-4xl">{title}</h1>
          {shown.length > 0 && (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-ink-muted">
              {shown.map((f, i) => (
                <span key={`${i}:${f}`} className={i === 0 ? "rounded bg-canvas/60 px-2 font-semibold text-ink" : ""}>
                  {f}
                </span>
              ))}
            </p>
          )}
          {actions && <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Img({ src, className, rounded = false }: { src: string | null | undefined; className: string; rounded?: boolean }) {
  const [err, setErr] = useState(false);
  if (!src || err) return <span className={`${className} block rounded-full bg-canvas/60`} />;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      onError={() => setErr(true)}
      className={`${className} ${rounded ? "rounded-full" : ""}`}
    />
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={20} className="animate-spin text-ink-subtle" />
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-ink-subtle">{children}</p>;
}

export function FollowToggle({ following, onToggle, name }: { following: boolean; onToggle: () => void; name: string }) {
  const t = useT();
  return (
    <button
      onClick={onToggle}
      aria-pressed={following}
      title={following ? t("Unfollow {team}", { team: name }) : t("Follow {team}", { team: name })}
      className={`flex h-9 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
        following ? "border-accent/40 bg-accent-soft text-accent" : "border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
      }`}
    >
      <Star size={13} fill={following ? "currentColor" : "none"} strokeWidth={2} />
      {following ? t("Following") : t("Follow")}
    </button>
  );
}

export function Pill({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 items-center gap-1.5 rounded-full border border-edge-soft px-4 text-[13px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      {children}
    </button>
  );
}

/** A game card that opens the game's detail; W/L for the page's team. */
export function GameCard({ game, teamId }: { game: SportsGame; teamId?: string }) {
  const t = useT();
  const { openMatchDetail } = useView();
  const live = isCurrentLiveGame(game);
  const result = teamId ? resultFor(game, teamId) : null;
  return (
    <button
      onClick={() => openMatchDetail(game)}
      title={t("Game details")}
      className="flex w-[260px] shrink-0 flex-col gap-2 rounded-xl border border-edge-soft/55 bg-elevated p-3 text-start transition-colors hover:border-edge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`flex h-[18px] items-center rounded px-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] ${
            live ? "bg-danger text-white" : "border border-edge-soft/60 text-ink-subtle"
          }`}
        >
          {statusText(game, t)}
        </span>
        {result && (
          <span
            className={`rounded px-1.5 text-[10.5px] font-bold ${
              result === "W" ? "bg-emerald-600 text-white" : result === "L" ? "bg-danger text-white" : "bg-canvas/60 text-ink-muted"
            }`}
          >
            {result}
          </span>
        )}
        {!result && game.network && (
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">{game.network}</span>
        )}
      </div>
      <TeamLine side={game.away} active={game.state !== "pre"} />
      <TeamLine side={game.home} active={game.state !== "pre"} />
    </button>
  );
}

export function Shelf({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 overflow-x-auto pb-2">{children}</div>;
}

/** One standings table; rows with a team open its page. */
export function StandingsTable({
  group,
  columns,
  highlightId,
  onTeam,
}: {
  group: StandingGroup;
  columns: StandingColumn[];
  highlightId?: string;
  onTeam?: (id: string, name: string) => void;
}) {
  const t = useT();
  return (
    <div className="overflow-x-auto rounded-xl border border-edge-soft/55 bg-elevated">
      <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-subtle">{group.name}</p>
      <table className="w-full text-[13px] tabular-nums">
        <thead className="text-[11px] uppercase tracking-wider text-ink-subtle">
          <tr>
            <th className="px-4 py-2 text-start font-semibold">#</th>
            <th className="px-2 py-2 text-start font-semibold">{t("Team")}</th>
            {columns.map((c) => (
              <th key={c.key} className="px-2.5 py-2 text-end font-semibold">
                {t(c.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group.rows.map((r, i) => {
            const me = !!highlightId && r.id === highlightId;
            const open = onTeam && r.kind === "team" && r.id ? () => onTeam(r.id as string, r.name) : null;
            return (
              <tr key={`${r.id ?? r.name}:${i}`} className={`border-t border-edge-soft/50 ${me ? "bg-accent-soft font-bold" : ""}`}>
                <td className="px-4 py-2 text-ink-subtle">{i + 1}</td>
                <td className="px-2 py-1.5">
                  {open ? (
                    <button
                      onClick={open}
                      className="flex items-center gap-2 rounded text-start text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      <Img src={r.logo} className="h-5 w-5 shrink-0 object-contain" />
                      <span className="truncate">{r.name}</span>
                    </button>
                  ) : (
                    <span className="flex items-center gap-2 text-ink">
                      <Img src={r.logo} className="h-5 w-5 shrink-0 object-contain" />
                      <span className="truncate">{r.name}</span>
                    </span>
                  )}
                </td>
                {columns.map((c) => (
                  <td key={c.key} className="px-2.5 py-2 text-end text-ink-muted">
                    {r.values[c.key] ?? ""}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A person tile (roster, leaders); opens the athlete page when it has an id. */
export function PersonTile({
  name,
  image,
  line,
  value,
  onOpen,
}: {
  name: string;
  image: string | null;
  line?: string | null;
  value?: string | null;
  onOpen?: () => void;
}) {
  const body = (
    <>
      <Img src={image} className="h-11 w-11 shrink-0 rounded-full bg-canvas/60 object-cover object-top" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13.5px] font-semibold text-ink">{name}</span>
        {line && <span className="truncate text-[11.5px] text-ink-subtle">{line}</span>}
      </span>
      {value && <span className="shrink-0 text-[15px] font-bold tabular-nums text-ink">{value}</span>}
    </>
  );
  const cls = "flex items-center gap-3 rounded-xl border border-edge-soft/55 bg-elevated px-3 py-2.5 text-start";
  if (!onOpen) return <div className={cls}>{body}</div>;
  return (
    <button
      onClick={onOpen}
      className={`${cls} transition-colors hover:border-edge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink`}
    >
      {body}
    </button>
  );
}

/** Shown where a feature needs the viewer's own key. */
export function KeyNote() {
  const t = useT();
  return <Note>{t("Add your key in Settings → Sports plugins & keys")}</Note>;
}
