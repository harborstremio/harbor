import type { WatchProvider } from "@/lib/providers/tmdb";
import { useBpT } from "../bp-i18n";
import { BP_DETAIL_HEADING } from "./bp-detail-chrome";

// Informational, never focusable. The only action a service mark could carry on
// a TV is opening a system browser, and a D-pad landing on a cell that leaves
// the app with no way back is worse than a mark that simply answers "this is on
// Max". The row keeps its rail index and is stepped over.
export function BpWatchOnRow({ providers }: { providers: WatchProvider[] }) {
  const t = useBpT();
  if (providers.length === 0) return null;

  return (
    <section
      data-bp-row
      data-bp-row-key="watch-on"
      className="relative"
      style={{ containIntrinsicSize: "auto 150px" }}
    >
      <h2 className={BP_DETAIL_HEADING}>{t("Watch on")}</h2>
      <div className="flex flex-wrap items-center gap-[clamp(10px,1vw,20px)] px-[var(--bp-gutter)] pt-[clamp(6px,0.8vh,12px)]">
        {providers.map((p) => (
          <span
            key={p.id}
            className="flex items-center gap-[clamp(8px,0.7vw,14px)] rounded-[var(--bp-r-sm)] bg-[var(--bp-void)]/70 px-[clamp(9px,0.8vw,15px)] py-[clamp(7px,0.8vh,12px)] ring-1 ring-[var(--bp-edge-2)]"
          >
            <img
              src={p.logo}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-[clamp(30px,3.6vh,50px)] w-[clamp(30px,3.6vh,50px)] shrink-0 rounded-[8px] object-contain"
            />
            <span className="text-[clamp(12px,1.62vh,19px)] font-semibold text-ink">{p.name}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
