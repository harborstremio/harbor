import { Loader2, RotateCw } from "lucide-react";
import { useT } from "@/lib/i18n";

export function AnimeRowStatus({ title, loading = false, onRetry }: {
  title: string; loading?: boolean; onRetry: () => void;
}) {
  const t = useT();
  return (
    <section className="px-1 py-5" aria-label={title} aria-busy={loading}>
      <h2 className="mb-3 font-display text-[26px] font-medium text-ink/85">{title}</h2>
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
        <span role="status" className="inline-flex items-center gap-2">
          {loading && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {loading ? t("Loading...") : t("Could not load {name}. Try again.", { name: title })}
        </span>
        {!loading && <button type="button" onClick={onRetry}
          className="inline-flex min-h-9 items-center gap-2 rounded-md bg-elevated px-3 text-sm font-medium text-ink transition-colors hover:bg-ink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <RotateCw size={14} aria-hidden="true" />{t("common.retry")}
        </button>}
      </div>
    </section>
  );
}
