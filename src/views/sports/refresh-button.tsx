import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";
import "./refresh-button.css";

export function SportsRefreshButton({ busy, onRefresh }: { busy: boolean; onRefresh: () => void }) {
  const t = useT();
  const [turning, setTurning] = useState(busy);
  useEffect(() => {
    if (busy) setTurning(true);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(timer);
      if (!busy && turning && motion.matches) timer = setTimeout(() => setTurning(false), 200);
    };
    settle();
    motion.addEventListener("change", settle);
    return () => { clearTimeout(timer); motion.removeEventListener("change", settle); };
  }, [busy, turning]);
  return (
    <button type="button" className="sh-icon sh-refresh" aria-label={t("Refresh schedules")}
      title={t(busy ? "Updating schedules…" : "Refresh schedules")}
      aria-busy={busy} disabled={busy || turning} data-refreshing={busy || turning || undefined}
      onClick={() => { setTurning(true); onRefresh(); }}>
      <RefreshCw size={16} onAnimationIteration={() => { if (!busy) setTurning(false); }} />
    </button>
  );
}
