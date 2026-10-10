import { Fragment, useState, type ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { addonLogoSrc, resolveAddonLogo } from "@/components/addon-logo";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { SFX } from "@/lib/sfx";
import { BP_TILE_BOX, bpBoxCss } from "../bp-art";
import { BP_DETAIL_TRACK_TIGHT } from "../detail/bp-detail-chrome";
import { useBpT } from "../bp-i18n";

// The engine's own vocabulary, from AddonQueryState. Keeping "empty" distinct from
// "failed" is the whole reason AddonQuery exists, so renaming or collapsing either
// one here puts an addon that answered with nothing back in the same silence as an
// addon that was never reachable.
export type BpGroupState = "pending" | "ok" | "empty" | "failed";

export type BpGroupShape = "hero" | "wide" | "poster" | "people" | "banner" | "card";

export type BpGroupCell = { key: string; node: ReactNode };

export type BpGroupSource = { id: string; name: string; logo?: string };

export type BpSearchGroupProps = {
  rowKey: string;
  title: string;
  state: BpGroupState;
  shape: BpGroupShape;
  cells: BpGroupCell[];
  count?: number;
  source?: BpGroupSource;
  /** A character portrait, drawn round. Never an addon logo: `source` owns that. */
  portrait?: string;
  onRetry?: () => void;
};

const TRACK = BP_DETAIL_TRACK_TIGHT;

const HEAD =
  "mb-[clamp(9px,1.1vh,16px)] flex items-center gap-[clamp(8px,0.7vw,14px)] px-[var(--bp-gutter)]";

const MARK = "h-[clamp(22px,2.7vh,38px)] w-[clamp(22px,2.7vh,38px)] shrink-0";

// A QUIET plate. This was animate-pulse, and search is the one surface that
// rebuilds every skeleton on every debounced keystroke: buildBpSearchSlots
// declares nine fixed rows plus one per installed addon before a request goes
// out, so ten addons put well past a hundred group opacities on screen at once
// against a cliff that saturates at eight. bp-page-skeleton.tsx:6-15 and
// bp-anime-row.tsx:81-84 both record the trade.
const PLATE = "bg-[var(--bp-panel)]";

const SKELETON_ROW = "flex shrink-0 gap-[clamp(9px,0.85vw,17px)]";

const PEOPLE_CELL = "clamp(112px, 9vw, 168px)";

type ShapeSpec = { w: string; ratio?: string; h?: string; round: string; n: number };

// The skeleton has to match the real cell it stands in for. A generic block
// changes the row height when content lands, which moves every offsetTop below
// it and drags the rail out from under a ring that is already navigating.
const SHAPE: Record<BpGroupShape, ShapeSpec> = {
  hero: { w: "clamp(360px, 30vw, 620px)", ratio: "16 / 9", round: "6px", n: 1 },
  wide: { w: bpBoxCss(BP_TILE_BOX.wide), ratio: "16 / 9", round: "6px", n: 7 },
  poster: { w: bpBoxCss(BP_TILE_BOX.poster), ratio: "2 / 3", round: "6px", n: 8 },
  people: { w: "clamp(84px, 6.8vw, 126px)", ratio: "1 / 1", round: "999px", n: 8 },
  banner: { w: "clamp(230px, 19vw, 340px)", ratio: "16 / 9", round: "6px", n: 5 },
  // Measured off BpChannelCell, not guessed: width clamp(230,19vw,340), height is
  // 2 x clamp(9px,0.8vw,15px) of padding around a clamp(44px,3.4vw,62px) square.
  // An oversized plate here shrinks the row by up to 56px the moment channels land,
  // which is the reflow the shape table exists to prevent.
  card: { w: "clamp(230px, 19vw, 340px)", h: "clamp(62px, 5vw, 92px)", round: "6px", n: 4 },
};

// A slot only collapses once it has settled with nothing in it. Pending holds
// its height so the rail cannot reflow mid-flight, and a failed addon stays on
// screen because silently missing is what reads as a bad search.
export function bpGroupRenders(state: BpGroupState, cells: number): boolean {
  if (cells > 0) return true;
  return state === "pending" || state === "failed";
}

// Two addons can carry the same id inside one merged row. React throws on a
// duplicate key in the same track, which takes the whole surface down.
function uniqueCells(cells: BpGroupCell[]): BpGroupCell[] {
  const seen = new Set<string>();
  const out: BpGroupCell[] = [];
  for (const c of cells) {
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  return out;
}

export function BpSearchGroup({
  rowKey,
  title,
  state,
  shape,
  cells,
  count,
  source,
  portrait,
  onRetry,
}: BpSearchGroupProps) {
  const t = useBpT();
  const shown = uniqueCells(cells);
  if (!bpGroupRenders(state, shown.length)) return null;

  const pending = state === "pending" && shown.length === 0;
  const failed = state === "failed" && shown.length === 0;

  return (
    <section
      data-bp-row
      data-bp-row-key={rowKey}
      aria-busy={pending || undefined}
      className="relative"
    >
      <BpGroupHead
        title={title}
        count={pending || failed ? undefined : (count ?? shown.length)}
        source={source}
        portrait={portrait}
        failed={failed}
      />
      <div data-bp-scroll-x className={TRACK}>
        {pending && <BpGroupSkeleton shape={shape} />}
        {failed && onRetry && (
          <BpGroupRetry rowKey={rowKey} shape={shape} label={t("Try again")} onRetry={onRetry} />
        )}
        {shown.map((c) => (
          <Fragment key={c.key}>{c.node}</Fragment>
        ))}
      </div>
    </section>
  );
}

function BpGroupHead({
  title,
  count,
  source,
  portrait,
  failed,
}: {
  title: string;
  count?: number;
  source?: BpGroupSource;
  portrait?: string;
  failed: boolean;
}) {
  const t = useBpT();
  return (
    <div className={HEAD}>
      {source ? <BpAddonMark source={source} /> : portrait ? <BpPortraitMark src={portrait} /> : null}
      <h2 className="min-w-0 truncate text-[clamp(14px,2.05vh,26px)] font-bold tracking-[-0.01em] text-ink">
        {title}
      </h2>
      {typeof count === "number" && (
        <span className="shrink-0 text-[clamp(10.5px,1.4vh,15px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          {count}
        </span>
      )}
      {failed && (
        <span className="shrink-0 rounded-full border border-[var(--bp-edge)] px-[clamp(8px,0.7vw,13px)] py-[2px] text-[clamp(10px,1.3vh,14px)] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {t("Didn't answer")}
        </span>
      )}
    </div>
  );
}

function BpPortraitMark({ src }: { src: string }) {
  const proxied = useProxiedImageSrc(src);
  return (
    <img
      src={proxied ?? src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={`${MARK} rounded-full bg-[var(--bp-panel-2)] object-cover`}
    />
  );
}

function BpAddonMark({ source }: { source: BpGroupSource }) {
  const [broken, setBroken] = useState(false);
  const bundled = addonLogoSrc(source.id, source.name);
  // A relative manifest logo resolves against the addon's own transport url,
  // which this row does not carry, so only an absolute one is safe to paint.
  const remote = resolveAddonLogo(source.logo, null);
  const chosen = broken ? bundled : (remote ?? bundled);
  // A plain-http manifest logo is refused by the WebView as mixed content, and
  // the onError fallback hides that behind a monogram, so the addon could never
  // show its own mark even though the proxy was right here. Provenance is the
  // entire point of this row.
  const proxied = useProxiedImageSrc(chosen ?? undefined);
  const src = proxied ?? chosen;

  if (!src) {
    return (
      <span
        aria-hidden
        className={`${MARK} flex items-center justify-center rounded-[var(--bp-r-xs)] bg-[var(--bp-panel-2)] text-[clamp(11px,1.4vh,17px)] font-bold text-ink-muted`}
      >
        {(source.name || "?").trim().charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`${MARK} rounded-[var(--bp-r-xs)] bg-[var(--bp-panel-2)] object-cover`}
    />
  );
}

function BpGroupRetry({
  rowKey,
  shape,
  label,
  onRetry,
}: {
  rowKey: string;
  shape: BpGroupShape;
  label: string;
  onRetry: () => void;
}) {
  const spec = SHAPE[shape];
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`retry:${rowKey}`}
      onClick={() => {
        SFX.click();
        onRetry();
      }}
      className="flex shrink-0 items-center justify-center gap-[clamp(7px,0.6vw,12px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge-2)] bg-[var(--bp-panel)] px-[clamp(14px,1.2vw,24px)] text-[clamp(12px,1.65vh,19px)] font-semibold text-ink-muted"
      style={{
        width: spec.w,
        aspectRatio: spec.ratio,
        height: spec.h,
        minHeight: "clamp(44px, 6vh, 74px)",
      }}
    >
      <RotateCw size={18} strokeWidth={2.2} className="shrink-0" />
      {label}
    </button>
  );
}

// The wrapper is a single flex child of the track, which is why it re-declares
// the track's own gap.
export function BpGroupSkeleton({ shape }: { shape: BpGroupShape }) {
  const spec = SHAPE[shape];
  const slots = Array.from({ length: spec.n }, (_, i) => i);

  if (shape === "people") {
    return (
      <div aria-hidden className={SKELETON_ROW}>
        {slots.map((i) => (
          <div
            key={i}
            className="flex shrink-0 flex-col items-center gap-[clamp(6px,0.8vh,11px)] p-[clamp(7px,0.7vw,13px)]"
            style={{ width: PEOPLE_CELL }}
          >
            <div
              data-bp-plate
              className={`rounded-full ${PLATE}`}
              style={{ width: spec.w, aspectRatio: spec.ratio }}
            />
            <div
              data-bp-plate
              className={`h-[clamp(9px,1.2vh,14px)] w-[82%] rounded-full ${PLATE}`}
            />
            <div
              data-bp-plate
              className={`h-[clamp(8px,1vh,12px)] w-[56%] rounded-full ${PLATE}`}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div aria-hidden className={SKELETON_ROW}>
      {slots.map((i) => (
        <div
          key={i}
          data-bp-plate
          className={`shrink-0 ${PLATE}`}
          style={{
            width: spec.w,
            aspectRatio: spec.ratio,
            height: spec.h,
            borderRadius: spec.round,
          }}
        />
      ))}
    </div>
  );
}
