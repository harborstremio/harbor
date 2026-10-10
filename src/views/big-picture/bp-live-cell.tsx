import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tv } from "lucide-react";
import { detectCountry, flagUrl } from "@/lib/iptv/country-detect";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { formatTimeLabel } from "@/views/live/guide/guide-utils";
import { channelNumber, fmtLeft } from "@/views/live/live-home/now-format";
import { useBpT } from "./bp-i18n";
import { bpLiveBandArt, type BpT } from "./bp-live-band-art";
import { bpCleanChannelName, bpCleanGroup, bpSameText } from "./bp-live-cell-text";
import { subscribeBpTick } from "./bp-live-tick";
import { publishBpBandArt } from "./use-bp-sections";
import type { NowItem } from "./use-bp-live";

export const BP_LIVE_TRACK =
  "flex gap-[clamp(11px,1vw,20px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export const BP_LIVE_CELL_WIDTH = "clamp(300px, 25vw, 440px)";
const CELL_MIN_HEIGHT = "clamp(152px, 20vh, 228px)";

const ART_SCRIM =
  "linear-gradient(102deg, color-mix(in oklab, var(--bp-void) 95%, transparent) 0%, color-mix(in oklab, var(--bp-void) 84%, transparent) 44%, color-mix(in oklab, var(--bp-void) 56%, transparent) 100%)";

const SHELL =
  "group relative flex shrink-0 flex-col overflow-hidden rounded-[var(--bp-r-lg)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] text-start";

const MARK =
  "shrink-0 text-[clamp(10px,1.32vh,14.5px)] font-bold uppercase tracking-[0.18em]";

const META = "line-clamp-1 text-[clamp(11px,1.5vh,16.5px)] font-semibold text-ink-muted";

const HEADLINE =
  "line-clamp-2 text-[clamp(14.5px,2.05vh,24px)] font-bold leading-[1.15] tracking-[-0.01em] text-ink";

const STRIP =
  "flex min-w-0 flex-1 items-center gap-[clamp(4px,0.35vw,8px)] text-[clamp(11px,1.5vh,16.5px)] font-semibold text-ink-subtle";

const PLATE_SIZE = { width: "clamp(52px, 4.2vw, 78px)", height: "clamp(32px, 2.6vw, 48px)" };

// subscribeBpTick, never a second interval of its own. This file used to run
// one, also at 10s, so Live damaged a frame twice per window at two phases that
// could never align, and the guide's clocks stepped at a different instant from
// the cards' progress bars. One ticker for the feature.

// The bar is written straight to the node. Ticking it through state would
// re-render every cell in the grid four hundred times an hour for two pixels.
function BpLiveProgress({ startMs, endMs }: { startMs: number; endMs: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const span = endMs - startMs;
      const ratio = span > 0 ? Math.max(0, Math.min(1, (Date.now() - startMs) / span)) : 0;
      const next = `${(ratio * 100).toFixed(2)}%`;
      if (el.style.width !== next) el.style.width = next;
    };
    apply();
    return subscribeBpTick(apply);
  }, [startMs, endMs]);

  return (
    <span
      aria-hidden
      className="block h-[4px] w-full overflow-hidden rounded-full bg-[var(--bp-edge-2)]"
    >
      <span ref={ref} className="block h-full rounded-full bg-[var(--bp-live)]" />
    </span>
  );
}

// Same reason as the bar: nowMs only advances at a programme boundary, so a
// once-composed "45m left" would sit there lying for the whole programme.
function BpTimeLeft({ endMs, t }: { endMs: number; t: BpT }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const fmt = useRef(t);
  fmt.current = t;

  const apply = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rest = fmtLeft(endMs, Date.now(), fmt.current);
    const next = rest ? ` · ${rest}` : "";
    if (el.textContent !== next) el.textContent = next;
  }, [endMs]);

  useEffect(() => subscribeBpTick(apply), [apply]);

  // useT hands back a fresh closure per render, so a language switch re-renders
  // this cell without touching the tick. Repainting here is what stops the
  // suffix sitting in the old language until the next ten second tick.
  useEffect(apply);

  return <span ref={ref} />;
}

