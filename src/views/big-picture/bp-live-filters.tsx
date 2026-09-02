import { Fragment } from "react";
import { Star } from "lucide-react";
import { flagUrl } from "@/lib/iptv/country-detect";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";

export type BpLiveFilterItem = {
  key: string;
  label: string;
  translateLabel?: boolean;
  count: number;
  star?: boolean;
  flagCode?: string;
};

// py/-my give the focus scale vertical room INSIDE the scroller's own box, so
// overflow-x-auto (which forces overflow-y to auto) never clips the grown ring.
// It stays on this scroll track and NOT on the [data-bp-row] parent: that rule
// in bp-tokens carries `padding: 0 gutter`, a shorthand that would zero the
// block padding here and let the ring clip against the source lane above.
const TRACK =
  "flex items-center gap-[clamp(6px,0.6vw,12px)] overflow-x-auto py-[26px] ps-[22px] -my-[26px] -ms-[22px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function FilterFlag({ code }: { code: string }) {
  const src = flagUrl(code);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-[1em] w-[1.5em] shrink-0 rounded-[3px] object-cover"
    />
  );
}

export function BpLiveFilters({
  items,
  activeKey,
  onSelect,
}: {
  items: BpLiveFilterItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const t = useBpT();
  return (
    <div data-bp-row className="flex items-center">
      <div data-bp-scroll-x className={TRACK}>
        {items.map((item) => {
          const on = item.key === activeKey;
          const hasFavs = !!item.star && item.count > 0;
          // The star segment exists so the count can be suppressed at zero:
          // "Favorites 0" must never render.
          const showCount = item.count > 0;
          return (
            <Fragment key={item.key}>
              <button
                type="button"
                data-bp-focusable
                data-bp-chip
                data-bp-restore-key={`live-category:${item.key}`}
                aria-pressed={on}
                onClick={() => {
                  SFX.click();
                  onSelect(item.key);
                }}
                // The focused fill (ink face, canvas ink, no border) comes from
                // [data-bp-chip][data-bp-focus] in bp-tokens; only the scale is
                // ours. Resting selected is --bp-on so active and focus never
                // read as the same object.
                className={`flex h-[clamp(46px,5.2vh,60px)] shrink-0 items-center gap-[clamp(6px,0.5vw,10px)] rounded-full px-[clamp(15px,1.3vw,24px)] text-[clamp(13px,1.85vh,21px)] font-semibold transition-[transform,background-color,border-color,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] data-[bp-focus=true]:[transform:scale(1.04)] motion-reduce:data-[bp-focus=true]:[transform:none] ${
                  on
                    ? "bg-[var(--bp-on)] text-ink"
                    : "border border-[var(--bp-edge)] text-ink-muted"
                }`}
              >
                {item.star && (
                  <Star
                    size="1em"
                    strokeWidth={2}
                    fill={hasFavs ? "currentColor" : "none"}
                    className={`shrink-0 ${hasFavs ? "text-[var(--bp-touch)]" : ""}`}
                  />
                )}
                {item.flagCode && <FilterFlag code={item.flagCode} />}
                <span className="max-w-[clamp(160px,24vw,380px)] truncate">
                  {item.translateLabel ? t(item.label) : item.label}
                </span>
                {showCount && (
                  <span className="text-[clamp(11px,1.45vh,16px)] font-bold tabular-nums opacity-55">
                    {item.count.toLocaleString()}
                  </span>
                )}
              </button>
              {item.star && (
                <span
                  aria-hidden
                  className="mx-[clamp(2px,0.3vw,6px)] h-[clamp(22px,2.6vh,32px)] w-px shrink-0 bg-[var(--bp-edge)] opacity-70"
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
