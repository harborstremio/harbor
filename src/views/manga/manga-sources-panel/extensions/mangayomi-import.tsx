import { Check, Download, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { importMangayomiRepo } from "@/lib/manga/sources/mangayomi/repo";
import { MangayomiMark } from "./mangayomi-mark";
import { useT } from "@/lib/i18n";

type Phase = "idle" | "running" | "done" | "error";

export function MangayomiImport({ url, count }: { url: string; count: number }) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: count });
  const [result, setResult] = useState({ installed: 0, failed: 0 });

  const run = async () => {
    setPhase("running");
    setProgress({ done: 0, total: count });
    try {
      const r = await importMangayomiRepo(url, (done, total) => setProgress({ done, total }));
      setResult(r);
      setPhase("done");
    } catch {
      setPhase("error");
    }
  };

  if (count === 0 && phase === "idle") {
    return (
      <div className="flex items-start gap-3 border-t border-edge-soft px-5 py-5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas ring-1 ring-edge-soft">
          <MangayomiMark size={22} />
        </span>
        <p className="text-[13px] leading-relaxed text-ink-muted">
          {t(
            "This is a Mangayomi repo, but its sources use Dart or are not manga, so Harbor can't import them.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 border-t border-edge-soft px-5 py-5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas ring-1 ring-edge-soft">
        <MangayomiMark size={22} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          {t(
            "This is a Mangayomi repo. Harbor runs its JavaScript sources natively. Import them to add these sources to your manga library.",
          )}
        </p>

        {phase === "done" ? (
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Check size={16} className="text-accent" />
            <span>
              {result.failed > 0
                ? t("Imported {n} sources, {f} could not load", { n: result.installed, f: result.failed })
                : t("Imported {n} sources", { n: result.installed })}
            </span>
          </div>
        ) : phase === "error" ? (
          <button
            type="button"
            onClick={run}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-raised px-4 py-2.5 text-[14px] font-semibold text-ink ring-1 ring-edge-soft transition-all hover:bg-elevated active:scale-[0.97] motion-reduce:active:scale-100"
          >
            <RefreshCw size={16} />
            {t("Import failed, try again")}
          </button>
        ) : (
          <button
            type="button"
            onClick={run}
            disabled={phase === "running"}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-canvas transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-70 motion-reduce:active:scale-100"
          >
            {phase === "running" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("Importing {done} of {total}", { done: progress.done, total: progress.total })}
              </>
            ) : (
              <>
                <Download size={16} />
                {count > 0
                  ? t("Import {n} JavaScript sources", { n: count })
                  : t("Import JavaScript sources")}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
