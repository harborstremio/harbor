import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { pluginHealth, runnableStreamPlugins, subscribeStreamPlugins } from "@/lib/streams/plugins";

/** Long enough to cover a slow pick, short enough that yesterday's outage is not reported as now. */
const FRESH_MS = 3 * 60_000;

type Outage = { id: string; name: string; note: string };

function read(): Outage[] {
  const now = Date.now();
  const out: Outage[] = [];
  for (const plugin of runnableStreamPlugins()) {
    const health = pluginHealth(plugin.id);
    if (!health?.lastSkip || health.lastAt == null) continue;
    if (now - health.lastAt > FRESH_MS) continue;
    out.push({ id: plugin.id, name: plugin.name, note: health.lastSkip });
  }
  return out;
}

function key(list: Outage[]): string {
  return list.map((o) => `${o.id}|${o.note}`).join("\n");
}

/** Sources that answered with a reason rather than with nothing.
 *
 * An empty picker is the same picture whether a service is down or the title genuinely has no
 * sources, and those are opposite situations for the person looking at it. This is the only place
 * the difference is visible without opening settings. */
export function SourceOutages() {
  const t = useT();
  const [outages, setOutages] = useState<Outage[]>(read);
  useEffect(
    () =>
      subscribeStreamPlugins(() =>
        setOutages((prev) => {
          const next = read();
          return key(prev) === key(next) ? prev : next;
        }),
      ),
    [],
  );
  if (!outages.length) return null;
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-edge-soft/70 bg-canvas/70 px-5 py-4">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.36em] text-ink-subtle">
        {t("Sources unavailable")}
      </p>
      <ul className="flex flex-col gap-1.5">
        {outages.map((o) => (
          <li key={o.id} className="text-[13px] leading-snug text-ink-muted">
            <span className="font-semibold text-ink">{o.name}</span>
            <span className="text-ink-subtle/50"> · </span>
            <span>{o.note}</span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] leading-snug text-ink-subtle">
        {t("The service refused the request, so there was nothing for the plugin to return.")}
      </p>
    </div>
  );
}
