import { ArrowDownToLine, Flame, Sparkles, Star, TrendingUp, type LucideIcon } from "lucide-react";
import { SectionHeader } from "@/views/profile/section-header";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import type { StoreTheme } from "@/lib/theme-store";
import { fmtCount } from "./format";

type ChartKind = "rating" | "downloads" | "fresh";

function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = Math.max(0, Date.now() - t);
  const day = 86_400_000;
  if (d < day) return "today";
  if (d < 7 * day) return `${Math.floor(d / day)}d`;
  if (d < 30 * day) return `${Math.floor(d / (7 * day))}w`;
  return `${Math.floor(d / (30 * day))}mo`;
}

export function StoreTopCharts({
  trending,
  popular,
  fresh,
  onOpen,
}: {
  trending: StoreTheme[];
  popular: StoreTheme[];
  fresh: StoreTheme[];
  onOpen: (t: StoreTheme) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartColumn title="Trending" Icon={TrendingUp} kind="rating" themes={trending} onOpen={onOpen} />
      <ChartColumn title="Most popular" Icon={Flame} kind="downloads" themes={popular} onOpen={onOpen} />
      <ChartColumn title="New & notable" Icon={Sparkles} kind="fresh" themes={fresh} onOpen={onOpen} />
    </div>
  );
}

function ChartColumn({
  title,
  Icon,
  kind,
  themes,
  onOpen,
}: {
  title: string;
  Icon: LucideIcon;
  kind: ChartKind;
  themes: StoreTheme[];
  onOpen: (t: StoreTheme) => void;
}) {
  const rows = themes.slice(0, 5);
  return (
    <section aria-label={title} className="rounded-md bg-surface p-4 ring-1 ring-edge-soft">
      <SectionHeader icon={<Icon size={16} className="text-ink-subtle" />} label={title} />
      <div className="flex flex-col">
        {rows.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-ink-subtle">Nothing here yet</p>
        ) : (
          rows.map((t, i) => <ChartRow key={t.id} rank={i + 1} theme={t} kind={kind} onOpen={onOpen} />)
        )}
      </div>
    </section>
  );
}

function RowThumb({ theme }: { theme: StoreTheme }) {
  const img = theme.cover ?? theme.screenshots[0] ?? null;
  const swatch = theme.swatch.slice(0, 3);
  return (
    <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-[7px] bg-elevated ring-1 ring-edge-soft">
      {img ? (
        <img src={img} alt="" draggable={false} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full">
          {theme.swatch.map((c, i) => (
            <span key={i} className="flex-1" style={{ background: c }} />
          ))}
        </span>
      )}
      {img && swatch.length > 0 && (
        <span className="absolute bottom-1 end-1 flex overflow-hidden rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.5)] ring-1 ring-black/40">
          {swatch.map((c, i) => (
            <span key={i} className="h-2.5 w-2" style={{ background: c }} />
          ))}
        </span>
      )}
    </span>
  );
}

function ChartRow({
  rank,
  theme,
  kind,
  onOpen,
}: {
  rank: number;
  theme: StoreTheme;
  kind: ChartKind;
  onOpen: (t: StoreTheme) => void;
}) {
  const top = rank <= 3;
  return (
    <button
      type="button"
      onClick={() => onOpen(theme)}
      className="group flex items-center gap-3 rounded-md p-2 text-start outline-none transition-colors hover:bg-elevated focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-sm text-[12.5px] font-bold tabular-nums ${
          top ? "bg-accent text-canvas" : "bg-elevated text-ink-subtle"
        }`}
      >
        {rank}
      </span>
      <RowThumb theme={theme} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold leading-tight text-ink">{theme.name}</span>
        <span className="truncate text-[11.5px] text-ink-subtle">
          {theme.authorHandle ? (
            <UserHoverCard handle={theme.authorHandle}>
              <span className="transition-colors hover:text-ink" onClick={(e) => e.stopPropagation()}>
                {theme.author || "Anonymous"}
              </span>
            </UserHoverCard>
          ) : (
            theme.author || "Anonymous"
          )}
        </span>
      </span>
      <span className="shrink-0 ps-1">
        {kind === "rating" && theme.ratingCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold tabular-nums text-ink-muted">
            <Star size={12} className="fill-accent text-accent" />
            {theme.ratingAvg.toFixed(1)}
          </span>
        ) : kind === "downloads" ? (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold tabular-nums text-ink-muted">
            <ArrowDownToLine size={12} strokeWidth={2.2} />
            {fmtCount(theme.downloads)}
          </span>
        ) : (
          <span className="text-[11.5px] font-semibold tabular-nums text-ink-subtle">{relTime(theme.createdAt)}</span>
        )}
      </span>
    </button>
  );
}
