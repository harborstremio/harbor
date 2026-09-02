import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { popBigPicture } from "@/lib/big-picture";
import { hostOf } from "@/lib/addons-store/reorder";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { SFX } from "@/lib/sfx";
import { useBpT } from "../bp-i18n";
import { BpTile } from "../bp-tile";
import { useBpAddonCatalogs, useBpAddonFeed } from "./use-bp-addon-catalogs";

const MARK = "max-h-full max-w-[min(38vw,520px)] object-contain";

// Selection is a hairline and --bp-touch text, never a fill. bp-tokens fills the
// FOCUSED chip with --bp-touch, so a filled resting state puts two solid pills
// side by side and the only thing separating the D-pad cursor from the current
// catalog is hue.
const CHIP =
  "h-[clamp(44px,4.8vh,58px)] shrink-0 rounded-full px-[clamp(14px,1.2vw,22px)] text-[clamp(12.5px,1.78vh,20px)] font-semibold transition-colors duration-[var(--bp-dur-fast)]";

const GRID_COLS = "repeat(auto-fill, minmax(clamp(122px, 9.8vw, 186px), 1fr))";

// Hot-linked from the addon's own host, exactly as on the card. Nothing about
// this page reads an image out of the repo.
function BpAddonMark({ src, name }: { src?: string; name: string }) {
  const url = useProxiedImageSrc(src);
  const [dead, setDead] = useState(false);
  if (!url || dead) {
    return (
      <span className="font-display text-[clamp(26px,4.6vh,64px)] font-semibold leading-[1] tracking-[-0.03em] text-ink">
        {name}
      </span>
    );
  }
  return <img src={url} alt={name} onError={() => setDead(true)} className={MARK} />;
}

export function BpAddon({
  name,
  base,
  logo,
  onSelect,
}: {
  name: string;
  base: string;
  logo?: string;
  onSelect: (m: Meta) => void;
}) {
  const t = useBpT();
  const { catalogs, loading: manifestLoading } = useBpAddonCatalogs(base);
  const [pickedKey, setPickedKey] = useState("");
  const picked = catalogs.find((c) => c.key === pickedKey) ?? catalogs[0];
  const { metas, loading, loadMore } = useBpAddonFeed(picked?.cursor);

  // The chip list arrives after the first paint whenever the manifest had to be
  // refetched, and a stale key from the previous addon would pin the page to a
  // catalog this one does not have.
  useEffect(() => {
    setPickedKey("");
  }, [base]);

  const empty = !manifestLoading && catalogs.length === 0;

  return (
    <div className="relative flex h-full flex-col gap-[clamp(11px,1.4vh,22px)] px-[var(--bp-gutter)] pb-[var(--bp-hint-h)] pt-[var(--bp-page-top)]">
      <div className="relative flex shrink-0 flex-col gap-[clamp(5px,0.7vh,11px)] [animation:bp-rise_var(--bp-dur-slow)_var(--bp-ease)_backwards] motion-reduce:[animation:none]">
        <span className="text-[clamp(15px,1.9vh,18px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          {hostOf(base)}
        </span>
        <div className="flex min-h-[clamp(44px,6.4vh,88px)] items-center">
          <BpAddonMark src={logo} name={name} />
        </div>
      </div>

      {catalogs.length > 0 && (
        <div data-bp-row className="relative flex shrink-0 items-center gap-[clamp(6px,0.6vw,12px)]">
          <div
            data-bp-scroll-x
            className="flex items-center gap-[clamp(6px,0.6vw,12px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {catalogs.map((c, i) => (
              <button
                key={c.key}
                type="button"
                data-bp-focusable
                data-bp-chip
                data-bp-autofocus={i === 0 ? "true" : undefined}
                data-bp-restore-key={`addon-cat:${c.key}`}
                aria-pressed={picked?.key === c.key}
                onClick={() => {
                  SFX.click();
                  setPickedKey(c.key);
                }}
                className={`${CHIP} border ${
                  picked?.key === c.key
                    ? "border-transparent bg-[var(--bp-on)] text-ink"
                    : "border-[var(--bp-edge)] text-ink-subtle"
                }`}
              >
                {/* Catalog names come off the addon's manifest and are runtime
                    strings, so they must never reach t(). */}
                {c.name}
              </button>
            ))}
          </div>
          <span className="ms-auto shrink-0 text-[clamp(15px,1.9vh,18px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {loading ? t("Loading...") : metas.length > 0 ? t("{n} results", { n: metas.length }) : ""}
          </span>
        </div>
      )}

      <div
        data-bp-scroll-y
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1200) loadMore();
        }}
        className="relative -mx-[14px] min-h-0 flex-1 overflow-y-auto px-[14px] pt-[6px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {loading || manifestLoading ? (
          <BpAddonSkeleton />
        ) : metas.length > 0 ? (
          <div
            data-bp-grid
            className="grid gap-[clamp(10px,0.95vw,19px)] pb-[44px] pt-[14px]"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            {metas.map((m, i) => (
              <BpTile key={`${m.id}-${i}`} meta={m} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[30vh] flex-col items-center justify-center gap-[clamp(16px,2.2vh,32px)] px-6 text-center">
            <p className="max-w-[46ch] text-[clamp(18px,2.4vh,24px)] font-medium leading-snug text-ink-subtle">
              {empty
                ? t("This addon provides streams only. It has no catalog to browse, but it still works behind every title you open.")
                : t("This catalog came back empty. Try another one, or check the addon in Settings.")}
            </p>
            {/* A stream-only addon renders no chips and no grid, and a page with
                nothing data-bp-focusable sends the next arrow press into the top
                bar while the hint bar still promises Select. One real control is
                what makes this a screen rather than a dead end. */}
            {empty && (
              <button
                type="button"
                data-bp-focusable
                data-bp-chip
                data-bp-autofocus="true"
                data-bp-restore-key="addon:back"
                onClick={() => {
                  SFX.click();
                  popBigPicture();
                }}
                className="h-[clamp(56px,6.6vh,68px)] rounded-full border border-[var(--bp-edge-2)] px-[clamp(24px,2.2vw,40px)] text-[clamp(17px,2.2vh,22px)] font-semibold text-ink transition-colors duration-[var(--bp-dur-fast)]"
              >
                {t("Back")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// PLATES, the rule bp-page-skeleton records and this page was never brought
// along to. Eighteen animate-pulse plates are eighteen live offscreen passes
// against a cliff that saturates at eight, and they ran for as long as a slow
// addon host kept loading true.
function BpAddonSkeleton() {
  return (
    <div aria-hidden className="pb-6 pt-1">
      <div
        className="grid gap-[clamp(10px,0.95vw,19px)]"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            data-bp-plate
            className="rounded-sm bg-[var(--bp-panel)]"
            style={{ aspectRatio: "2 / 3" }}
          />
        ))}
      </div>
    </div>
  );
}
