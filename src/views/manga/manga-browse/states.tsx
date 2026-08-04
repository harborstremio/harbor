import { RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";

const GRID = "repeat(auto-fill, minmax(150px, 1fr))";

export function SkeletonGrid({ count = 24 }: { count?: number }) {
  return (
    <div className="grid gap-x-4 gap-y-7" style={{ gridTemplateColumns: GRID }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <div className="aspect-[2/3] w-full rounded-xl bg-elevated/50 motion-safe:animate-pulse" />
          <div className="h-3 w-3/4 rounded-full bg-elevated/40 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function RetryButton({ onRetry, label }: { onRetry: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="mt-1 inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      <RotateCcw size={16} strokeWidth={2.2} />
      {label}
    </button>
  );
}

export function BrowseError({
  onRetry,
  onManageSources,
}: {
  onRetry: () => void;
  onManageSources: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-[15px] font-medium text-ink">{t("This source did not respond")}</p>
      <p className="max-w-sm text-balance text-[13px] leading-relaxed text-ink-muted">
        {t("It may be rate limiting or temporarily down. Try again, or switch to another source.")}
      </p>
      <div className="mt-1 flex items-center gap-2.5">
        <RetryButton onRetry={onRetry} label={t("Try again")} />
        <button
          type="button"
          onClick={onManageSources}
          className="mt-1 inline-flex h-11 items-center rounded-xl border border-edge-soft bg-elevated/40 px-5 text-[14px] font-medium text-ink-muted transition-colors hover:bg-elevated/70 hover:text-ink"
        >
          {t("Manage sources")}
        </button>
      </div>
    </div>
  );
}

export function BrowseEmpty({
  kind,
  onRetry,
}: {
  kind: "favorites" | "search" | "source";
  onRetry: () => void;
}) {
  const t = useT();
  if (kind === "favorites") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="text-[14px] font-medium text-ink-muted">{t("No favorites yet")}</p>
        <p className="text-[12.5px] text-ink-subtle">
          {t("Tap the star on any manga to save it here.")}
        </p>
      </div>
    );
  }
  if (kind === "search") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="text-[14px] font-medium text-ink-muted">{t("No manga found")}</p>
        <p className="text-[12.5px] text-ink-subtle">
          {t("Try a different title or clear your filters.")}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-[15px] font-medium text-ink">{t("This source returned nothing")}</p>
      <p className="max-w-sm text-balance text-[13px] leading-relaxed text-ink-muted">
        {t("That is unusual for a popular listing. It is likely a hiccup on their end.")}
      </p>
      <RetryButton onRetry={onRetry} label={t("Try again")} />
    </div>
  );
}
