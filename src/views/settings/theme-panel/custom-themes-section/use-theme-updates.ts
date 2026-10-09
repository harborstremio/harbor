import { useCallback, useEffect, useState } from "react";
import { browseThemes, downloadTheme } from "@/lib/theme-store";
import { getDownloadRecords, markStoreThemeUpdated } from "@/lib/theme-updates";

export type ThemeUpdate = { savedId: string; storeId: string; name: string; from: number; to: number };

export function useThemeUpdates() {
  const [updates, setUpdates] = useState<ThemeUpdate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const scan = useCallback(async () => {
    const recs = getDownloadRecords();
    const savedIds = Object.keys(recs);
    if (!savedIds.length) {
      setUpdates([]);
      return;
    }
    let current;
    try {
      current = await browseThemes("new", "");
    } catch {
      return;
    }
    const byStore = new Map<string, number>(current.map((t) => [t.id, t.versionsCount ?? 0] as [string, number]));
    const byStoreId = new Map<string, ThemeUpdate>();
    for (const savedId of savedIds) {
      const rec = recs[savedId];
      const cur = byStore.get(rec.storeId);
      if (cur == null || cur <= rec.version) continue;
      const existing = byStoreId.get(rec.storeId);
      if (existing && existing.from <= rec.version) continue;
      byStoreId.set(rec.storeId, { savedId, storeId: rec.storeId, name: rec.name, from: rec.version, to: cur });
    }
    setUpdates([...byStoreId.values()]);
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  const updateOne = useCallback(async (u: ThemeUpdate) => {
    setBusy(u.storeId);
    try {
      await downloadTheme(u.storeId, null, u.to);
      markStoreThemeUpdated(u.storeId, u.to);
      setUpdates((prev) => prev.filter((x) => x.storeId !== u.storeId));
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }, []);

  return { updates, busy, updateOne };
}
