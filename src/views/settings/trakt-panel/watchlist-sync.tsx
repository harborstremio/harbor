import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { library } from "@/lib/stremio";
import { TraktApiError } from "@/lib/trakt/client";
import type { TraktItem } from "@/lib/trakt/types";
import { fetchTraktWatchlist, planExport, runExport, runImport, type ExportPlan } from "@/lib/trakt/watchlist-sync";
import { readLocalEntries } from "@/lib/watchlist";
import { Check, Download, Loader2, Upload } from "lucide-react";
import { useState } from "react";

function traktErrorMessage(t: ReturnType<typeof useT>, err: unknown): string {
  if (err instanceof TraktApiError) {
    if (err.status === 401) return t("Trakt sign-in expired. Reconnect Trakt in settings and try again.");
    if (err.status === 403 || err.status === 423)
      return t("Trakt rejected the request (account locked or permission denied).");
    if (err.status === 420) return t("Trakt account limit reached. Upgrade to Trakt VIP or trim your watchlist.");
    if (err.status === 429) return t("Trakt is rate-limiting. Wait a minute and try again.");
    if (err.status >= 500) return t("Trakt is having server trouble (HTTP {n}). Try again shortly.", { n: err.status });
    return t("Trakt rejected the request (HTTP {n}).", { n: err.status });
  }
  return t("Couldn't reach Trakt. Check your connection and try again.");
}

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; dir: "export" | "import" }
  | { kind: "confirm-export"; plan: ExportPlan }
  | { kind: "confirm-import"; items: TraktItem[] }
  | { kind: "running"; label: string }
  | { kind: "result"; message: string; tone: "ok" | "warn" };

export function WatchlistSync() {
  const t = useT();
  const { authKey } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  if (!authKey) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-subtle">
        {t("Sign in to Stremio first so Harbor knows which watchlist to sync.")}
      </p>
    );
  }

  const startExport = async () => {
    setPhase({ kind: "loading", dir: "export" });
    try {
      const lib = await library(authKey);
      const sources = [
        ...lib.map((i) => ({ id: i._id, type: i.type, removed: i.removed, temp: i.temp })),
        ...readLocalEntries().map((e) => ({ id: e.id, type: e.type })),
      ];
      const plan = planExport(sources);
      if (plan.movies.length + plan.shows.length === 0) {
        setPhase({
          kind: "result",
          tone: "warn",
          message:
            plan.skippedAnime > 0
              ? t("Nothing to send. All {n} watchlist items are anime, which Trakt can't track.", {
                  n: plan.skippedAnime,
                })
              : t("Your watchlist is empty, nothing to send."),
        });
        return;
      }
      setPhase({ kind: "confirm-export", plan });
    } catch (err) {
      console.error("[trakt] read watchlist failed", err);
      setPhase({ kind: "result", tone: "warn", message: t("Couldn't read your watchlist. Try again.") });
    }
  };

  const confirmExport = async (plan: ExportPlan) => {
    setPhase({ kind: "running", label: t("Sending to Trakt…") });
    try {
      const r = await runExport(plan);
      const bits = [t("Sent {n} to Trakt", { n: r.synced })];
      if (r.skippedAnime > 0) bits.push(t("skipped {n} anime", { n: r.skippedAnime }));
      if (r.unmatched > 0) bits.push(t("{n} not matched", { n: r.unmatched }));
      setPhase({ kind: "result", tone: "ok", message: bits.join(" · ") });
    } catch (err) {
      console.error("[trakt] export failed", err);
      setPhase({ kind: "result", tone: "warn", message: traktErrorMessage(t, err) });
    }
  };

  const startImport = async () => {
    setPhase({ kind: "loading", dir: "import" });
    try {
      const items = await fetchTraktWatchlist();
      if (items.length === 0) {
        setPhase({ kind: "result", tone: "warn", message: t("Your Trakt watchlist is empty, nothing to import.") });
        return;
      }
      setPhase({ kind: "confirm-import", items });
    } catch (err) {
      console.error("[trakt] read trakt watchlist failed", err);
      setPhase({ kind: "result", tone: "warn", message: traktErrorMessage(t, err) });
    }
  };

  const confirmImport = async (items: TraktItem[]) => {
    setPhase({ kind: "running", label: t("Importing {done} / {total}", { done: 0, total: items.length }) });
    try {
      const r = await runImport(authKey, items, (done, total) =>
        setPhase({ kind: "running", label: t("Importing {done} / {total}", { done, total }) }),
      );
      setPhase({ kind: "result", tone: "ok", message: t("Added {n} to your Harbor watchlist", { n: r.added }) });
    } catch (err) {
      console.error("[trakt] import failed", err);
      setPhase({ kind: "result", tone: "warn", message: traktErrorMessage(t, err) });
    }
  };

  if (phase.kind === "confirm-export" || phase.kind === "confirm-import") {
    const isExport = phase.kind === "confirm-export";
    const count =
      phase.kind === "confirm-export" ? phase.plan.movies.length + phase.plan.shows.length : phase.items.length;
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-edge bg-canvas/50 p-4">
        <p className="text-[13.5px] leading-relaxed text-ink">
          {isExport
            ? t("Add {n} titles from your Harbor watchlist to Trakt? Trakt skips any it already has.", { n: count })
            : t("Add {n} titles from your Trakt watchlist to Harbor?", { n: count })}
        </p>
        {phase.kind === "confirm-export" && phase.plan.skippedAnime > 0 && (
          <p className="text-[12px] text-ink-subtle">
            {t("{n} anime titles will be left out (Trakt has no IDs for them).", { n: phase.plan.skippedAnime })}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => (phase.kind === "confirm-export" ? confirmExport(phase.plan) : confirmImport(phase.items))}
            className="flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
          >
            {isExport ? <Upload size={14} strokeWidth={2.2} /> : <Download size={14} strokeWidth={2.2} />}
            {t("Continue")}
          </button>
          <button
            onClick={() => setPhase({ kind: "idle" })}
            className="h-10 rounded-lg px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {t("Cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === "running") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3 text-[13px] text-ink-muted">
        <Loader2 size={15} className="animate-spin" />
        {phase.label}
      </div>
    );
  }

  if (phase.kind === "result") {
    return (
      <div className="flex flex-col gap-3">
        <div
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13px] ${
            phase.tone === "ok"
              ? "border-emerald-400/30 bg-emerald-400/8 text-emerald-200"
              : "border-amber-400/30 bg-amber-400/8 text-amber-200"
          }`}
        >
          {phase.tone === "ok" && <Check size={15} strokeWidth={2.4} />}
          {phase.message}
        </div>
        <button
          onClick={() => setPhase({ kind: "idle" })}
          className="h-9 self-start rounded-lg px-2 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
        >
          {t("Done")}
        </button>
      </div>
    );
  }

  const loadingDir = phase.kind === "loading" ? phase.dir : null;
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        onClick={startExport}
        disabled={phase.kind === "loading"}
        className="flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
      >
        {loadingDir === "export" ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Upload size={15} strokeWidth={2.2} />
        )}
        {t("Export to Trakt")}
      </button>
      <button
        onClick={startImport}
        disabled={phase.kind === "loading"}
        className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-50"
      >
        {loadingDir === "import" ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Download size={15} strokeWidth={2.2} />
        )}
        {t("Import from Trakt")}
      </button>
    </div>
  );
}
