import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Loader2, MapPin, Trophy, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  fetchTennisTournaments,
  fetchTournamentDraw,
  type DrawMatch,
  type TennisTournament,
  type TournamentDraw,
} from "@/lib/sports/tennis";

function dateRange(t: TennisTournament, locale: string): string {
  if (!t.startMs) return "";
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const from = new Date(t.startMs).toLocaleDateString(locale, o);
  if (!t.endMs) return from;
  return `${from} - ${new Date(t.endMs).toLocaleDateString(locale, o)}`;
}

export function TennisTournamentsModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [list, setList] = useState<TennisTournament[] | null>(null);
  const [open, setOpen] = useState<TennisTournament | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (open ? setOpen(null) : onClose());
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, open]);

  useEffect(() => {
    let dead = false;
    fetchTennisTournaments()
      .then((r) => !dead && setList(r))
      .catch(() => !dead && setList([]));
    return () => {
      dead = true;
    };
  }, []);

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[240] flex items-stretch justify-center bg-canvas/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("Tennis tournaments")}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in relative m-6 flex max-h-[calc(100vh-3rem)] w-full max-w-[860px] flex-col overflow-hidden rounded-3xl border border-edge-soft bg-surface shadow-[0_30px_120px_-30px_rgba(0,0,0,0.85)]"
      >
        <header className="flex items-center gap-3 border-b border-edge-soft px-6 py-5">
          {open && (
            <button
              onClick={() => setOpen(null)}
              aria-label={t("Back")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <h2 className="flex min-w-0 flex-1 items-center gap-2.5 font-display text-[22px] font-medium text-ink">
            <Trophy size={20} className="shrink-0 text-ink-muted" />
            <span className="truncate">{open ? open.name : t("Tennis tournaments")}</span>
          </h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-edge text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {open ? (
            <DrawPanel tournament={open} />
          ) : list === null ? (
            <Spinner />
          ) : list.length === 0 ? (
            <Empty label={t("No tournaments found right now.")} />
          ) : (
            <TournamentList list={list} onOpen={setOpen} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Spinner() {
  return (
    <div className="grid place-items-center py-20 text-ink-subtle">
      <Loader2 size={22} className="animate-spin" />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="py-20 text-center text-[13.5px] text-ink-muted">{label}</div>;
}

function TournamentList({
  list,
  onOpen,
}: {
  list: TennisTournament[];
  onOpen: (t: TennisTournament) => void;
}) {
  const t = useT();
  const now = Date.now();
  const running = (x: TennisTournament) =>
    x.state === "in" || (x.startMs <= now && (!x.endMs || x.endMs >= now) && x.state !== "post");
  const live = list.filter(running);
  const upcoming = list.filter((x) => !running(x) && x.state !== "post");
  const done = list.filter((x) => !running(x) && x.state === "post");
  return (
    <div className="flex flex-col gap-6">
      {live.length > 0 && <Section title={t("Underway")} items={live} onOpen={onOpen} />}
      {upcoming.length > 0 && <Section title={t("Upcoming")} items={upcoming} onOpen={onOpen} />}
      {done.length > 0 && <Section title={t("Recently finished")} items={done} onOpen={onOpen} />}
    </div>
  );
}

function Section({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: TennisTournament[];
  onOpen: (t: TennisTournament) => void;
}) {
  return (
    <div>
      <h3 className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((x) => (
          <TournamentRow key={`${x.tour}:${x.id}`} item={x} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function TournamentRow({
  item,
  onOpen,
}: {
  item: TennisTournament;
  onOpen: (t: TennisTournament) => void;
}) {
  const t = useT();
  return (
    <button
      onClick={() => onOpen(item)}
      className="flex flex-col gap-1.5 rounded-2xl border border-edge-soft bg-canvas/40 p-3.5 text-start transition-colors hover:bg-elevated"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-elevated px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          {item.tour}
        </span>
        {item.major && (
          <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
            {t("Grand Slam")}
          </span>
        )}
        {item.state === "in" && (
          <span className="flex items-center gap-1 rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            {t("Live")}
          </span>
        )}
      </div>
      <span className="truncate text-[15px] font-semibold text-ink">{item.name}</span>
      <span className="flex items-center gap-3 text-[12px] text-ink-subtle">
        <span className="tabular-nums">{dateRange(item, "en-US")}</span>
        {item.venue && (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{item.venue}</span>
          </span>
        )}
      </span>
    </button>
  );
}

function DrawPanel({ tournament }: { tournament: TennisTournament }) {
  const t = useT();
  const [draw, setDraw] = useState<TournamentDraw | null | "error">(null);

  useEffect(() => {
    let dead = false;
    setDraw(null);
    fetchTournamentDraw(tournament)
      .then((d) => !dead && setDraw(d ?? "error"))
      .catch(() => !dead && setDraw("error"));
    return () => {
      dead = true;
    };
  }, [tournament]);

  if (draw === null) return <Spinner />;
  if (draw === "error") return <Empty label={t("The draw is not published yet.")} />;

  return (
    <div className="flex flex-col gap-6">
      {draw.previousWinners.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {t("Defending champion")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {draw.previousWinners.map((w, i) => (
              <span
                key={`${w.name}-${i}`}
                className="flex items-center gap-2 rounded-full bg-elevated px-3 py-1.5 text-[12.5px] text-ink"
              >
                {w.image && <img src={w.image} alt="" className="h-6 w-6 rounded-full object-cover" />}
                {w.name}
                {w.draw && <span className="text-ink-subtle">{w.draw}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      {draw.sections.length === 0 ? (
        <Empty label={t("The draw is not published yet.")} />
      ) : (
        draw.sections.map((s) => (
          <div key={s.draw} className="flex flex-col gap-4">
            <h3 className="border-b border-edge-soft pb-1.5 text-[13px] font-semibold text-ink">
              {s.draw}
            </h3>
            {s.rounds.map((r) => (
              <div key={`${s.draw}:${r.name}`}>
                <h4 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {r.name}
                </h4>
                <div className="flex flex-col gap-1.5">
                  {r.matches.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function MatchRow({ match }: { match: DrawMatch }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-edge-soft bg-canvas/40 p-3">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-subtle">
        {match.state === "in" ? (
          <span className="flex items-center gap-1 rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            {t("Live")}
          </span>
        ) : (
          <span>{match.detail || (match.state === "post" ? t("Final") : t("Upcoming"))}</span>
        )}
        {match.draw && <span className="truncate">{match.draw}</span>}
        {match.court && <span className="truncate">{match.court}</span>}
      </div>
      {match.players.map((p, i) => (
        <div key={`${p.name}-${i}`} className="flex items-center gap-2 py-0.5">
          {p.flags?.length ? (
            <span className="flex shrink-0 -space-x-1.5">
              {p.flags.map((flag, f) => (
                <img
                  key={`${flag}-${f}`}
                  src={flag}
                  alt=""
                  className="h-3.5 w-5 rounded-[2px] object-contain ring-1 ring-canvas"
                />
              ))}
            </span>
          ) : p.flag ? (
            <img src={p.flag} alt="" className="h-3.5 w-5 shrink-0 object-contain" />
          ) : (
            <span className="h-3.5 w-5 shrink-0" />
          )}
          <span
            className={`min-w-0 flex-1 text-[13.5px] ${p.flags?.length ? "leading-tight" : "truncate"} ${p.winner ? "font-semibold text-ink" : "text-ink-muted"}`}
          >
            {p.name}
          </span>
          <span className="flex shrink-0 gap-1.5 tabular-nums text-[13px] text-ink">
            {p.sets.map((s, j) => (
              <span key={j} className="w-3 text-center">
                {s}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
