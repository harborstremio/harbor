import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { ImportPhase, ImportProgress } from "@/lib/ratings/import/types";
import type { ImportOutcome } from "./use-ratings-import";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const CAPTIONS: Record<ImportPhase, string> = {
  auth: "Checking your connection",
  fetch: "Reading your ratings from {name}",
  resolve: "Matching titles to Harbor",
  write: "Saving to your profile",
  done: "Wrapping up",
};

function percentOf(p: ImportProgress): number | null {
  if (p.phase === "auth" || p.phase === "done") return null;
  const total = p.total ?? 0;
  if (total <= 0) return null;
  const at = p.phase === "write" ? p.written : p.phase === "resolve" ? p.resolved : p.fetched;
  return Math.max(0, Math.min(100, Math.round((at / total) * 100)));
}

export function ImportProgressPanel({
  label,
  progress,
  cancelling,
  onCancel,
}: {
  label: string;
  progress: ImportProgress;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const t = useT();
  const percent = percentOf(progress);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Loader2 size={18} className="shrink-0 animate-spin text-ink-subtle" />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium text-ink">
            {t(CAPTIONS[progress.phase], { name: label })}
          </div>
          {progress.message && (
            <div className="truncate text-[12px] text-ink-subtle">{t(progress.message)}</div>
          )}
        </div>
      </div>

      {percent !== null && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("Found")} value={progress.fetched} />
        <Stat label={t("Matched")} value={progress.resolved} />
        <Stat label={t("Saved")} value={progress.written} />
      </div>

      {progress.failed > 0 && (
        <p className="text-[12px] text-ink-subtle">
          {t("{n} could not be matched so far", { n: progress.failed })}
        </p>
      )}

      <button
        type="button"
        onClick={onCancel}
        disabled={cancelling}
        className="inline-flex min-h-11 items-center justify-center self-start rounded-md px-4 text-[14px] font-medium text-ink-muted transition-colors hover:bg-surface disabled:opacity-50"
      >
        {cancelling ? t("Cancelling") : t("Cancel import")}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-edge-soft bg-canvas/40 px-3 py-2.5">
      <div className="text-[18px] font-semibold tabular-nums text-ink">{value}</div>
      <div className="text-[11.5px] text-ink-subtle">{label}</div>
    </div>
  );
}

export function ImportSummaryPanel({
  outcome,
  saved,
  cancelled,
  onDone,
  onAgain,
}: {
  outcome: ImportOutcome | null;
  saved: number;
  cancelled: boolean;
  onDone: () => void;
  onAgain: () => void;
}) {
  const t = useT();
  const good = !cancelled && (outcome?.imported ?? 0) > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        {good ? (
          <CircleCheck size={20} className="mt-0.5 shrink-0 text-success" />
        ) : (
          <CircleAlert size={20} className="mt-0.5 shrink-0 text-ink-subtle" />
        )}
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-ink">
            {cancelled
              ? t("Import cancelled")
              : good && outcome
                ? t("Imported {n} ratings from {name}", {
                    n: outcome.imported,
                    name: outcome.sourceLabel,
                  })
                : t("Nothing was imported")}
          </div>
          {cancelled && (
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {saved > 0
                ? t("{n} ratings were saved before you stopped.", { n: saved })
                : t("Nothing was saved.")}
            </p>
          )}
        </div>
      </div>

      {!cancelled && outcome && <Breakdown outcome={outcome} t={t} />}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          {t("Done")}
        </button>
        <button
          type="button"
          onClick={onAgain}
          className="inline-flex min-h-11 items-center rounded-md px-4 text-[14px] font-medium text-ink-muted transition-colors hover:bg-surface"
        >
          {t("Import from another source")}
        </button>
      </div>
    </div>
  );
}

function Breakdown({ outcome, t }: { outcome: ImportOutcome; t: Translate }) {
  const extra = Math.max(0, outcome.unmatched - outcome.samples.length);
  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-1.5 rounded-[12px] border border-edge-soft bg-canvas/40 px-3.5 py-3">
        <Line label={t("Imported")} value={outcome.imported} strong />
        {outcome.skipped > 0 && (
          <Line label={t("Skipped, not rated or not supported")} value={outcome.skipped} />
        )}
        {outcome.unmatched > 0 && (
          <Line label={t("Could not be matched")} value={outcome.unmatched} />
        )}
        {outcome.writeFailed > 0 && (
          <Line label={t("Failed to save")} value={outcome.writeFailed} />
        )}
      </dl>

      {outcome.manga > 0 && (
        <p className="text-[12px] text-ink-subtle">
          {t("Manga cannot be matched to a Harbor title yet, so {n} were left out.", {
            n: outcome.manga,
          })}
        </p>
      )}

      {outcome.samples.length > 0 && (
        <div>
          <div className="mb-1.5 text-[12px] font-medium text-ink-muted">
            {t("Harbor could not find these")}
          </div>
          <ul className="flex flex-col gap-1">
            {outcome.samples.map((title, i) => (
              <li key={`${i}-${title}`} className="truncate text-[12.5px] text-ink-subtle">
                {title}
              </li>
            ))}
          </ul>
          {extra > 0 && (
            <p className="mt-1.5 text-[12px] text-ink-subtle">
              {t("and {n} more", { n: extra })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-[13px] ${strong ? "text-ink" : "text-ink-muted"}`}>{label}</dt>
      <dd
        className={`shrink-0 tabular-nums ${strong ? "text-[15px] font-semibold text-ink" : "text-[13px] text-ink-muted"}`}
      >
        {value}
      </dd>
    </div>
  );
}
