import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { allsportsImage, cachedAllsportsImage } from "@/lib/jl/sports/allsports";
import type { AsGame, AsImageKind, Table } from "@/lib/jl/sports/as-core";

/** Shared pieces for the AllSports pages (Match Center, world sports). */

export function useAllSportsKey(): string {
  return useSettings().settings.allsportsKey.trim();
}

export function KeyNote() {
  const t = useT();
  return (
    <p className="rounded-2xl bg-elevated/40 p-5 text-[14px] text-ink-muted ring-1 ring-edge-soft/50">
      {t("Add your key in Settings → Sports plugins & keys")}
    </p>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
      {children}
    </h2>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-elevated/30 p-4 ring-1 ring-edge-soft/50 ${className}`}>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink-subtle border-t-transparent" />
    </div>
  );
}

/**
 * An AllSports image (the key is needed, so it loads as a blob). Fetched only once it scrolls
 * near the screen, since every image counts against the viewer's plan.
 */
export function AsImg({
  slug,
  kind,
  id,
  className,
}: {
  slug: string;
  kind: AsImageKind;
  id: number | null | undefined;
  className?: string;
}) {
  const key = useAllSportsKey();
  const ref = useRef<HTMLSpanElement>(null);
  const tag = `${key}|${slug}|${kind}|${id ?? ""}`;
  const cached = id && key ? cachedAllsportsImage(key, slug, kind, id) : null;
  const [fetched, setFetched] = useState<{ tag: string; url: string | null } | null>(null);
  const src = cached ?? (fetched?.tag === tag ? fetched.url : null);
  useEffect(() => {
    if (!id || !key || cachedAllsportsImage(key, slug, kind, id)) return;
    let alive = true;
    const el = ref.current;
    const load = () => {
      void allsportsImage(key, slug, kind, id).then((url) => {
        if (alive) setFetched({ tag, url });
      });
    };
    if (!el || typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        alive = false;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [key, slug, kind, id, tag]);
  return (
    <span
      ref={ref}
      className={`inline-flex shrink-0 items-center justify-center ${className ?? ""}`}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-contain" /> : null}
    </span>
  );
}

/**
 * Load once per dependency change, optionally refreshing every `refreshMs` while mounted.
 * A failed refresh keeps the last value.
 */
export function useAsLoad<T>(
  load: () => Promise<T>,
  deps: unknown[],
  refreshMs?: (value: T | null) => number | null,
): { value: T | null; loading: boolean; error: unknown } {
  // Functions in deps (a getter bound to a key) change with the key, which is listed too.
  const depKey = JSON.stringify(deps);
  const [state, setState] = useState<{ depKey: string; value: T | null; error: unknown } | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      load().then(
        (value) => {
          if (!alive) return;
          setState({ depKey, value, error: null });
          const next = refreshMs?.(value);
          if (next) timer = setTimeout(run, next);
        },
        (error: unknown) => {
          if (alive)
            setState((s) => ({ depKey, value: s?.depKey === depKey ? s.value : null, error }));
        },
      );
    };
    run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // depKey stands for the caller's deps; load and refreshMs are fresh closures every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);
  const current = state?.depKey === depKey ? state : null;
  return { value: current?.value ?? null, loading: !current, error: current?.error ?? null };
}

export function gameStatus(g: AsGame, t: ReturnType<typeof useT>): string {
  if (g.state === "in") return g.detail ? `${t("Live")} · ${g.detail}` : t("Live");
  if (g.state === "post") return t("Final");
  return new Date(g.startMs).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A game row that opens its Match Center. */
export function GameRow({ game, onOpen }: { game: AsGame; onOpen: (g: AsGame) => void }) {
  const t = useT();
  const showScore = game.state !== "pre";
  return (
    <button
      onClick={() => onOpen(game)}
      className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[14px] transition-colors hover:bg-elevated/60 focus-visible:bg-elevated/60"
    >
      <span className="flex min-w-0 items-center justify-end gap-2 text-end">
        <span className="truncate font-medium text-ink">{game.home.short}</span>
        <AsImg slug={game.slug} kind="team" id={game.home.id} className="h-6 w-6" />
      </span>
      <span className="flex min-w-[96px] flex-col items-center text-center">
        {showScore ? (
          <span className="font-bold tabular-nums text-ink">
            {game.home.score ?? "-"} – {game.away.score ?? "-"}
          </span>
        ) : null}
        <span
          className={`text-[11px] ${game.state === "in" ? "font-semibold text-accent" : "text-ink-subtle"}`}
        >
          {gameStatus(game, t)}
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <AsImg slug={game.slug} kind="team" id={game.away.id} className="h-6 w-6" />
        <span className="truncate font-medium text-ink">{game.away.short}</span>
      </span>
    </button>
  );
}

/** League table(s); the given team ids are highlighted. */
export function StandingsTables({
  slug,
  tables,
  highlight,
}: {
  slug: string;
  tables: Table[];
  highlight?: number[];
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      {tables.map((table) => {
        const soccerish = table.rows.some((r) => r.points != null);
        return (
          <Panel key={table.name} className="overflow-x-auto">
            {tables.length > 1 && (
              <p className="mb-2 text-[13px] font-semibold text-ink-muted">{table.name}</p>
            )}
            <table className="w-full text-[13px] tabular-nums">
              <thead className="text-[11px] uppercase tracking-wider text-ink-subtle">
                <tr>
                  <th className="px-2 py-1.5 text-start">#</th>
                  <th className="px-2 py-1.5 text-start">{t("Team")}</th>
                  <th className="px-2 py-1.5 text-end">{t("P")}</th>
                  <th className="px-2 py-1.5 text-end">{t("W")}</th>
                  {soccerish && <th className="px-2 py-1.5 text-end">{t("D")}</th>}
                  <th className="px-2 py-1.5 text-end">{t("L")}</th>
                  <th className="px-2 py-1.5 text-end">{t("Diff")}</th>
                  <th className="px-2 py-1.5 text-end">{soccerish ? t("Pts") : t("Pct")}</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r) => (
                  <tr
                    key={r.teamId}
                    className={`border-t border-edge-soft/50 ${highlight?.includes(r.teamId) ? "bg-accent-soft font-semibold text-ink" : "text-ink-muted"}`}
                  >
                    <td className="px-2 py-1.5">{r.position}</td>
                    <td className="px-2 py-1.5">
                      <span className="flex items-center gap-2">
                        <AsImg slug={slug} kind="team" id={r.teamId} className="h-5 w-5" />
                        <span className="truncate">{r.name}</span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-end">
                      {r.played ?? r.wins + r.losses + r.draws}
                    </td>
                    <td className="px-2 py-1.5 text-end">{r.wins}</td>
                    {soccerish && <td className="px-2 py-1.5 text-end">{r.draws}</td>}
                    <td className="px-2 py-1.5 text-end">{r.losses}</td>
                    <td className="px-2 py-1.5 text-end">{r.diff || r.pf - r.pa}</td>
                    <td className="px-2 py-1.5 text-end font-bold text-ink">
                      {soccerish
                        ? r.points
                        : r.pct != null
                          ? r.pct.toFixed(3).replace(/^0/, "")
                          : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        );
      })}
    </div>
  );
}
