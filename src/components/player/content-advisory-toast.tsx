import { Ghost, Heart, Info, MessageSquareWarning, ShieldAlert, Swords, Wine } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  advisoryCategoryLabel,
  advisorySeverityRank,
  normalizeContentAdvisories,
} from "@/lib/content-advisory";
import { useT } from "@/lib/i18n";

export type Advisory = { category: string; severity: string };

const SEV_STYLE: Record<string, { text: string; bar: string }> = {
  Severe: { text: "text-red-300", bar: "bg-red-400" },
  Moderate: { text: "text-amber-300", bar: "bg-amber-400" },
  Mild: { text: "text-ink-subtle", bar: "bg-ink-subtle/70" },
};

function metaFor(category: string): { Icon: typeof Info; label: string } {
  const c = category.toLowerCase();
  if (c.includes("sex") || c.includes("nudity")) return { Icon: Heart, label: "Sex & Nudity" };
  if (c.includes("violence") || c.includes("gore")) return { Icon: Swords, label: "Violence" };
  if (c.includes("profanity")) return { Icon: MessageSquareWarning, label: "Profanity" };
  if (c.includes("alcohol") || c.includes("drug") || c.includes("smoking"))
    return { Icon: Wine, label: "Alcohol & Drugs" };
  if (c.includes("frighten") || c.includes("intense")) return { Icon: Ghost, label: "Frightening" };
  return { Icon: Info, label: category };
}

const HOLD_MS = 10000;
const HOVER_TAIL_MS = 2500;
const CARD_CLASS =
  "w-[266px] rounded-2xl border border-edge-soft/70 bg-canvas/85 px-4 py-3.5 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.72)] backdrop-blur-xl";

export function ContentAdvisoryToast({
  categories,
  playKey,
  preview = false,
}: {
  categories: Advisory[];
  playKey: string;
  preview?: boolean;
}) {
  const t = useT();
  const rated = useMemo(() => normalizeContentAdvisories(categories), [categories]);
  const [visible, setVisible] = useState(preview);
  const timerRef = useRef(0);

  useEffect(() => {
    if (preview || rated.length === 0 || !playKey) return;
    setVisible(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setVisible(false), HOLD_MS);
    return () => window.clearTimeout(timerRef.current);
  }, [playKey, rated.length, preview]);

  if (rated.length === 0) return null;

  return (
    <div
      onMouseEnter={preview ? undefined : () => window.clearTimeout(timerRef.current)}
      onMouseLeave={
        preview
          ? undefined
          : () => {
              window.clearTimeout(timerRef.current);
              timerRef.current = window.setTimeout(() => setVisible(false), HOVER_TAIL_MS);
            }
      }
      className={
        preview
          ? CARD_CLASS
          : `pointer-events-auto absolute start-6 top-20 z-30 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${CARD_CLASS} ${
              visible ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0"
            }`
      }
    >
      <div className="mb-2.5 flex items-center gap-1.5 text-ink-subtle">
        <ShieldAlert size={12} strokeWidth={2.2} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
          {t("Content advisory")}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {rated.map((c) => {
          const { Icon, label } = metaFor(c.category);
          const style = SEV_STYLE[c.severity] ?? SEV_STYLE.Mild;
          const rank = advisorySeverityRank(c.severity);
          return (
            <li key={c.category} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Icon size={14} strokeWidth={2} className={style.text} />
                <span className="text-[12.5px] text-ink">{t(advisoryCategoryLabel(label))}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex gap-[3px]">
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-2.5 w-1 rounded-full ${i <= rank ? style.bar : "bg-ink-subtle/25"}`}
                    />
                  ))}
                </span>
                <span className={`w-[54px] text-[11px] font-semibold ${style.text}`}>{t(c.severity)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
