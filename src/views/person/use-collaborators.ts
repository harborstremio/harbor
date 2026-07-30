import { useEffect, useMemo, useState } from "react";
import { createRequestScheduler } from "@/lib/request-scheduler";
import { tmdbTitleCredits } from "@/lib/providers/tmdb/tmdb-title-credits";
import type { PersonCredit, PersonDetail } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { readCollaborators, writeCollaborators } from "./collaborator-cache";
import {
  rankCollaborators,
  type Collaborator,
  type CollaboratorTitle,
} from "./collaborator-rank";
import { dedupeByMedia, isCameoOrGuest, notableScore } from "./person-utils";

const SAMPLE_SIZE = 20;

const scheduler = createRequestScheduler({ concurrency: 3 });

function pickSample(person: PersonDetail): PersonCredit[] {
  return dedupeByMedia([...person.cast, ...person.crew].filter((c) => !isCameoOrGuest(c)))
    .sort((a, b) => notableScore(b) - notableScore(a))
    .slice(0, SAMPLE_SIZE);
}

function onIdle(cb: () => void): () => void {
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof win.requestIdleCallback === "function") {
    const handle = win.requestIdleCallback(cb, { timeout: 3000 });
    return () => win.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(cb, 1200);
  return () => window.clearTimeout(handle);
}

export function useCollaborators(person: PersonDetail | null): Collaborator[] {
  const { settings } = useSettings();
  const personId = person?.id ?? 0;
  const sample = useMemo(() => (person ? pickSample(person) : []), [person]);
  const [people, setPeople] = useState<Collaborator[]>(
    () => (personId ? readCollaborators(personId) : null) ?? [],
  );

  useEffect(() => {
    if (!personId) return;
    const cached = readCollaborators(personId);
    setPeople(cached ?? []);
    const key = settings.tmdbKey;
    if (cached || !key || sample.length === 0) return;
    let cancelled = false;

    const run = async () => {
      const fetched = await Promise.all(
        sample.map((c) =>
          scheduler
            .schedule(`collab:${c.mediaType}:${c.id}`, () =>
              tmdbTitleCredits(key, c.mediaType, c.id),
            )
            .then((credits): CollaboratorTitle | null =>
              credits ? { key: `${c.mediaType}:${c.id}`, ...credits } : null,
            )
            .catch(() => null),
        ),
      );
      if (cancelled) return;
      const resolved = fetched.filter((t): t is CollaboratorTitle => t !== null);
      const ranked = rankCollaborators(resolved, personId);
      setPeople(ranked);
      if (resolved.length * 2 >= sample.length) writeCollaborators(personId, ranked);
    };

    const cancelIdle = onIdle(() => {
      if (!cancelled) void run();
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [personId, sample, settings.tmdbKey]);

  return people;
}
