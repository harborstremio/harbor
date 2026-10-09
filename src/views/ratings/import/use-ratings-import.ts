import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { importRatingsBulk } from "@/lib/ratings/import/bulk";
import { recordImport } from "@/lib/ratings/import/receipts";
import { resolveItemKey } from "@/lib/ratings/import/resolve";
import type { ResolvedItem } from "@/lib/ratings/import/resolve";
import type {
  ImportProgress,
  ImportSourceId,
  ImportSourceInput,
  ImportedRating,
  RatingsSource,
} from "@/lib/ratings/import/types";
import type { RatingTarget } from "@/lib/ratings/types";

export type BulkItem = RatingTarget & { score: number; review?: string };

export type ImportStatus = "idle" | "running" | "done" | "cancelled" | "error";

export type ImportOutcome = {
  sourceId: ImportSourceId;
  sourceLabel: string;
  scanned: number;
  candidates: number;
  skipped: number;
  imported: number;
  unmatched: number;
  manga: number;
  writeFailed: number;
  samples: string[];
};

export type RatingsImport = {
  status: ImportStatus;
  cancelling: boolean;
  progress: ImportProgress;
  outcome: ImportOutcome | null;
  error: string | null;
  start: (source: RatingsSource, input: ImportSourceInput) => void;
  cancel: () => void;
  reset: () => void;
};

type Push = (p: Partial<ImportProgress>, force?: boolean) => void;
type Resolved = { targets: BulkItem[]; unmatched: number; manga: number; samples: string[] };

const BLANK: ImportProgress = { phase: "auth", fetched: 0, resolved: 0, written: 0, failed: 0 };
const PROGRESS_MS = 100;
const RESOLVE_LANES = 6;
const TICK_EVERY = 20;
const BREATHE_EVERY = 60;
const SAMPLE_MAX = 8;

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

function breathe(): Promise<void> {
  return new Promise((done) => setTimeout(done, 0));
}

function targetOf(row: ImportedRating, hit: ResolvedItem): BulkItem {
  return {
    itemKey: hit.itemKey,
    mediaType: hit.mediaType,
    title: row.title.slice(0, 300),
    poster: row.poster,
    score: row.score,
    review: row.review,
  };
}

async function resolveAll(
  rows: ImportedRating[],
  push: Push,
  signal: AbortSignal,
  tmdbKey: string,
): Promise<Resolved> {
  const targets: BulkItem[] = [];
  const samples: string[] = [];
  let unmatched = 0;
  let manga = 0;
  let next = 0;
  let seen = 0;
  push({ phase: "resolve", total: rows.length, resolved: 0, failed: 0, message: undefined }, true);

  const lane = async (): Promise<void> => {
    while (next < rows.length) {
      const row = rows[next];
      next += 1;
      if (signal.aborted) throw abortError();
      let hit: ResolvedItem | null = null;
      try {
        hit = await resolveItemKey(row, signal, tmdbKey);
      } catch (e) {
        if (isAbort(e)) throw e;
      }
      if (hit) {
        targets.push(targetOf(row, hit));
      } else {
        unmatched += 1;
        if (row.mediaType === "manga") manga += 1;
        if (samples.length < SAMPLE_MAX) samples.push(row.title);
      }
      seen += 1;
      if (seen % BREATHE_EVERY === 0) await breathe();
      if (seen % TICK_EVERY === 0) push({ resolved: targets.length, failed: unmatched });
    }
  };

  const lanes = Math.max(1, Math.min(RESOLVE_LANES, rows.length));
  await Promise.all(Array.from({ length: lanes }, () => lane()));
  push({ resolved: targets.length, failed: unmatched }, true);
  return { targets, unmatched, manga, samples };
}

export function useRatingsImport(): RatingsImport {
  const { settings } = useSettings();
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [cancelling, setCancelling] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>(BLANK);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ctrl = useRef<AbortController | null>(null);
  const live = useRef(true);
  const snap = useRef<ImportProgress>(BLANK);
  const at = useRef(0);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      ctrl.current?.abort();
    };
  }, []);

  const push = useCallback<Push>((p, force = false) => {
    snap.current = { ...snap.current, ...p };
    const now = Date.now();
    if (!force && now - at.current < PROGRESS_MS) return;
    at.current = now;
    if (live.current) setProgress(snap.current);
  }, []);

  const run = useCallback(
    async (source: RatingsSource, input: ImportSourceInput) => {
      ctrl.current?.abort();
      const ac = new AbortController();
      ctrl.current = ac;
      snap.current = { ...BLANK };
      at.current = 0;
      setProgress(snap.current);
      setOutcome(null);
      setError(null);
      setCancelling(false);
      setStatus("running");

      const stale = () => !live.current || ctrl.current !== ac;
      const startedAt = Date.now();
      let saved = 0;

      try {
        const rows = await source.fetchRatings(input, (p) => push(p), ac.signal);
        if (ac.signal.aborted) throw abortError();
        const scanned = Math.max(snap.current.total ?? 0, snap.current.fetched, rows.length);
        push({ phase: "fetch", fetched: rows.length, total: rows.length }, true);

        const found = await resolveAll(rows, push, ac.signal, settings.tmdbKey ?? "");
        push(
          {
            phase: "write",
            total: found.targets.length,
            written: 0,
            failed: found.unmatched,
            message: undefined,
          },
          true,
        );

        const write = found.targets.length
          ? await importRatingsBulk(
              found.targets,
              (written, failed, note) => {
                saved = written;
                push({ written, failed: found.unmatched + failed, ...(note ? { message: note } : {}) });
              },
              ac.signal,
            )
          : { written: 0, failed: 0 };
        saved = write.written;
        if (ac.signal.aborted) throw abortError();
        push(
          { phase: "done", written: write.written, failed: found.unmatched + write.failed },
          true,
        );

        if (stale()) return;
        setOutcome({
          sourceId: source.id,
          sourceLabel: source.label,
          scanned,
          candidates: rows.length,
          skipped: Math.max(0, scanned - rows.length),
          imported: write.written,
          unmatched: found.unmatched,
          manga: found.manga,
          writeFailed: write.failed,
          samples: found.samples,
        });
        setStatus("done");
      } catch (e) {
        if (stale()) return;
        push({}, true);
        if (isAbort(e)) {
          setStatus("cancelled");
          return;
        }
        setError(e instanceof Error ? e.message.trim() || null : null);
        setStatus("error");
      } finally {
        if (saved > 0) {
          recordImport({
            sourceId: source.id,
            sourceLabel: source.label,
            count: saved,
            startedAt,
            finishedAt: Date.now(),
          });
        }
      }
    },
    [push],
  );

  const start = useCallback(
    (source: RatingsSource, input: ImportSourceInput) => {
      void run(source, input);
    },
    [run],
  );

  const cancel = useCallback(() => {
    setCancelling(true);
    ctrl.current?.abort();
  }, []);

  const reset = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = null;
    snap.current = { ...BLANK };
    at.current = 0;
    setProgress(BLANK);
    setOutcome(null);
    setError(null);
    setCancelling(false);
    setStatus("idle");
  }, []);

  return { status, cancelling, progress, outcome, error, start, cancel, reset };
}
