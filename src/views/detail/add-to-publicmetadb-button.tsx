import { Check, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import publicmetadbLogo from "@/assets/publicmetadb.svg";
import { HoverTooltip } from "@/components/hover-tooltip";
import { getTmdbForExternal } from "@/lib/publicmetadb/mappings";
import { usePublicMetaDb } from "@/lib/publicmetadb/provider";
import type { PmdbTarget } from "@/lib/publicmetadb/types";
import {
  addToPmdbWatchlist,
  fetchPmdbWatchlist,
  pmdbWatchlistContains,
  removeFromPmdbWatchlist,
} from "@/lib/publicmetadb/watchlist";
import { useT } from "@/lib/i18n";

export function usePmdbWatchlist(harborId: string, type: "movie" | "series") {
  const { isConnected, resolveTargetAsync } = usePublicMetaDb();
  const [target, setTarget] = useState<PmdbTarget | null>(null);
  const [inList, setInList] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      setTarget(null);
      setInList(false);
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(false);
    setError(null);
    void (async () => {
      // Add-to-list takes tmdb_id + media_type only: ID-only targets must
      // resolve through mappings first, otherwise hide instead of erroring.
      let tgt = await resolveTargetAsync(harborId, undefined, type).catch(() => null);
      if (!cancelled && tgt && tgt.tmdb_id == null && tgt.id_type && tgt.id_value) {
        const found = await getTmdbForExternal(tgt.id_type, tgt.id_value).catch(() => null);
        tgt = found ? { ...tgt, tmdb_id: found.tmdb_id } : null;
      }
      if (cancelled) return;
      if (!tgt || tgt.tmdb_id == null) {
        setTarget(null);
        setReady(true);
        return;
      }
      setTarget(tgt);
      try {
        const items = await fetchPmdbWatchlist();
        if (cancelled) return;
        setInList(pmdbWatchlistContains(items, tgt) != null);
      } catch {
        /* leave current state */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected, resolveTargetAsync, type]);

  const toggle = useCallback(async () => {
    if (!target || busy) return false;
    setBusy(true);
    setError(null);
    const prev = inList;
    setInList(!prev);
    try {
      const ok = prev
        ? await removeFromPmdbWatchlist(target)
        : await addToPmdbWatchlist(target);
      if (!ok) {
        setInList(prev);
        return false;
      }
      return true;
    } catch {
      setInList(prev);
      return false;
    } finally {
      setBusy(false);
    }
  }, [target, busy, inList]);

  const flash = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  }, []);

  return { isConnected, target, inList, ready, busy, error, toggle, flash };
}

export function AddToPmdbButton({
  harborId,
  title,
  type,
}: {
  harborId: string;
  title: string;
  type: "movie" | "series";
}) {
  const t = useT();
  const { isConnected, target, inList, ready, busy, error, toggle, flash } = usePmdbWatchlist(
    harborId,
    type,
  );

  if (!isConnected || !target || !ready) return null;

  return (
    <div className="relative shrink-0">
      <HoverTooltip
        label={inList ? t("Remove {title} from PMDB", { title }) : t("Add {title} to PMDB", { title })}
        align="center"
      >
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void toggle().then((ok) => {
              if (!ok) flash(t("Couldn't reach PublicMetaDB"));
            })
          }
          className={`flex h-12 items-center gap-2.5 rounded-full px-6 text-[15px] font-medium transition-[transform,background-color,border-color] duration-200 active:scale-[0.98] disabled:opacity-60 ${
            inList
              ? "border border-ink bg-ink/10 text-ink hover:bg-ink/20"
              : "bg-canvas/80 text-ink hover:bg-canvas/95"
          }`}
        >
          <img src={publicmetadbLogo} alt="" className="h-[18px] w-[18px] rounded-[4px] object-contain" />
          {inList ? (
            <Check size={16} strokeWidth={2.2} className="-ms-1" />
          ) : (
            <Plus size={16} strokeWidth={2.2} className="-ms-1" />
          )}
          {inList ? t("In PMDB") : t("Add to PMDB")}
        </button>
      </HoverTooltip>
      {error && (
        <div className="absolute start-0 top-full z-40 mt-1.5 whitespace-nowrap rounded-lg bg-danger px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          {error}
        </div>
      )}
    </div>
  );
}
