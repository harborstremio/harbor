import { Loader2, Wrench } from "../icons";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  repairStremioLibrary,
  type RepairProgress,
  type RepairResult,
} from "@/lib/stremio-library-repair";
import { findCorruptAnimeEntries, healCorruptAnimeEntries } from "@/lib/anime-cw-repair";
import { clearResurfaceCache } from "@/lib/cw-resurface";
import type { LibraryItem } from "@/lib/stremio";
import { useT } from "@/lib/i18n";
import { ActionRow } from "./action-row";

export function LibraryRepairRow() {
  const t = useT();
  const { authKey } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<RepairProgress | null>(null);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!authKey || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ phase: "fetching" });
    try {
      const r = await repairStremioLibrary(authKey, (p) => setProgress(p));
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!authKey) {
    return (
      <ActionRow
        label={t("Repair library")}
        sub={t("Sign in to Stremio first. The repair scans only the active profile's library.")}
      />
    );
  }

  const statusLine = (() => {
    if (error) return t("Failed: {error}", { error });
    if (result) {
      if (result.total === 0) return t("Library is empty. Nothing to repair.");
      return (
        t("{repaired} fixed, {clean} already clean", {
          repaired: result.repaired,
          clean: result.alreadyClean,
        }) +
        (result.unrepairable > 0 ? t(", {n} unrepairable", { n: result.unrepairable }) : "") +
        "."
      );
    }
    if (!progress)
      return t(
        "Rewrites every library item to match Stremio's exact schema. Run once if your Stremio app started crashing after Harbor synced playback.",
      );
    if (progress.phase === "fetching") {
      return progress.total
        ? t("Fetching {n} items…", { n: progress.total })
        : t("Fetching library index…");
    }
    if (progress.phase === "normalizing") {
      return progress.needsRepair != null
        ? t("{n} items need repair.", { n: progress.needsRepair })
        : t("Checking {n} items…", { n: progress.total ?? 0 });
    }
    if (progress.phase === "pushing") {
      return t("Pushing {pushed} of {total}…", {
        pushed: progress.pushed ?? 0,
        total: progress.needsRepair ?? 0,
      });
    }
    return t("Done.");
  })();

  return (
    <ActionRow
      label={t("Repair library")}
      sub={statusLine}
      cta={busy ? t("Working…") : result ? t("Run again") : t("Repair now")}
      icon={
        busy ? (
          <Loader2 size={16} strokeWidth={2.4} className="animate-spin" />
        ) : (
          <Wrench size={16} strokeWidth={2.4} />
        )
      }
      onClick={run}
      disabled={busy}
      tone={result && result.repaired > 0 && !error ? "success" : undefined}
    />
  );
}

export function AnimeRepairRow() {
  const t = useT();
  const { authKey } = useAuth();
  const [phase, setPhase] = useState<
    "idle" | "scanning" | "scanned" | "removing" | "done" | "error"
  >("idle");
  const [found, setFound] = useState<LibraryItem[]>([]);
  const [removed, setRemoved] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    if (!authKey) return;
    setPhase("scanning");
    setError(null);
    try {
      const items = await findCorruptAnimeEntries(authKey);
      setFound(items);
      setPhase("scanned");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const remove = async () => {
    if (!authKey || found.length === 0) return;
    setPhase("removing");
    try {
      const n = await healCorruptAnimeEntries(authKey, found);
      clearResurfaceCache();
      setRemoved(n);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  if (!authKey) {
    return (
      <ActionRow
        label={t("Repair anime library")}
        sub={t("Sign in to Stremio first. This scans the active profile's library.")}
      />
    );
  }

  const names =
    found
      .slice(0, 4)
      .map((i) => i.name || i._id)
      .join(", ") + (found.length > 4 ? "…" : "");
  const showRemove = phase === "scanned" && found.length > 0;
  const busy = phase === "scanning" || phase === "removing";
  const sub = (() => {
    if (error) return t("Failed: {error}", { error });
    if (phase === "scanning") return t("Scanning your library…");
    if (phase === "scanned")
      return found.length === 0
        ? t("No issues found. Your anime library looks clean.")
        : t(
            "Found {n}: {names}. These are saved under the wrong id, which breaks Continue Watching and Trakt marking.",
            { n: found.length, names },
          );
    if (phase === "removing") return t("Removing…");
    if (phase === "done")
      return t("Removed {n}. Rewatch and they re-add correctly.", { n: removed });
    return t(
      "Finds anime saved under a movie or series id (which breaks Continue Watching and Trakt) and removes just those so they re-add correctly.",
    );
  })();
  const cta = (() => {
    if (phase === "scanning") return t("Scanning…");
    if (phase === "removing") return t("Removing…");
    if (showRemove) return t("Remove {n}", { n: found.length });
    if (phase === "done" || phase === "error" || (phase === "scanned" && found.length === 0))
      return t("Scan again");
    return t("Scan for corruption");
  })();

  return (
    <ActionRow
      label={t("Fix corrupted anime")}
      sub={sub}
      cta={cta}
      icon={
        busy ? (
          <Loader2 size={16} strokeWidth={2.4} className="animate-spin" />
        ) : (
          <Wrench size={16} strokeWidth={2.4} />
        )
      }
      onClick={showRemove ? remove : scan}
      disabled={busy}
      tone={showRemove ? "danger" : phase === "done" && removed > 0 ? "success" : undefined}
      warn={
        showRemove
          ? t("This deletes those entries from your library. Playing them again re-adds them.")
          : undefined
      }
    />
  );
}
