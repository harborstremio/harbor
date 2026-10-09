import { useEffect, useRef } from "react";
import { emitListToast } from "@/components/lists/list-toast";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { fetchEpisodeList } from "@/lib/series-episodes";
import {
  fireReminderNotification,
  listReminders,
  markReminderUnseen,
  setReminderSeen,
  type ReminderEntry,
} from "@/lib/reminders";
import type { Meta } from "@/lib/cinemeta";

const FIRST_CHECK_MS = 25_000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

type Tfn = ReturnType<typeof useT>;

let running = false;

function fire(entry: ReminderEntry, body: string): void {
  fireReminderNotification(entry, entry.name, body);
  emitListToast(`${entry.name}: ${body}`);
  markReminderUnseen(entry.id);
}

const DAY_OF_WINDOW_MS = 36 * 60 * 60 * 1000;

async function checkOne(entry: ReminderEntry, tmdbKey: string, t: Tfn): Promise<void> {
  if (entry.type === "movie") return;
  const meta: Meta = { id: entry.id, type: "series", name: entry.name };
  const eps = await fetchEpisodeList(meta, { tmdbKey });
  if (!eps.length) return;
  const now = Date.now();
  const aired = eps
    .map((e) => ({ ...e, at: e.airDate ? Date.parse(e.airDate) : NaN }))
    .filter((e) => Number.isFinite(e.at) && e.at <= now)
    .sort((a, b) => a.at - b.at);
  const keyOf = (e: { season: number; episode: number }) => `${e.season}x${e.episode}`;
  const airedKeys = aired.map(keyOf);
  if (!entry.seenKeys) {
    setReminderSeen(entry.id, airedKeys, now);
    return;
  }
  const seen = new Set(entry.seenKeys);
  const fresh = aired.filter(
    (e) => !seen.has(keyOf(e)) && now - e.at <= DAY_OF_WINDOW_MS && e.at > entry.createdAt,
  );
  if (fresh.length) {
    const prevMaxSeason = aired.reduce(
      (m, e) => (seen.has(keyOf(e)) && e.season > m ? e.season : m),
      0,
    );
    const premiere = fresh.find((e) => e.season > prevMaxSeason);
    if (entry.seasons && premiere) {
      fire(entry, t("Season {n} has started", { n: premiere.season }));
    } else if (entry.episodes) {
      const last = fresh[fresh.length - 1];
      const body =
        fresh.length === 1
          ? t("S{s} E{e} is out now", { s: last.season, e: last.episode })
          : t("{n} new episodes are out", { n: fresh.length });
      fire(entry, body);
    }
  }
  setReminderSeen(entry.id, Array.from(new Set([...entry.seenKeys, ...airedKeys])), now);
}

async function checkAll(tmdbKey: string, t: Tfn): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (const entry of listReminders()) {
      try {
        await checkOne(entry, tmdbKey, t);
      } catch {
        /* keep window; retried next cycle */
      }
    }
  } finally {
    running = false;
  }
}

export function RemindersRunner() {
  const t = useT();
  const { settings } = useSettings();
  const keyRef = useRef(settings.tmdbKey);
  keyRef.current = settings.tmdbKey;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const run = () => {
      if (listReminders().length === 0) return;
      void checkAll(keyRef.current, tRef.current);
    };
    const first = window.setTimeout(run, FIRST_CHECK_MS);
    const iv = window.setInterval(run, CHECK_EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(iv);
    };
  }, []);

  return null;
}
