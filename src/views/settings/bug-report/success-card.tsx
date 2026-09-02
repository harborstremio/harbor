import { Check, GitPullRequest } from "lucide-react";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";

export function SuccessCard({ id, onAnother }: { id: string; onAnother: () => void }) {
  const t = useT();
  return (
    <section className="flex flex-col gap-4 rounded-md bg-elevated p-8">
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Check size={18} strokeWidth={2.4} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[18px] font-semibold text-ink">{t("Report received")}</h2>
          <p className="text-[13.5px] text-ink-muted">
            {t("Tracked as")} <span className="font-mono text-[12.5px] text-ink">{id}</span>.{" "}
            {t(
              "If you left a {service} username, you'll be tagged in the release notes when this lands.",
              { service: "GitHub" },
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onAnother}
          className="h-10 rounded-md bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          {t("File another")}
        </button>
        <button
          type="button"
          onClick={() => openUrl("https://github.com/harborstremio/harbor/pulls")}
          className="flex h-10 items-center gap-2 rounded-md bg-raised px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <GitPullRequest size={14} strokeWidth={1.9} />
          {t("Pitch a fix as a PR")}
        </button>
      </div>
    </section>
  );
}
