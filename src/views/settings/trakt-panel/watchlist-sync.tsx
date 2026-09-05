import { Check, Download, Info, Loader2, Upload } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { library } from "@/lib/stremio";
import { readLocalEntries } from "@/lib/watchlist";
import { useT } from "@/lib/i18n";
import { ROW_ACTION, ROW_ACTION_PRIMARY, ROW_DESC, SettingRow } from "../kit";
import {
  fetchTraktWatchlist,
  planExport,
  runExport,
  runImport,
  type ExportPlan,
} from "@/lib/trakt/watchlist-sync";
import { TraktApiError } from "@/lib/trakt/client";
import type { TraktItem } from "@/lib/trakt/types";

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

function Callout({ glyph, children }: { glyph: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated p-4">
      <span className="mt-[2px] flex shrink-0 items-center">{glyph}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </div>
  );
}

export function WatchlistSync() {
  const t = useT();
  const { authKey } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const signIn = t("Sign in to Stremio first so Harbor knows which watchlist to sync.");
  const locked = !authKey;
  const busy = phase.kind !== "idle" && phase.kind !== "result";

  const startExport = async () => {
    if (!authKey) return;
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
              ? t("Nothing to send. All {n} watchlist items are anime, which Trakt can't track.", { n: plan.skippedAnime })
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
    if (!authKey) return;
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
    if (!authKey) return;
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

  const loadingDir = phase.kind === "loading" ? phase.dir : null;

  let status: ReactNode = null;
  if (locked) {
    status = (
      <Callout glyph={<Info size={18} className="text-ink-subtle" />}>
        <p className={`max-w-[66ch] ${ROW_DESC}`}>{signIn}</p>
      </Callout>
    );
  } else if (phase.kind === "confirm-export" || phase.kind === "confirm-import") {
    const isExport = phase.kind === "confirm-export";
    const count =
      phase.kind === "confirm-export"
        ? phase.plan.movies.length + phase.plan.shows.length
        : phase.items.length;
    const skipped = phase.kind === "confirm-export" ? phase.plan.skippedAnime : 0;
    const plan = phase.kind === "confirm-export" ? phase.plan : null;
    const items = phase.kind === "confirm-import" ? phase.items : null;
    status = (
      <Callout glyph={<Info size={18} className="text-ink-subtle" />}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className={`max-w-[66ch] ${ROW_DESC}`}>
            {isExport
              ? t("Add {n} titles from your Harbor watchlist to Trakt? Trakt skips any it already has.", { n: count })
              : t("Add {n} titles from your Trakt watchlist to Harbor?", { n: count })}
          </p>
          {skipped > 0 && (
            <p className={`max-w-[66ch] ${ROW_DESC}`}>
              {t("{n} anime titles will be left out (Trakt has no IDs for them).", { n: skipped })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (plan) confirmExport(plan);
              else if (items) confirmImport(items);
            }}
            className={ROW_ACTION_PRIMARY}
          >
            {isExport ? <Upload size={18} strokeWidth={2.2} /> : <Download size={18} strokeWidth={2.2} />}
            {t("Continue")}
          </button>
          <button type="button" onClick={() => setPhase({ kind: "idle" })} className={ROW_ACTION}>
            {t("Cancel")}
          </button>
        </div>
      </Callout>
    );
  } else if (phase.kind === "running") {
    status = (
      <Callout glyph={<Loader2 size={18} className="animate-spin text-ink-subtle" />}>
        <p className={`max-w-[66ch] ${ROW_DESC}`}>{phase.label}</p>
      </Callout>
    );
  } else if (phase.kind === "result") {
    status = (
      <Callout
        glyph={
          phase.tone === "ok" ? (
            <Check size={18} strokeWidth={2.4} className="text-success" />
          ) : (
            <Info size={18} className="text-accent" />
          )
        }
      >
        <p className={`max-w-[66ch] ${ROW_DESC}`}>{phase.message}</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => setPhase({ kind: "idle" })} className={ROW_ACTION}>
            {t("Done")}
          </button>
        </div>
      </Callout>
    );
  }

  return (
    <>
      <SettingRow
        label={t("Export to Trakt")}
        desc={t("Send every title in your Harbor watchlist up to Trakt. Safe to run again, Trakt skips anything it already has.")}
        lockReason={locked ? signIn : undefined}
      >
        <button
          type="button"
          onClick={startExport}
          disabled={locked || busy}
          className={ROW_ACTION_PRIMARY}
        >
          {loadingDir === "export" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Upload size={18} strokeWidth={2.2} />
          )}
          {t("Export")}
        </button>
      </SettingRow>

      <SettingRow
        label={t("Import from Trakt")}
        desc={t("Pull every title on your Trakt watchlist into Harbor. Anything already saved is left alone.")}
        lockReason={locked ? signIn : undefined}
      >
        <button
          type="button"
          onClick={startImport}
          disabled={locked || busy}
          className={ROW_ACTION}
        >
          {loadingDir === "import" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Download size={18} strokeWidth={2.2} />
          )}
          {t("Import")}
        </button>
      </SettingRow>

      {status}
    </>
  );
}
