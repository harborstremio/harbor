import { openUrl } from "@/lib/window";
import { Check, GitPullRequest } from "lucide-react";

export function SuccessCard({ id, onAnother }: { id: string; onAnother: () => void }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-8">
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Check size={18} strokeWidth={2.4} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[18px] font-semibold text-ink">Report received</h2>
          <p className="text-[13.5px] text-ink-muted">
            Tracked as <span className="font-mono text-[12px] text-ink">{id}</span>. If you left a GitHub username,
            you'll be tagged in the release notes when this lands.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onAnother}
          className="h-10 rounded-xl bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          File another
        </button>
        <button
          type="button"
          onClick={() => openUrl("https://github.com/harborstremio/harbor/pulls")}
          className="flex h-10 items-center gap-2 rounded-xl border border-edge-soft bg-elevated px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <GitPullRequest size={13} strokeWidth={1.9} />
          Pitch a fix as a PR
        </button>
      </div>
    </section>
  );
}
