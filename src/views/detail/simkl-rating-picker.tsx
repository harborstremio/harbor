import { useT } from "@/lib/i18n";
import { kitsuToMal } from "@/lib/providers/anime-mapping";
import { stremioIdToSimklTarget } from "@/lib/simkl/ids";
import { addSimklRating, removeSimklRating, getCachedRatingByTarget } from "@/lib/simkl/ratings";
import type { SimklTarget } from "@/lib/simkl/types";
import { Star, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export function SimklRatingPicker({
  harborId,
  type,
  simklConnected,
}: {
  harborId: string;
  type: "movie" | "series";
  simklConnected: boolean;
}) {
  const t = useT();
  const [target, setTarget] = useState<SimklTarget | null>(null);
  const [currentRating, setCurrentRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!simklConnected) {
      setTarget(null);
      setCurrentRating(null);
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(false);
    void (async () => {
      let tgt: SimklTarget | null = null;
      const resolution = stremioIdToSimklTarget(harborId);
      if (resolution.ok) {
        tgt = resolution.target;
      } else if (harborId.startsWith("kitsu:")) {
        const n = Number(harborId.split(":")[1]);
        const mal = Number.isFinite(n) ? await kitsuToMal(n).catch(() => null) : null;
        if (mal != null) tgt = { kind: "show", ids: { mal } };
      }
      if (cancelled) return;
      if (!tgt) {
        setTarget(null);
        return;
      }
      if (type === "series" && tgt.kind === "movie") tgt = { kind: "show", ids: tgt.ids };
      if (type === "movie" && (tgt.kind === "show" || tgt.kind === "anime")) {
        tgt = { kind: "movie", ids: tgt.ids };
      }

      setTarget(tgt);
      setCurrentRating(getCachedRatingByTarget(tgt));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, type, simklConnected]);

  if (!simklConnected || !target || !ready) return null;

  const handleRatingClick = async (val: number) => {
    if (loading) return;
    setLoading(true);

    if (currentRating === val) {
      const ok = await removeSimklRating(target);
      if (ok) setCurrentRating(null);
    } else {
      const ok = await addSimklRating(target, val);
      if (ok) setCurrentRating(val);
    }
    setLoading(false);
  };

  const activeRating = hoverRating || currentRating || 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5" role="group" aria-label="SIMKL rating picker">
        {[1, 2, 3, 4, 5].map((n) => {
          const isFilled = 2 * n <= activeRating;
          const isHalf = 2 * n - 1 === activeRating;

          return (
            <div key={n} className="relative h-5 w-5 text-ink-subtle">
              <Star size={20} className="text-ink-muted/30" />

              {isHalf && (
                <div className="absolute inset-0 w-[50%] overflow-hidden pointer-events-none">
                  <Star size={20} className="fill-amber-400 text-amber-400" />
                </div>
              )}

              {isFilled && (
                <div className="absolute inset-0 pointer-events-none">
                  <Star size={20} className="fill-amber-400 text-amber-400" />
                </div>
              )}

              <div
                className="absolute left-0 top-0 h-full w-1/2 cursor-pointer"
                onMouseEnter={() => setHoverRating(2 * n - 1)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => handleRatingClick(2 * n - 1)}
              />
              <div
                className="absolute right-0 top-0 h-full w-1/2 cursor-pointer"
                onMouseEnter={() => setHoverRating(2 * n)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => handleRatingClick(2 * n)}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1 text-[13px] font-semibold text-ink-muted">
        {loading ? (
          <Loader2 size={13} className="animate-spin text-ink-subtle" />
        ) : currentRating !== null ? (
          <span className="font-bold text-amber-400">{currentRating}/10</span>
        ) : (
          <span className="text-ink-subtle">{t("Rate on SIMKL")}</span>
        )}
      </div>
    </div>
  );
}
