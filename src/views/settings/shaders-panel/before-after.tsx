import { fillStyle } from "@/components/slider";
import { ChevronDown, Images } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";

export function BeforeAfter({ demo }: { demo: { before: string; after: string; credit: string } }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(50);
  const [broken, setBroken] = useState(false);

  if (broken) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-8 w-fit items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
      >
        <Images size={14} strokeWidth={2} />
        {open ? t("Hide preview") : t("See the difference")}
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          className={`transition-transform duration-200 ease-in-out ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="animate-panel-in flex flex-col gap-2 rounded-md bg-canvas p-2 [transform-origin:top_left]">
          <div className="relative aspect-video w-full overflow-hidden rounded-[4px] bg-canvas">
            <img
              src={demo.before}
              alt={t("Before")}
              draggable={false}
              loading="lazy"
              onError={() => setBroken(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
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
              className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 rounded-full bg-canvas"
              style={{ left: `${pos}%` }}
            />
            <span className="absolute start-2 top-2 rounded-full bg-canvas px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink">
              {t("After")}
            </span>
            <span className="absolute end-2 top-2 rounded-full bg-canvas px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink">
              {t("Before")}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label={t("Compare before and after")}
            className="harbor-slider w-full"
            style={fillStyle(pos, 0, 100)}
          />
          <span className="px-0.5 text-[11.5px] text-ink-muted">
            {t("Comparison by {credit}", { credit: demo.credit })}
          </span>
        </div>
      )}
    </div>
  );
}
