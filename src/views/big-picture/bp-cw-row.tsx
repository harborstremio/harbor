import { useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { pushBigPicture } from "@/lib/big-picture";
import { readSnapshot, useSnapshotVersion } from "@/lib/snapshots";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { episodeFromVideoId, isAnimeCwItem, libraryMetaType, type LibraryItem } from "@/lib/stremio";
import { forceBpMeta, publishBpMeta, registerBpTarget } from "./bp-focus-meta";
import { requestBpPlay } from "./bp-play-request";
import { useBpT } from "./bp-i18n";
import {
  BP_FLUID_BOX,
  bpBoxCss,
  bpBoxPx,
  bpHeroArt,
  type BpArtBox,
} from "./bp-art";
import { BpArt } from "./bp-art-img";
import { useBpArt } from "./use-bp-art";
import {
  BpCwCardBadges,
  BpCwCardPill,
  BpCwWatcher,
  bpCwCardLabel,
  useBpCwCardMeta,
} from "./bp-cw-card-meta";
import { BpRowHeader, type BpRowLead } from "./bp-row-header";

const CW_CARD_BOX: BpArtBox = { min: 268, vw: 23, max: 452 };
const CW_CARD_WIDTH = bpBoxCss(CW_CARD_BOX);
const CW_CARD_HEIGHT = `calc(${CW_CARD_WIDTH} * 0.5625)`;

// Snapshots are capped at ~30KB each, so they stay behind the real backdrop for
// the full-bleed hero even though the card itself leads with them.
export function cwMeta(item: LibraryItem, resolved?: string): Meta {
  return {
    id: item._id,
    type: libraryMetaType(item.type),
    name: item.name,
    poster: item.poster,
    background: bpHeroArt(item.background ?? readSnapshot(item._id) ?? resolved ?? undefined),
  };
}

type T = (key: string, vars?: Record<string, string | number>) => string;

function episodeLabel(i: LibraryItem, t: T): string {
  if (i.type === "movie") return "";
  const s = i.state?.season ?? 0;
  const e = i.state?.episode ?? 0;
  const parsed = e > 0 ? { season: s, episode: e } : episodeFromVideoId(i.state?.video_id ?? "");
  if (!parsed || !parsed.episode) return "";
  return isAnimeCwItem(i)
    ? t("Episode {n}", { n: parsed.episode })
    : t("S{s} E{e}", { s: parsed.season, e: parsed.episode });
}

function remainingLabel(i: LibraryItem, t: T): string {
  const dur = i.state?.duration ?? 0;
  const off = i.state?.timeOffset ?? 0;
  if (dur <= 0 || i.external) return "";
  const mins = Math.max(0, Math.round((dur - off) / 60000));
  if (mins < 1) return t("Almost done");
  if (mins < 60) return t("{n}m left", { n: mins });
  return t("{h}h {m}m left", { h: Math.floor(mins / 60), m: mins % 60 });
}

type BpCwResume = { resumeAt: { season: number; episode: number } | null };

// One-press resume needs POSITIVE evidence that this card can name what it would
// play. The previous gate excluded upNext and waitingForAir, but useMobileCw
// (bp-home and bp-shows) never sets either field, so on those two surfaces the
// gate was always false and every series card took the play path. Losing the
// resulting race in BpDetail autoplays the premiere and writes it over the real
// resume point in Stremio cloud. Absence of a warning flag is not evidence, so
// this asks what the item positively knows instead.
function bpCwResume(item: LibraryItem, progress: number): BpCwResume | null {
  if (progress <= 0) return null;
  if (item.upNext === true) return null;
  if ((item as unknown as Record<string, unknown>).waitingForAir === true) return null;
  if (item.type === "movie") return { resumeAt: null };
  // Anime CW ids carry absolute numbering that does not map onto season and
  // episode, and BpDetail's own anime.resume already owns that resolution.
  if (isAnimeCwItem(item)) return null;
  const s = item.state?.season ?? 0;
  const e = item.state?.episode ?? 0;
  const at = e > 0 ? { season: s, episode: e } : episodeFromVideoId(item.state?.video_id ?? "");
  if (!at || at.season <= 0 || at.episode <= 0) return null;
  return { resumeAt: { season: at.season, episode: at.episode } };
}

export function BpCwCard({
  item,
  onSelect,
  autofocus,
  fluid,
}: {
  item: LibraryItem;
  onSelect: (m: Meta) => void;
  autofocus?: boolean;
  fluid?: boolean;
}) {
  const dur = item.state?.duration ?? 0;
  const off = item.state?.timeOffset ?? 0;
  const progress = dur > 0 ? Math.min(1, Math.max(0, off / dur)) : 0;
  const boxRef = useRef<HTMLButtonElement | null>(null);
  const snapshots = useSnapshotVersion();
  const pinned = useMemo(
    () => (item.background ? undefined : (readSnapshot(item._id) ?? undefined)),
    [item._id, item.background, snapshots],
  );
  const art = useBpArt({
    ref: boxRef,
    id: item._id,
    type: item.type,
    shape: "wide",
    pinned,
    poster: item.poster,
    background: item.background,
    // Fluid cells come from WIDE_COLUMNS and run wider than this card, so the
    // two name their own boxes rather than sharing one request.
    targetWidth: bpBoxPx(fluid ? BP_FLUID_BOX.wide : CW_CARD_BOX),
  });
  const src = useProxiedImageSrc(art.url);
  const meta = useMemo(() => cwMeta(item, art.url), [item, art.url]);
  const [loaded, setLoaded] = useState(false);
  const t = useBpT();
  const ep = episodeLabel(item, t);
  const left = remainingLabel(item, t);
  const card = useBpCwCardMeta(item, boxRef);
  const [badLogo, setBadLogo] = useState<string | null>(null);
  // The clear logo takes the title line inside the scrim rather than floating
  // over the middle of the art: the scrim is the only part of the card with
  // guaranteed contrast, and a logo plus a text title is the same name twice.
  const logo = card.logo && card.logo !== badLogo ? card.logo : null;

  const onPress = () => {
    // Anything this card cannot name goes to the detail page, which can take its
    // time resolving the right episode without a half-second deadline.
    const resume = bpCwResume(item, progress);
    if (!resume) {
      onSelect(meta);
      return;
    }
    const metaId = `${meta.type}:${meta.id}`;
    forceBpMeta(meta);
    requestBpPlay(metaId, resume.resumeAt);
    pushBigPicture({ kind: "detail", metaId });
  };

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile="wide"
      data-bp-autofocus={autofocus ? "true" : undefined}
      data-bp-restore-key={item._id}
      ref={(el) => {
        boxRef.current = el;
        registerBpTarget(el, { meta, cwItem: item });
      }}
      onFocus={() => publishBpMeta(meta, item)}
      onClick={onPress}
      aria-label={bpCwCardLabel(item, ep, left, card, t)}
      className={`group relative overflow-hidden rounded-[var(--bp-r-xs)] bg-[var(--bp-panel)] text-start ${
        fluid ? "w-full" : "shrink-0"
      }`}
      style={{ width: fluid ? undefined : CW_CARD_WIDTH, aspectRatio: "16 / 9" }}
    >
      <BpArt
        src={src}
        onLoad={() => setLoaded(true)}
        onError={art.onError}
        className={`object-cover transition-opacity duration-[var(--bp-dur-slow)] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
        style={{ background: "var(--bp-scrim-up)" }}
      />
      <BpCwCardBadges watched={card.watched} newEpisode={card.newEpisode} />
      <span data-bp-cw-pad className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-[clamp(11px,1.3vw,20px)]">
        <span className="flex items-end justify-between gap-[clamp(8px,0.8vw,14px)]">
          <span className="flex min-w-0 flex-1 flex-col items-start gap-[clamp(4px,0.6vh,8px)]">
            {logo ? (
              <img
                src={logo}
                alt=""
                decoding="async"
                loading="lazy"
                onError={() => setBadLogo(card.logo ?? null)}
                data-bp-cw-logo
                className="max-h-[clamp(24px,3.8vh,52px)] w-auto max-w-[76%] object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
              />
            ) : (
              <span data-bp-cw-title className="line-clamp-1 text-[clamp(14px,1.98vh,23px)] font-bold leading-tight text-ink">
                {item.name}
              </span>
            )}
            <BpCwCardPill
              sub={ep}
              external={item.external}
              meta={card}
              remaining={left}
            />
          </span>
          {card.watcher && <BpCwWatcher watcher={card.watcher} />}
        </span>
        <span className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-[var(--bp-edge-2)]">
          <span
            className="block h-full rounded-full bg-[var(--bp-touch)]"
            style={{ width: `${progress * 100}%` }}
          />
        </span>
      </span>
    </button>
  );
}

const CW_PLACEHOLDERS = 5;

export function BpCwRow({
  items,
  onSelect,
  autofocusFirst,
  lead,
  loading,
}: {
  items: LibraryItem[];
  onSelect: (m: Meta) => void;
  autofocusFirst?: boolean;
  lead?: BpRowLead;
  loading?: boolean;
}) {
  useSnapshotVersion();
  const t = useBpT();
  // Holding the row's height while the library resolves is what stops home
  // reflowing under the ring. Empty and settled still collapses, so the rail
  // wrapper hides it and the index is skipped rather than missing.
  //
  // The placeholders below are NOT focusable, and the label tile that used to
  // stand beside them was. So for the length of the library resolve this row is
  // a rail index holding nothing focusable, which bpRailStep skips: Down out of
  // it steps to the catalog instead of stopping on cards that are not there yet.
  // That is the right answer for a row you cannot act on, and it is only safe
  // because home never seeds the ring here (seedRow is "cw" only once cwReady
  // and cw.length > 0). Do not aim an autofocus at this row before it settles.
  if (items.length === 0 && !loading) return null;

  const title = lead?.title ?? t("Jump back in");

  return (
    <section
      data-bp-row
      data-bp-row-key="cw"
      data-bp-row-tab={lead?.tab}
      aria-label={lead ? title : undefined}
      className="relative"
    >
      <BpRowHeader title={title} lead={lead} />
      <div
        data-bp-scroll-x
        className="flex gap-[var(--bp-track-gap)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(12px,1.5vh,24px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <BpCwCard
            key={item._id}
            item={item}
            onSelect={onSelect}
            autofocus={autofocusFirst && i === 0}
          />
        ))}
        {items.length === 0 && (
          // Grouped, and the group is what the sweep sits on rather than the
          // track. The track reserves 60px of bottom padding for a focused
          // card's bloom and pulls 38px of it back with a negative margin, so a
          // band spanning the track would light bare canvas under the last row
          // of plates. This box is exactly the plates.
          //
          // Nothing in here is focusable, before or after. The row stays a rail
          // index holding no focusable, which bpRailStep steps over, which is
          // the documented behaviour of this branch and not a regression.
          <div aria-hidden className="relative flex shrink-0 gap-[var(--bp-track-gap)]">
            {Array.from({ length: CW_PLACEHOLDERS }).map((_, i) => (
              <div
                key={i}
                style={{ height: CW_CARD_HEIGHT, width: CW_CARD_WIDTH }}
                className="shrink-0 rounded-[var(--bp-r-xs)] bg-[var(--bp-panel)]"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
