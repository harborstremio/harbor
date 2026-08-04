import { Check, Database, HardDrive, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { clearPickerCache } from "@/lib/picker-cache";
import { clearMangaCache } from "@/lib/manga/api";
import { clearEpg } from "@/lib/iptv/epg-store";
import { clearPlaylistCache } from "@/lib/iptv/store";
import { clearSeriesInfoCache } from "@/lib/iptv/xtream-vod";
import { clearDeadStreams } from "@/lib/dead-streams";
import { clearResurfaceCache } from "@/lib/cw-resurface";
import { settingsAnchor } from "./shared";

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function localStorageBreakdown(): { total: number; top: { key: string; bytes: number }[] } {
  let total = 0;
  const rows: { key: string; bytes: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const bytes = (localStorage.getItem(key)?.length ?? 0) * 2 + key.length * 2;
      total += bytes;
      rows.push({ key, bytes });
    }
  } catch {
    return { total: 0, top: [] };
  }
  rows.sort((a, b) => b.bytes - a.bytes);
  return { total, top: rows.slice(0, 8) };
}

function friendlyKey(key: string): string {
  return key
    .replace(/^harbor\./, "")
    .replace(/\.v\d+$/, "")
    .replace(/[-_.]/g, " ");
}

function ClearRow({ title, sub, onClear }: { title: string; sub: string; onClear: () => void }) {
  const t = useT();
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3200);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const click = () => {
    if (done) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    onClear();
    setArmed(false);
    setDone(true);
    window.setTimeout(() => setDone(false), 2200);
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13.5px] font-medium text-ink">{title}</span>
        <span className="text-[12px] leading-snug text-ink-subtle">{sub}</span>
      </div>
      <button
        type="button"
        onClick={click}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition-colors ${
          done
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            : armed
              ? "border-danger/50 bg-danger/10 text-danger"
              : "border-edge text-ink-muted hover:bg-elevated hover:text-ink"
        }`}
      >
        {done ? <Check size={13} strokeWidth={2.4} /> : <Trash2 size={13} strokeWidth={1.9} />}
        {done ? t("Cleared") : armed ? t("Sure?") : t("Clear")}
      </button>
    </div>
  );
}

export function StoragePanel() {
  const t = useT();
  const [tick, setTick] = useState(0);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [ls, setLs] = useState(localStorageBreakdown);

  const refresh = () => {
    setTick((v) => v + 1);
    setLs(localStorageBreakdown());
  };

  useEffect(() => {
    let alive = true;
    void navigator.storage
      ?.estimate?.()
      .then((e) => {
        if (alive && e && typeof e.usage === "number" && typeof e.quota === "number") {
          setEstimate({ usage: e.usage, quota: e.quota });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);

  const pct =
    estimate && estimate.quota > 0 ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <section
        id={settingsAnchor("Storage overview")}
        className="scroll-mt-28 flex flex-col gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-7"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-canvas/60 text-ink-muted">
            <HardDrive size={17} strokeWidth={1.9} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">
              {t("Storage overview")}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t(
                "Everything Harbor saves lives on this computer. If space runs low, clear a cache below; Harbor rebuilds them as you browse.",
              )}
            </p>
          </div>
        </div>

        {estimate && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span className="font-medium text-ink">
                {t("App storage")}: {fmtBytes(estimate.usage)}
              </span>
              <span className="text-ink-subtle">
                {t("{quota} available", { quota: fmtBytes(estimate.quota) })}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-canvas/70">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${Math.max(1, pct)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-subtle">
            {t("Settings storage")}: {fmtBytes(ls.total)}
          </span>
          <div className="flex flex-col gap-1">
            {ls.top.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="min-w-0 truncate capitalize text-ink-muted">
                  {friendlyKey(row.key)}
                </span>
                <span className="shrink-0 tabular-nums text-ink-subtle">{fmtBytes(row.bytes)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id={settingsAnchor("Clear caches")}
        className="scroll-mt-28 flex flex-col gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-7"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-canvas/60 text-ink-muted">
            <Database size={17} strokeWidth={1.9} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">{t("Clear caches")}</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t(
                "Safe to clear anytime. Nothing here touches your watch history, library, themes, or sign-ins.",
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <ClearRow
            title={t("Stream picker cache")}
            sub={t(
              "Remembered source lists per title. Clears stale results after changing addons or debrid.",
            )}
            onClear={() => {
              clearPickerCache();
              refresh();
            }}
          />
          <ClearRow
            title={t("Manga browse cache")}
            sub={t("Cached chapter lists and browse pages. Downloads stay untouched.")}
            onClear={() => {
              clearMangaCache();
              refresh();
            }}
          />
          <ClearRow
            title={t("Live TV caches")}
            sub={t("Parsed playlists, program guide, and series info. Re-downloads on next open.")}
            onClear={() => {
              clearEpg();
              clearPlaylistCache();
              clearSeriesInfoCache();
              refresh();
            }}
          />
          <ClearRow
            title={t("Dead stream marks")}
            sub={t("Sources Harbor flagged as broken. Clear to give them another chance.")}
            onClear={() => {
              clearDeadStreams();
              refresh();
            }}
          />
          <ClearRow
            title={t("Continue Watching suggestions cache")}
            sub={t("Resurface picks for the home rail. Rebuilds overnight.")}
            onClear={() => {
              clearResurfaceCache();
              refresh();
            }}
          />
        </div>

        <p className="text-[12px] leading-relaxed text-ink-subtle">
          {t(
            "Downloaded themes are managed in Theme & appearance. Video and manga downloads are managed on the Downloads page.",
          )}
        </p>
      </section>
    </div>
  );
}
