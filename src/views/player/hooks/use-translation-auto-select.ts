import { useEffect, useRef, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { markAddedSub } from "@/lib/subtitles/added-subs";
import {
  clearTranslationJobs,
  completeTranslationJob,
  expiredTranslationJobs,
  useTranslationJobs,
} from "@/lib/subtitles/translation-jobs";

/** How often a still-pending translation is re-checked. */
const POLL_MS = 30_000;

/**
 * Provider subtitles that answered "not ready yet" (an AI translation addon) are polled
 * and, once the finished subtitle is served, added and selected automatically.
 *
 * Lives in the player window so it keeps working with the subtitle menu closed, and is
 * cleared when the media changes so it can never attach an old translation to new media.
 */
export function useTranslationAutoSelect({
  bridgeRef,
  mediaUrl,
}: {
  bridgeRef: RefObject<PlayerBridge | null>;
  mediaUrl: string;
}) {
  const jobs = useTranslationJobs();
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  useEffect(() => {
    clearTranslationJobs();
  }, [mediaUrl]);

  useEffect(() => {
    if (jobs.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      for (const job of expiredTranslationJobs()) completeTranslationJob(job.url);
      for (const job of jobsRef.current) {
        if (cancelled) return;
        const ok = await bridge
          .addSubtitle(job.url, job.lang, job.title, true, job.metadata)
          .catch(() => false);
        if (ok === true) {
          markAddedSub(job.url);
          completeTranslationJob(job.url);
        }
      }
    };
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobs.length, bridgeRef]);
}
