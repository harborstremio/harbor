import { CloudOff, KeyRound, RotateCw, SlidersHorizontal } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useT } from "@/lib/i18n";

const GHOST_LEDGER = [30, 34, 24, 12];

function delayVar(delay: number): CSSProperties {
  return { "--ai-delay": `${delay}ms` } as CSSProperties;
}

export function LoadingState({ hero }: { hero: boolean }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {hero && <HeroSkeleton />}
      <ul className="flex flex-col gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <RowSkeleton delay={i * 60} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="flex items-end gap-6 rounded-lg bg-elevated p-8">
      <div className="harbor-shimmer relative h-[188px] w-[128px] shrink-0 rounded-lg" style={delayVar(0)} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 pb-2">
        <div className="harbor-shimmer relative h-3 w-24 rounded-md" style={delayVar(60)} />
        <div className="harbor-shimmer relative h-12 w-3/5 rounded-lg" style={delayVar(120)} />
        <div className="harbor-shimmer relative h-4 w-2/5 rounded-md" style={delayVar(180)} />
        <div className="harbor-shimmer relative mt-2 h-10 w-32 rounded-lg" style={delayVar(240)} />
      </div>
    </div>
  );
}

function RowSkeleton({ delay }: { delay: number }) {
  return (
    <div className="flex items-center gap-5 rounded-lg bg-elevated p-5">
      <div className="harbor-shimmer relative h-14 w-12 shrink-0 rounded-lg" style={delayVar(delay)} />
      <div className="harbor-shimmer relative h-[152px] w-[104px] shrink-0 rounded-lg" style={delayVar(delay)} />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="harbor-shimmer relative h-5 w-2/5 rounded-md" style={delayVar(delay)} />
        <div className="harbor-shimmer relative h-3 w-1/4 rounded-md" style={delayVar(delay)} />
        <div className="harbor-shimmer relative mt-1 h-3 w-3/5 rounded-md" style={delayVar(delay)} />
        <div className="mt-2 flex h-1.5 gap-px overflow-hidden rounded-full">
          {GHOST_LEDGER.map((w, i) => (
            <span key={i} className="h-full bg-ink/10" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
        <div className="harbor-shimmer relative h-9 w-14 rounded-md" style={delayVar(delay)} />
        <div className="harbor-shimmer relative h-3 w-20 rounded-md" style={delayVar(delay)} />
      </div>
    </div>
  );
}

export function OfflinePill() {
  const t = useT();
  return (
    <div className="flex items-center gap-2 self-start rounded-full bg-white/[0.06] px-3.5 py-2 text-[12.5px] text-ink-muted">
      <CloudOff size={14} strokeWidth={2} className="text-ink-subtle" aria-hidden />
      {t("Showing last synced ranking")}
    </div>
  );
}

export function EmptyFiltersState({ onClear }: { onClear: () => void }) {
  const t = useT();
  return (
    <StateShell
      icon={<SlidersHorizontal size={20} strokeWidth={2} className="text-ink-subtle" />}
      title={t("No people match these filters")}
      body={t("Widen the department or country to see more.")}
      action={<ActionButton onClick={onClear}>{t("Clear filters")}</ActionButton>}
    />
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const t = useT();
  return (
    <StateShell
      title={t("Couldn't load rankings")}
      body={t("Something went wrong reaching the ranking feed.")}
      action={
        onRetry ? (
          <ActionButton onClick={onRetry}>
            <RotateCw size={15} strokeWidth={2.2} />
            {t("Retry")}
          </ActionButton>
        ) : null
      }
    />
  );
}

export function NoKeyState({ onOpenSettings }: { onOpenSettings: () => void }) {
  const t = useT();
  return (
    <StateShell
      icon={<KeyRound size={20} strokeWidth={2} className="text-ink-subtle" />}
      title={t("Add a TMDB key to load rankings")}
      body={t("Trending and Top on TMDB read live data, which needs your own TMDB key.")}
      action={<ActionButton onClick={onOpenSettings}>{t("Open settings")}</ActionButton>}
    />
  );
}

function StateShell({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg bg-elevated px-8 py-14 text-center">
      {icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
          {icon}
        </span>
      )}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <p className="text-[13px] leading-relaxed text-ink-muted">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      {children}
    </button>
  );
}
