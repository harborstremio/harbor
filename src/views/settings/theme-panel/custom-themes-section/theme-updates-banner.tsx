import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useThemeUpdates, type ThemeUpdate } from "./use-theme-updates";

export function ThemeUpdatesBanner() {
  const t = useT();
  const { updates, busy, updateOne } = useThemeUpdates();
  const [done, setDone] = useState<string[]>([]);
  const [all, setAll] = useState(false);

  if (updates.length === 0) return null;

  const run = async (u: ThemeUpdate) => {
    await updateOne(u);
    setDone((d) => [...d, u.storeId]);
  };

  const runAll = async () => {
    setAll(true);
    for (const u of updates) await run(u);
    setAll(false);
  };

  return (
    <section className="animate-lift-in flex flex-col gap-3 rounded-md bg-elevated px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
          {t("Updates")}
          <span className="animate-badge-pop rounded-[3px] bg-accent px-1.5 py-px text-[10.5px] font-bold tabular-nums text-canvas">
            {updates.length}
          </span>
        </span>
        <span className="min-w-0 flex-1 text-[12.5px] text-ink-subtle">
          {t("New versions are ready for themes you saved.")}
        </span>
        {updates.length > 1 && (
          <button
            type="button"
            onClick={runAll}
            disabled={all || !!busy}
            className="harbor-press-pop flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {all && <Loader2 size={12} className="animate-spin" />}
            {t("Update all")}
          </button>
        )}
      </div>

      <div className="harbor-cascade flex flex-col gap-1">
        {updates.map((u) => {
          const working = busy === u.storeId;
          const finished = done.includes(u.storeId);
          return (
            <div
              key={u.storeId}
              className="flex items-center gap-3 rounded-[4px] bg-canvas px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{u.name}</span>
              <span className="shrink-0 text-[11.5px] tabular-nums text-ink-subtle">
                v{u.from} <span className="px-0.5 text-ink-subtle/60">&rarr;</span> v{u.to}
              </span>
              <button
                type="button"
                onClick={() => void run(u)}
                disabled={working || finished}
                className={`harbor-press-pop flex h-8 w-[86px] shrink-0 items-center justify-center gap-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${
                  finished ? "bg-elevated text-ink-subtle" : "bg-ink text-canvas hover:opacity-90"
                } disabled:opacity-60`}
              >
                {working ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : finished ? (
                  <>
                    <Check size={12} strokeWidth={2.6} className="animate-badge-pop" />
                    {t("Done")}
                  </>
                ) : (
                  t("Update")
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
