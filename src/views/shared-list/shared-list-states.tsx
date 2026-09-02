import { ListX } from "lucide-react";

export function SharedListLoading() {
  return (
    <div className="flex w-full flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-4">
        <div className="h-[88px] w-[88px] animate-pulse rounded-full bg-elevated/50" />
        <div className="h-3.5 w-40 animate-pulse rounded bg-elevated/40" />
        <div className="h-9 w-64 animate-pulse rounded-lg bg-elevated/45" />
        <div className="h-3 w-24 animate-pulse rounded bg-elevated/30" />
      </div>
      <div className="grid w-full grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-[12px] bg-elevated/40" />
        ))}
      </div>
    </div>
  );
}

export function SharedListMissing({
  kind,
  onBack,
  onRetry,
}: {
  kind: "missing" | "error";
  onBack: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-surface ring-1 ring-edge-soft">
        <ListX size={26} strokeWidth={1.7} className="text-ink-subtle" />
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[22px] text-ink">
          {kind === "error" ? "Could not load this list" : "List not found"}
        </h2>
        <p className="max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
          {kind === "error"
            ? "Something went wrong reaching Harbor. Check your connection and try again."
            : "This list may be private, unlisted, or no longer shared by its maker."}
        </p>
      </div>
      <div className="mt-1 flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center rounded-md bg-surface px-4 text-[14px] font-medium text-ink ring-1 ring-edge transition-colors hover:bg-raised"
        >
          Go back
        </button>
        {kind === "error" && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center rounded-md bg-ink px-4 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