export function BpGuideCell({
  item,
  sourceId,
  art,
  onPlay,
  onHot,
  autofocus,
  fluid,
}: {
  item: NowItem;
  sourceId: string;
  art?: string;
  onPlay: (item: NowItem) => void;
  onHot?: (item: NowItem | null) => void;
  autofocus?: boolean;
  fluid?: boolean;
}) {
  const t = useBpT();
  const { channel, current, next } = item;

  // Both of these hold the url that failed rather than a boolean, so hydration
  // arriving with a second, working image is not locked out by an earlier miss.
  const [brokenLogo, setBrokenLogo] = useState<string | null>(null);
  const [brokenArt, setBrokenArt] = useState<string | null>(null);

  // tvg-logo and the XMLTV icon are very often plain http, which the WebView
  // refuses as mixed content. The onError fallback then swaps in the glyph and
  // the failure is invisible, which is a large part of why the row reads grey.
  const logoUrl = channel.logo ?? undefined;
  const logoSrc = useProxiedImageSrc(logoUrl);
  const artSrc = useProxiedImageSrc(art);
  // While the proxy is still fetching, logoSrc is undefined and the plate falls
  // through to the glyph rather than an empty box. On a real failure the proxy
  // hands back the original url so the img errors and brokenLogo takes over.
  const showLogo = Boolean(logoSrc) && logoSrc !== brokenLogo;
  const showArt = Boolean(artSrc) && artSrc !== brokenArt;

  const chno = channelNumber(channel.attrs);
  const name = useMemo(() => bpCleanChannelName(channel.name), [channel.name]);
  const group = useMemo(() => bpCleanGroup(channel.group), [channel.group]);
  const flag = useMemo(() => {
    const c = detectCountry(channel);
    return c ? flagUrl(c.code) : null;
  }, [channel]);
  const sub = group && !bpSameText(group, name) ? group : "";

  // onHot fires off raw focus and blur, never off the settled band. bp-home
  // publishes the band on focusin but BpAmbient reads it through an 180ms
  // debounce, and a stream keyed off the settled band keeps decoding under the
  // next band's artwork after a fast pass through the row.
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile="wide"
      data-bp-autofocus={autofocus ? "true" : undefined}
      data-bp-restore-key={`iptv:${sourceId}:${channel.id}`}
      onFocus={() => {
        publishBpBandArt("live", bpLiveBandArt(item, sourceId, art, t));
        onHot?.(item);
      }}
      onBlur={() => onHot?.(null)}
      onClick={() => onPlay(item)}
      aria-label={current ? `${channel.name}, ${current.title}` : name}
      className={`${SHELL} ${fluid ? "w-full" : ""}`}
      style={{ width: fluid ? undefined : BP_LIVE_CELL_WIDTH, minHeight: CELL_MIN_HEIGHT }}
    >
      {showArt && (
        <img
          src={artSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBrokenArt(artSrc ?? null)}
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
      )}
      <span aria-hidden className="absolute inset-0" style={{ background: ART_SCRIM }} />

      <span className="relative flex h-full min-h-0 flex-1 flex-col gap-[clamp(6px,0.7vh,11px)] p-[clamp(13px,1.2vw,22px)]">
        <span className="flex items-center gap-[clamp(7px,0.6vw,12px)]">
          <span
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)]"
            style={PLATE_SIZE}
          >
            {showLogo ? (
              <img
                src={logoSrc}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setBrokenLogo(logoSrc ?? null)}
                className="max-h-[78%] max-w-[82%] object-contain"
              />
            ) : (
              <Tv size={19} strokeWidth={1.8} className="text-ink-subtle" />
            )}
          </span>
          <span className={STRIP}>
            {chno && <span className="shrink-0 tabular-nums opacity-70">{chno}</span>}
            {current ? (
              <span className="truncate">{channel.name}</span>
            ) : (
              flag && (
                <img
                  src={flag}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-[15px] w-[22px] shrink-0 rounded-[3px] object-cover ring-1 ring-[var(--bp-edge)]"
                />
              )
            )}
          </span>
          {current && (
            <span
              className={`${MARK} flex items-center gap-[5px]`}
              style={{ color: "var(--bp-live)" }}
            >
              {/* Static. A pulse here is an infinite opacity animation once per
                  card that has a programme, which is one permanent offscreen
                  pass per visible cell with nobody touching the remote. The
                  --bp-live fill and the word beside it already say it is on
                  air; bp-guide-portal draws the same dot still. */}
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: "var(--bp-live)" }}
              />
              {t("Live")}
            </span>
          )}
        </span>

        <span dir="auto" className={HEADLINE}>
          {current ? current.title : name}
        </span>

        {current ? (
          <span dir="auto" className={META}>
            {t("Started at {time}", { time: formatTimeLabel(current.startMs) })}
            <BpTimeLeft endMs={current.endMs} t={t} />
          </span>
        ) : (
          sub && (
            <span dir="auto" className={META}>
              {sub}
            </span>
          )
        )}

        {current ? (
          <span className="mt-auto flex flex-col gap-[clamp(6px,0.7vh,11px)]">
            {item.progress != null && (
              <BpLiveProgress startMs={current.startMs} endMs={current.endMs} />
            )}
            {next && (
              <span
                dir="auto"
                className="line-clamp-1 text-[clamp(11px,1.5vh,16.5px)] font-medium text-ink-subtle"
              >
                <span className="font-bold text-ink-muted">
                  {t("Next {time}", { time: formatTimeLabel(next.startMs) })}
                </span>
                {` · ${next.title}`}
              </span>
            )}
          </span>
        ) : (
          <span aria-hidden className="mt-auto" />
        )}
      </span>
    </button>
  );
}

// A quiet plate. The motion belongs to the BpShimmer band its caller puts over
// the whole strip of them, never to the plate itself: one animation per row
// instead of one per cell is the rule bp-tokens records beside [data-bp-shimmer].
// Both callers supply one, so do not re-add a pulse here.
export function BpGuideCellSkeleton({ fluid }: { fluid?: boolean }) {
  return (
    <div
      className={`shrink-0 rounded-[var(--bp-r-lg)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] ${
        fluid ? "w-full" : ""
      }`}
      style={{ width: fluid ? undefined : BP_LIVE_CELL_WIDTH, minHeight: CELL_MIN_HEIGHT }}
    />
  );
}
