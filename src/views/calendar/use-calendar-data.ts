import { fetchCalendarRange, fetchCustomCalendar, monthRangeISO, type CalendarItem } from "@/lib/calendar";
import {
  fetchAnticipatedCalendar,
  fetchLibraryCalendar,
  fetchSimklCalendar,
  fetchSimklPremieresCalendar,
  fetchTraktCalendar,
} from "@/lib/calendar-sources";
import { t } from "@/lib/i18n";
import type { Settings } from "@/lib/settings";
import { useEffect, useRef, useState } from "react";

type Args = {
  source: Settings["calendarSource"];
  authKey: string | null;
  traktConnected: boolean;
  simklConnected: boolean;
  settings: Settings;
  year: number;
  month: number;
};

export function useCalendarData({ source, authKey, traktConnected, simklConnected, settings, year, month }: Args) {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevSourceRef = useRef(source);

  if (prevSourceRef.current !== source) {
    prevSourceRef.current = source;
    setItems([]);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const run = (p: Promise<CalendarItem[]>) => {
      setLoading(true);
      p.then((rows) => {
        if (!cancelled) setItems(rows);
      })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : t("Failed to load"));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    const stop = () => {
      setItems([]);
      setLoading(false);
    };

    const dispatch = () => {
      if (source === "library") {
        if (!authKey) return stop();
        return run(
          fetchLibraryCalendar(authKey, year, month, {
            tmdbKey: settings.tmdbKey,
            includeTrakt: traktConnected,
          }),
        );
      }
      if (source === "trakt") {
        if (!traktConnected) return stop();
        return run(fetchTraktCalendar(year, month));
      }
      if (source === "simkl") {
        if (!simklConnected) return stop();
        return run(fetchSimklCalendar(year, month, { tmdbKey: settings.tmdbKey }));
      }
      if (source === "simkl-anticipated") {
        return run(fetchSimklPremieresCalendar(year, month));
      }
      if (source === "anticipated") {
        return run(fetchAnticipatedCalendar(year, month));
      }
      if (source === "custom") {
        if (!settings.tmdbKey) return stop();
        const { start, end } = monthRangeISO(year, month);
        const extras: Promise<CalendarItem[]>[] = [];
        if (settings.customCalendar.includeTraktAnticipated) {
          extras.push(fetchAnticipatedCalendar(year, month).catch(() => []));
        }
        if (settings.customCalendar.includeTraktWatchlist && traktConnected) {
          extras.push(fetchTraktCalendar(year, month).catch(() => []));
        }
        return run(
          Promise.all(extras)
            .then((batches) => batches.flat())
            .then((extra) =>
              fetchCustomCalendar({
                apiKey: settings.tmdbKey,
                region: settings.region,
                filters: {
                  trackedPeople: settings.customCalendar.trackedPeople,
                  genres: settings.customCalendar.genres,
                  watchProviders: settings.customCalendar.watchProviders,
                  originCountries: settings.customCalendar.originCountries,
                  mediaTypes: settings.customCalendar.mediaTypes,
                },
                start,
                end,
                extra,
              }),
            ),
        );
      }
      if (!settings.tmdbKey) return stop();
      const { start, end } = monthRangeISO(year, month);
      return run(fetchCalendarRange(settings.tmdbKey, start, end, settings.region));
    };

    dispatch();
    return () => {
      cancelled = true;
    };
  }, [
    source,
    authKey,
    traktConnected,
    simklConnected,
    settings.tmdbKey,
    settings.region,
    settings.customCalendar.trackedPeople,
    settings.customCalendar.includeTraktAnticipated,
    settings.customCalendar.includeTraktWatchlist,
    year,
    month,
  ]);

  useEffect(() => {
    if (simklConnected) {
      void fetchSimklPremieresCalendar(year, month).catch(() => {});
    }
  }, [simklConnected, year, month]);

  return { items, loading, error };
}
