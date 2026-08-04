import { Loader2, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";

const SHELL =
  "animate-fade-in mx-auto flex min-h-[86vh] max-w-2xl flex-col items-center justify-center gap-6 px-12 pt-[9vh] text-center";

export function MangaBootstrap() {
  const t = useT();
  return (
    <main className={SHELL}>
      <Loader2
        size={28}
        strokeWidth={1.9}
        className="animate-spin text-ink-subtle motion-reduce:animate-none"
      />
      <div className="flex flex-col gap-2">
        <h1 className="text-[17px] font-medium text-ink">{t("Loading your manga sources")}</h1>
        <p className="max-w-sm text-balance text-[13.5px] leading-relaxed text-ink-muted">
          {t("This only takes a moment the first time.")}
        </p>
      </div>
    </main>
  );
}

export function MangaBootstrapError({
  onRetry,
  onManageSources,
}: {
  onRetry: () => void;
  onManageSources: () => void;
}) {
  const t = useT();
  return (
    <main className={SHELL}>
      <img
        src="/manga/manga-source-error.webp"
        alt=""
        width={420}
        height={420}
        draggable={false}
        decoding="async"
        className="aspect-square w-52 max-w-full object-contain drop-shadow-[0_16px_36px_rgba(0,0,0,0.4)]"
      />
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[26px] font-medium leading-tight text-ink">
          {t("Could not reach the source list")}
        </h1>
        <p className="mx-auto max-w-md text-balance text-[14px] leading-relaxed text-ink-muted">
          {t(
            "Your sources are saved, we just could not load their details. Check your connection and try again.",
          )}
        </p>
      </div>
      <div className="mt-1 flex items-center gap-2.5">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          <RotateCcw size={16} strokeWidth={2.2} />
          {t("Try again")}
        </button>
        <button
          type="button"
          onClick={onManageSources}
          className="inline-flex h-11 items-center rounded-xl border border-edge-soft bg-elevated/40 px-5 text-[14px] font-medium text-ink-muted transition-colors hover:bg-elevated/70 hover:text-ink"
        >
          {t("Manage sources")}
        </button>
      </div>
    </main>
  );
}
