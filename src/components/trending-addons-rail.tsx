import { ArrowedScrollRow } from "@/components/arrowed-scroll-row";
import { installAddon } from "@/lib/addon-store";
import { useTopMovers, type MoverEntry } from "@/lib/providers/stremio-addons-velocity";
import { Plus, Loader2, Star, TrendingUp } from "lucide-react";
import { useState } from "react";

export function TrendingAddonsRail({
  onChange,
  onOpen,
}: {
  onChange?: () => void;
  onOpen?: (manifestId: string) => void;
}) {
  const movers = useTopMovers(10);
  if (movers.length === 0) return null;
  const windowDays = movers[0].windowDays;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/30 to-amber-500/20 ring-1 ring-rose-500/30">
            <TrendingUp size={18} strokeWidth={2.4} className="text-rose-300" />
          </span>
          <div className="flex flex-col">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-rose-300">Trending up</span>
            <h3 className="text-[22px] font-medium tracking-tight text-ink">Rising on stremio-addons.net</h3>
            <p className="text-[12.5px] text-ink-muted">
              Most stars gained in the last {windowDays} {windowDays === 1 ? "day" : "days"}. Tracked locally. Your
              Harbor visits power this.
            </p>
          </div>
        </div>
      </div>
      <ArrowedScrollRow className="-mx-1">
        {movers.map((m) => (
          <MoverCard key={m.community.uuid} entry={m} onChange={onChange} onOpen={onOpen} />
        ))}
      </ArrowedScrollRow>
    </section>
  );
}

function MoverCard({
  entry,
  onChange,
  onOpen,
}: {
  entry: MoverEntry;
  onChange?: () => void;
  onOpen?: (manifestId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const c = entry.community;

  const install = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!c.manifestId || !c.manifestUrl || busy) return;
    setBusy(true);
    try {
      await installAddon(c.manifestId, c.manifestUrl);
      onChange?.();
    } catch (err) {
      console.warn("[trending] install failed", err);
    } finally {
      setBusy(false);
    }
  };

  const open = () => {
    if (c.manifestId && onOpen) onOpen(c.manifestId);
  };

  const name = c.name ?? c.slug;
  const desc = c.description ?? "";
  const logo = c.logo;
  const bg = c.background;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
      className="group relative flex w-[260px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-rose-500/20 bg-surface transition-all hover:-translate-y-0.5 hover:border-rose-400/50 hover:shadow-[0_22px_44px_-22px_rgba(244,63,94,0.45)]"
    >
      <div
        className="relative h-24 w-full"
        style={
          bg
            ? {
                backgroundImage: `url(${bg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { background: "linear-gradient(135deg, rgba(244,63,94,0.18), rgba(245,158,11,0.10))" }
        }
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
        <span className="absolute end-2.5 top-2.5 flex items-center gap-1 rounded-full bg-rose-500/90 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur-sm">
          <TrendingUp size={10} strokeWidth={2.8} />+{entry.delta}
        </span>
        {logo && (
          <img
            src={logo}
            alt=""
            draggable={false}
            className="absolute bottom-2.5 start-2.5 h-10 w-10 rounded-lg bg-canvas/80 object-contain p-1 ring-1 ring-edge-soft"
          />
        )}
      </div>
      <div className="flex min-h-[110px] flex-1 flex-col gap-2 px-3.5 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-semibold leading-tight text-ink">{name}</span>
          {desc && <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-subtle">{desc}</span>}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[11px] font-bold text-accent">
            <Star size={10} strokeWidth={2.6} fill="currentColor" />
            {entry.community.stars.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={install}
            disabled={busy || !c.manifestId}
            className="flex h-8 items-center gap-1 rounded-full bg-ink px-2.5 text-[11.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={11} strokeWidth={2.6} className="animate-spin" />
            ) : (
              <Plus size={11} strokeWidth={2.6} />
            )}
            Install
          </button>
        </div>
      </div>
    </article>
  );
}
