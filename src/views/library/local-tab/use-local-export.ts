import { useCallback, useMemo } from "react";
import { exportMovie, exportSeries, type ExportSizes } from "@/lib/local-library/export";
import { updateLocalEntries, updateLocalEntry, type LocalEntry } from "@/lib/local-library";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

export type ExportResult = { ok: number; fail: number; reason?: string };

export function useLocalExport(setToast: (msg: string) => void) {
  const t = useT();
  const { settings } = useSettings();

  const exportSizes: ExportSizes = useMemo(
    () => ({
      poster: settings.nfoPosterSize,
      backdrop: settings.nfoBackdropSize,
      logo: settings.nfoLogoSize,
    }),
    [settings.nfoPosterSize, settings.nfoBackdropSize, settings.nfoLogoSize],
  );

  const runExport = useCallback(
    async (entries: LocalEntry[]): Promise<ExportResult> => {
      const key = settings.tmdbKey?.trim();
      if (!key) {
        setToast(t("Add a TMDB key to export metadata."));
        return { ok: 0, fail: 0 };
      }
      const movies = entries.filter((e) => e.type === "movie" && e.tmdbId != null);
      const showGroups = new Map<string, LocalEntry[]>();
      for (const e of entries) {
        if (e.type !== "show" || e.tmdbId == null) continue;
        const gk = `t${e.tmdbId}`;
        let arr = showGroups.get(gk);
        if (!arr) {
          arr = [];
          showGroups.set(gk, arr);
        }
        arr.push(e);
      }
      const total = movies.length + showGroups.size;
      let ok = 0;
      let fail = 0;
      let done = 0;
      let reason: string | undefined;
      for (const m of movies) {
        setToast(t("Exporting {done}/{total}…", { done: ++done, total }));
        const res = await exportMovie(key, m, exportSizes);
        if (res.ok) {
          ok += 1;
          if (res.localArt) updateLocalEntry(m.id, { localArt: res.localArt });
        } else {
          fail += 1;
          reason = reason ?? res.reason;
        }
      }
      for (const eps of showGroups.values()) {
        setToast(t("Exporting {done}/{total}…", { done: ++done, total }));
        const res = await exportSeries(key, eps, exportSizes);
        if (res.ok) {
          ok += 1;
          if (res.localArt) updateLocalEntries(eps.map((e) => e.id), { localArt: res.localArt });
        } else {
          fail += 1;
          reason = reason ?? res.reason;
        }
      }
      return { ok, fail, reason };
    },
    [settings.tmdbKey, exportSizes, setToast, t],
  );

  const onExportOne = useCallback(
    async (entryOrList: LocalEntry | LocalEntry[]) => {
      const list = (Array.isArray(entryOrList) ? entryOrList : [entryOrList]).filter(
        (e) => e.tmdbId != null,
      );
      if (list.length === 0) {
        setToast(t("Identify this title before exporting."));
        return;
      }
      const { ok, fail, reason } = await runExport(list);
      setToast(
        fail === 0
          ? t("Saved .nfo and artwork")
          : ok === 0
            ? t("Export failed: {reason}", { reason: reason ?? t("unknown error") })
            : t("Exported {ok}, {fail} failed", { ok, fail }),
      );
    },
    [runExport, setToast, t],
  );

  return { runExport, onExportOne };
}
