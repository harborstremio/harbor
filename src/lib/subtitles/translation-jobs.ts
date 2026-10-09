import { useSyncExternalStore } from "react";
import type { SubtitleLoadMetadata } from "./types";

/**
 * A subtitle a translating addon accepted but has not produced yet. Harbor keeps
 * re-checking the same URL and, once the finished file is served, adds it automatically.
 */
export type TranslationJob = {
  url: string;
  lang?: string;
  title?: string;
  metadata?: SubtitleLoadMetadata;
  startedAt: number;
};

/** Give up on a translation that never arrives. */
export const TRANSLATION_JOB_MAX_MS = 10 * 60 * 1000;

let jobs: TranslationJob[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Begins tracking a pending translation. Idempotent per URL, keeping the first start time. */
export function registerTranslationJob(job: Omit<TranslationJob, "startedAt">): void {
  if (!job.url || jobs.some((existing) => existing.url === job.url)) return;
  jobs = [...jobs, { ...job, startedAt: Date.now() }];
  emit();
}

export function completeTranslationJob(url: string): void {
  if (!jobs.some((existing) => existing.url === url)) return;
  jobs = jobs.filter((existing) => existing.url !== url);
  emit();
}

/** Drop every pending job (e.g. the media changed and they no longer apply). */
export function clearTranslationJobs(): void {
  if (jobs.length === 0) return;
  jobs = [];
  emit();
}

export function expiredTranslationJobs(now = Date.now()): TranslationJob[] {
  return jobs.filter((job) => now - job.startedAt >= TRANSLATION_JOB_MAX_MS);
}

export function useTranslationJobs(): TranslationJob[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => jobs,
    () => jobs,
  );
}

/** True while a translation for this exact URL is still pending. */
export function useTranslationJob(url: string): boolean {
  const list = useTranslationJobs();
  return list.some((job) => job.url === url);
}
