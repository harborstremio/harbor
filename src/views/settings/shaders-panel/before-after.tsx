import { fillStyle } from "@/components/slider";
import { ChevronDown, Images } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";

const CHIP =
  "absolute top-2 inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-canvas px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-ink";

export function BeforeAfter({ demo }: { demo: { before: string; after: string; credit: string } }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(50);
  const [broken, setBroken] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-11 w-fit items-center gap-2 rounded-[10px] px-3 text-[15.5px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <Images size={18} strokeWidth={2} />
        {open ? t("Hide preview") : t("See the difference")}
        <ChevronDown
          size={18}
          strokeWidth={2.2}
          className={`transition-transform duration-200 ease-in-out ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && broken && (
        <span className="text-[15.5px] leading-[22px] text-ink-muted">
          {t("Preview unavailable")}
        </span>
      )}

      {open && !broken && (
        <div className="animate-panel-in flex flex-col gap-2.5 rounded-[10px] bg-elevated p-3 [transform-origin:top_left] rtl:[transform-origin:top_right]">
          <div className="relative aspect-video w-full overflow-hidden rounded-[8px] bg-canvas">
            <img
              src={demo.before}
              alt={t("Before")}
              draggable={false}
              loading="lazy"
              onError={() => setBroken(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-y-0 start-0 overflow-hidden"
              style={{ width: `${pos}%` }}
            >
              <img
                src={demo.after}
                alt={t("After")}
                draggable={false}
                loading="lazy"
                onError={() => setBroken(true)}
                className="h-full w-full object-cover"
                style={{ width: `${(100 / Math.max(pos, 1)) * 100}%`, maxWidth: "none" }}
              />
            </div>
            <span
              aria-hidden
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-canvas"
              style={{ insetInlineStart: `${pos}%` }}
            />
            <span className={`${CHIP} start-2`}>{t("After")}</span>
            <span className={`${CHIP} end-2`}>{t("Before")}</span>
          </div>
          <div className="flex h-11 w-full items-center">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={pos}
              onChange={(e) => setPos(Number(e.target.value))}
              aria-label={t("Compare before and after")}
              className="harbor-slider w-full"
              style={fillStyle(pos, 0, 100, 5)}
            />
          </div>
          <span className="max-w-[70ch] text-[15.5px] leading-[22px] text-ink-muted">
            {t("Comparison by {credit}", { credit: demo.credit })}
          </span>
        </div>
      )}
    </div>
  );
}
