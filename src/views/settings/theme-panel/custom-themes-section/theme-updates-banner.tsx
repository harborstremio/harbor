import { Check, Loader2 } from "../../icons";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { ROW_TITLE } from "../../shared";
import { SButton } from "../../ui";
import { useThemeUpdates, type ThemeUpdate } from "./use-theme-updates";

const COUNT_BADGE =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-accent px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] tabular-nums text-canvas";

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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <span className="flex items-center gap-2">
          <span className="harbor-settings-label">{t("Updates")}</span>
          <span className={`animate-badge-pop ${COUNT_BADGE}`}>{updates.length}</span>
        </span>
        <span className="min-w-0 flex-1 max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
          {t("New versions are ready for themes you saved.")}
        </span>
        {updates.length > 1 && (
          <SButton variant="primary" onClick={runAll} disabled={all || !!busy}>
            {all && <Loader2 size={18} className="animate-spin" />}
            {t("Update all")}
          </SButton>
        )}
      </div>

      <div className="harbor-cascade harbor-settings-group">
        {updates.map((u) => {
          const working = busy === u.storeId;
          const finished = done.includes(u.storeId);
          return (
            <div key={u.storeId} className="hset-row">
              <span className="hset-row-text">
                <span className={`hset-row-title min-w-0 truncate ${ROW_TITLE}`}>{u.name}</span>
              </span>
              <span className="hset-row-control">
                <span className="shrink-0 text-[15.5px] leading-[22px] tabular-nums text-ink-subtle">
                  v{u.from} <span className="px-0.5 text-ink-subtle/60">&rarr;</span> v{u.to}
                </span>
                <SButton
                  variant={finished ? "secondary" : "primary"}
                  onClick={() => void run(u)}
                  disabled={working || finished}
                  className="min-w-[110px] justify-center"
                >
                  {working ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : finished ? (
                    <>
                      <Check size={18} strokeWidth={2.6} className="animate-badge-pop" />
                      {t("Done")}
                    </>
                  ) : (
                    t("Update")
                  )}
                </SButton>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
