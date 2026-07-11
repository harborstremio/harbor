import { BetaTag } from "@/components/beta-tag";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { currentVersion, type VersionEntry } from "@/lib/updater/versions";
import { openUrl } from "@/lib/window";
import { History, RotateCw } from "lucide-react";

import { useVersionHistory } from "./rollback-row/use-version-history";
import { VersionItem } from "./rollback-row/version-item";

const RELEASES_URL = "https://github.com/harborstremio/harbor/releases";

export function RollbackRow() {
  const t = useT();
  const { settings } = useSettings();
  const { state, reload } = useVersionHistory(settings.betaUpdates);

  if (!settings.betaUpdates) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-ink-subtle">
          <History size={15} strokeWidth={2.2} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
            {t("Roll back to an earlier build")}
            <BetaTag />
          </span>
          <p className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t(
              "On a beta that's giving you trouble? Pick an earlier build below and run its installer over your current copy. Your library, settings, and downloads all stay put.",
            )}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-edge-soft/70 bg-canvas/50">
        {state.status === "loading" ? (
          <HistorySkeleton />
        ) : state.status === "error" ? (
          <HistoryError onRetry={reload} />
        ) : (
          <VersionList versions={state.versions} />
        )}
      </div>

      <p className="text-[11.5px] leading-relaxed text-ink-subtle">
        {t(
          "While beta updates are on, Harbor offers the newest build again on its next check. Turn beta updates off above to stay on an earlier one.",
        )}
      </p>
    </div>
  );
}

function VersionList({ versions }: { versions: VersionEntry[] }) {
  const t = useT();
  const display = withCurrent(versions);
  const hasOthers = display.some((v) => v.version !== currentVersion);

  if (!hasOthers) {
    return (
      <div className="px-3.5 py-5 text-center text-[12px] leading-relaxed text-ink-subtle">
        {t("You're on the latest build. Earlier builds show up here as new versions ship.")}
      </div>
    );
  }

  return (
    <div className="max-h-[272px] divide-y divide-edge-soft/50 overflow-y-auto">
      {display.map((v) => (
        <VersionItem key={v.version} entry={v} isCurrent={v.version === currentVersion} />
      ))}
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="divide-y divide-edge-soft/50">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-3">
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-16 animate-pulse rounded bg-raised" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-raised/60" />
          </div>
          <div className="h-7 w-20 animate-pulse rounded-lg bg-raised" />
        </div>
      ))}
    </div>
  );
}

function HistoryError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-start gap-2.5 px-3.5 py-4">
      <p className="text-[12px] leading-relaxed text-ink-subtle">
        {t("Couldn't reach harbor.site to load earlier builds. Check your connection and try again.")}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-edge bg-elevated px-3 text-[12px] font-semibold text-ink transition-all hover:scale-[1.02] hover:border-ink active:scale-[0.97]"
        >
          <RotateCw size={13} strokeWidth={2.4} />
          {t("Try again")}
        </button>
        <button
          type="button"
          onClick={() => openUrl(RELEASES_URL)}
          className="text-[12px] font-semibold text-ink-subtle underline-offset-2 hover:text-ink hover:underline"
        >
          {t("Browse all releases")}
        </button>
      </div>
    </div>
  );
}

function withCurrent(versions: VersionEntry[]): VersionEntry[] {
  const list = versions.filter((v) => v && typeof v.version === "string");
  if (!list.some((v) => v.version === currentVersion)) {
    list.push({ version: currentVersion });
  }
  return list.sort((a, b) => compareVersions(b.version, a.version));
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
