import { Users } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import type { ProfileWatching } from "./profile-types";

function clock(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function useLivePosition(watching?: ProfileWatching): number {
  const base = watching?.positionSec ?? 0;
  const at = watching?.positionAt ?? 0;
  const running = !!watching && !watching.paused && at > 0 && (watching.durationSec ?? 0) > 0;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    if (!running) return;
    const tick = () => setElapsed(Math.max(0, (Date.now() - at) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running, at, base]);
  return base + elapsed;
}

export function WatchNowCard({ watching }: { watching?: ProfileWatching }) {
  const t = useT();
  const { openMeta, openManga } = useView();
  const livePos = useLivePosition(watching);
  if (!watching || (watching.kind !== "party" && !watching.title)) return null;

  const isParty = watching.kind === "party";
  const isManga = watching.metaType === "manga";
  const open = watching.metaId
    ? () => {
        if (isManga) {
          openManga(watching.metaId as string);
          return;
        }
        openMeta({
          id: watching.metaId as string,
          type: watching.metaType === "series" || watching.metaType === "anime" ? "series" : "movie",
          name: watching.title ?? "",
          poster: watching.posterUrl,
        });
      }
    : null;
  const dur = watching.durationSec ?? 0;
  const pos = Math.min(Math.max(0, livePos), dur > 0 ? dur : Infinity);
  const hasTime = dur > 0;
  const pct = hasTime ? Math.min(100, Math.max(0, (pos / dur) * 100)) : 0;
  const label = isParty
    ? t("Watch party")
    : watching.paused
      ? t("Paused")
      : isManga
        ? t("Read now")
        : t("Watch now");
  const sub =
    isParty && watching.partySize
      ? t("{count} aboard", { count: watching.partySize }) + (watching.sub ? ` · ${watching.sub}` : "")
      : (watching.sub ?? "");

  return (
    <section
      role={open ? "button" : undefined}
      tabIndex={open ? 0 : undefined}
      aria-label={open ? t("Open {name}", { name: watching.title ?? "" }) : undefined}
      onClick={open ?? undefined}
      onKeyDown={
        open
          ? (e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              open();
            }
          : undefined
      }
      className={`rounded-lg bg-surface p-4 ring-1 ring-edge-soft ${
        open
          ? "cursor-pointer transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          : ""
      }`}
    >
      <div className="flex items-stretch gap-3.5">
        {watching.posterUrl ? (
          <img
            src={watching.posterUrl}
            alt=""
            draggable={false}
            className="h-[68px] w-[46px] shrink-0 rounded-lg object-cover ring-1 ring-edge-soft"
          />
        ) : (
          <span className="grid h-[68px] w-[46px] shrink-0 place-items-center rounded-lg bg-raised ring-1 ring-edge-soft">
            {isParty ? (
              <Users size={16} className="text-ink-subtle" />
            ) : (
              <Play size={16} className="text-ink-subtle" />
            )}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent">
            {isParty ? <Users size={12} strokeWidth={2.6} /> : <Play size={12} strokeWidth={2.8} />}
            {label}
          </span>
          <span className="truncate text-[14.5px] font-medium leading-tight text-ink">
            {watching.title ?? t("something")}
          </span>
          {sub && <span className="truncate text-[12px] text-ink-subtle">{sub}</span>}
          {hasTime && (
            <div className="mt-1 flex flex-col gap-1">
              <div className="h-1 w-full overflow-hidden rounded-full bg-raised">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[11.5px] tabular-nums text-ink-muted">
                {clock(pos)} / {clock(dur)}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
