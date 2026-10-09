import { useT } from "@/lib/i18n";
import { PeopleSearchIcon } from "@/views/profile/people-search-icon";

export function GroupsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="harbor-shimmer relative flex h-[148px] flex-col gap-3 rounded-lg p-4 ring-1 ring-edge-soft" style={{ ["--ai-delay" as string]: `${i * 90}ms` }}>
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 shrink-0 rounded-full bg-elevated" />
            <span className="flex flex-1 flex-col gap-2">
              <span className="h-3.5 w-1/2 rounded-full bg-elevated" />
              <span className="h-2.5 w-1/3 rounded-full bg-elevated/70" />
            </span>
          </div>
          <span className="h-2.5 w-full rounded-full bg-elevated/70" />
          <span className="h-2.5 w-3/4 rounded-full bg-elevated/50" />
        </div>
      ))}
    </div>
  );
}

export function GroupsEmpty({ query, onCreate }: { query: string; onCreate?: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-edge bg-surface/40 px-6 py-16 text-center">
      <PeopleSearchIcon size={40} className="text-ink-subtle" />
      <div className="flex max-w-sm flex-col gap-1">
        <span className="text-[15px] font-semibold text-ink">
          {query ? t("No groups match “{q}”", { q: query }) : t("No public groups yet")}
        </span>
        <span className="text-[13px] leading-relaxed text-ink-subtle">
          {t("Groups are where people watch and read together. Start one and invite your friends.")}
        </span>
      </div>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-1 flex h-10 items-center rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97]"
        >
          {t("Create a group")}
        </button>
      )}
    </div>
  );
}

export function GroupsError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-edge bg-surface/40 px-6 py-16 text-center">
      <span className="text-[13.5px] text-ink-muted">{t("Could not load groups.")}</span>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-9 items-center rounded-full border border-edge-soft px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
      >
        {t("Try again")}
      </button>
    </div>
  );
}
