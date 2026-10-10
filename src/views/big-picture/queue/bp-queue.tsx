import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Settings, type LucideIcon } from "lucide-react";
import { goBigPictureTab } from "@/lib/big-picture";
import type { Meta } from "@/lib/cinemeta";
import { isRtl, useUiLanguage } from "@/lib/i18n";
import { SFX } from "@/lib/sfx";
import { bpHeroArt } from "../bp-art";
import { pushBpBack, runBpBack } from "../bp-back";
import { useBpCopyGate } from "../bp-backdrop-commit";
import { BpConfirm } from "../bp-confirm";
import { BP_HERO_RING } from "../bp-hero-style";
import { useBpT } from "../bp-i18n";
import { requestBpPlay } from "../bp-play-request";
import { currentBpFocus, recoverBpFocus } from "../use-bp-focus";
import { BP_QUEUE_TITLE, BpQueueCopy } from "./bp-queue-copy";
import { setBpQueueKeyHandler } from "./bp-queue-key";
import { BpQueueRail } from "./bp-queue-rail";
import {
  BP_QUEUE_HINT_CLEAR,
  BpQueuePosition,
  BpQueueStage,
  BpQueueThumb,
} from "./bp-queue-stage";
import { useBpQueue } from "./use-bp-queue";
import { useBpQueueArt } from "./use-bp-queue-art";

const DECK_KEY = "bp-queue:deck";
const CLICK_MS = 90;
const PREFETCH_MS = 400;

const RAIL_BOTTOM = `calc(${BP_QUEUE_HINT_CLEAR} + clamp(10px,1.4vh,22px))`;
const RAIL_ZONE = "clamp(96px,11vh,132px)";
const COPY_GAP = "clamp(18px,2.4vh,38px)";
const CHIP = "clamp(58px,6.6vh,80px)";

// The token sheet gives every unfocused [data-bp-row] content-visibility auto
// with 340px of reserved height, sized for a poster row. Both rows here are
// permanently on screen, so the skip buys nothing and the reserve would shove
// the rail off the bottom the instant the ring left it. Same fix as
// player/bp-player-shell.tsx:36. The gutter padding and its negative margin go
// with it on the deck: the deck is an absolutely placed full-region hit area,
// and the bleed would push its measured rect a gutter past both screen edges.
const DECK_ROW: CSSProperties = {
  contentVisibility: "visible",
  paddingInline: 0,
  marginInline: 0,
};

const RAIL_ROW: CSSProperties = { contentVisibility: "visible", marginInline: 0 };

const TRACK =
  "flex items-center gap-[clamp(10px,0.9vw,18px)] overflow-x-auto py-[34px] -my-[34px] ps-[26px] -ms-[26px] pe-[26px] -me-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type Slot = {
  key: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
  flip?: boolean;
  onPress: () => void;
};

function BpQueueSlotRail({ slots }: { slots: Slot[] }) {
  return (
    <section data-bp-row data-bp-row-key="queue-rail" style={RAIL_ROW}>
      <div data-bp-scroll-x className={TRACK}>
        {slots.map((slot) => {
          const Icon = slot.icon;
          return (
            <button
              key={slot.key}
              type="button"
              data-bp-focusable
              data-bp-restore-key={`bp-queue:${slot.key}`}
              onClick={slot.onPress}
              style={{ height: CHIP }}
              className={`flex shrink-0 items-center gap-[clamp(9px,0.8vw,15px)] rounded-full px-[clamp(24px,2.2vw,46px)] text-[clamp(14px,1.9vh,23px)] font-semibold ${
                slot.primary
                  ? "bg-[var(--bp-on)] text-ink"
                  : "border border-[var(--bp-edge-2)] text-ink"
              } ${BP_HERO_RING}`}
            >
              <Icon size={22} strokeWidth={2.1} className={slot.flip ? "rtl:rotate-180" : ""} />
              {slot.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function BpQueue({ onSelect }: { onSelect: (m: Meta) => void }) {
  const t = useBpT();
  const rtl = isRtl(useUiLanguage());
  const queue = useBpQueue();
  const art = useBpQueueArt(queue.current);
  const [zone, setZone] = useState<"deck" | "rail">("deck");
  const [confirming, setConfirming] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [refused, setRefused] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const entry = queue.current;
  const ready = queue.status === "ready" && entry !== null;
  const total = queue.entries.length;
  const ordinal = ready ? String(queue.index + 1).padStart(String(total).length, "0") : "";

  // Empty until the ladder has committed something, and only then the entry id.
  // useBpCopyGate promotes its very first key synchronously with no wait, which
  // on a surface with a row of art already behind it is right and here is text
  // alone on a bare field for the whole decode. Holding the key empty parks the
  // block at on=false until there is a picture to put it on.
  const gateKey = entry && art.key ? `queue:${entry.meta.id}` : "";
  const copy = useBpCopyGate(entry, gateKey);

  const clickedAt = useRef(0);
  const stepRef = useRef(queue.step);
  const zoneRef = useRef(zone);
  stepRef.current = queue.step;
  zoneRef.current = zone;

  // Registered with the shell rather than a listener of its own. stopPropagation
  // does not stop a sibling listener on the same object, so a second window
  // handler would step twice per press: the bug bp-guide-key.ts:7 records.
  useEffect(() => {
    if (!ready || confirming || dialog) return;
    setBpQueueKeyHandler((dir) => {
      if (dir === "up" || dir === "down") return false;
      if (zoneRef.current !== "deck") return false;
      const forward = rtl ? dir === "left" : dir === "right";
      // Declined, never claimed-and-ignored. Falling through hands the press to
      // spatial nav, which finds no sibling inside the deck row and answers with
      // the shake and the hover tick. Claiming it would play an affirmative
      // click and move nothing. The chevron on that side answers the press,
      // because the shell's nudge animates whatever holds the ring and here
      // that is a transparent full-screen cell.
      if (!stepRef.current(forward ? 1 : -1)) {
        setRefused((v) => v + 1);
        return false;
      }
      const now = Date.now();
      if (now - clickedAt.current > CLICK_MS) {
        clickedAt.current = now;
        SFX.click();
      }
      return true;
    });
    return () => setBpQueueKeyHandler(null);
  }, [ready, confirming, dialog, rtl]);

  // The confirm registers nothing of its own, so without this Escape pops the
  // whole queue out from under an open dialog.
  useEffect(() => {
    if (!confirming) return;
    return pushBpBack(() => {
      setConfirming(false);
      return true;
    });
  }, [confirming]);

  // The zone is set by onFocus alone, so a rail that unmounts under the ring
  // leaves it reading "rail" with nothing focused and the art veiled for good.
  useEffect(() => {
    if (!ready) setZone("deck");
  }, [ready]);

  // Blocking the last entry tears down both the rail and the confirm in one
  // commit, and BpConfirm only hands the ring back if the element it took it
  // from is still connected. The route settle pass cannot cover this either: it
  // is disarmed the moment the overlay opens. Nothing focused is a dead screen.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root || currentBpFocus(root)) return;
      recoverBpFocus(root);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ready, confirming, dialog, queue.status]);

  useEffect(() => {
    const url = queue.next?.meta.background ?? queue.next?.meta.poster;
    if (!url) return;
    const id = window.setTimeout(() => {
      const warm = new Image();
      warm.decoding = "async";
      warm.src = bpHeroArt(url) ?? url;
    }, PREFETCH_MS);
    return () => window.clearTimeout(id);
  }, [queue.next]);

  const onPlay = () => {
    if (!entry) return;
    // openPicker would put the mouse-only desktop frame over the ten-foot UI,
    // the trap bp-quick-panel.tsx:126 records. Play lands on the detail route.
    requestBpPlay(`${entry.meta.type}:${entry.meta.id}`);
    onSelect(entry.meta);
  };

  const heading =
    queue.status === "empty" ? t("Nothing left in today's picks") : t("Discovery Queue");

  const blurb =
    queue.status === "nokey"
      ? t("Add a TMDB key in Settings to unlock the full discovery feed.")
      : queue.status === "unreachable"
        ? t("No picks loaded. TMDB might be unreachable.")
        : queue.status === "empty"
          ? t("Come back tomorrow, or clear what you skipped in Settings.")
          : "";

  const back: Slot = {
    key: "back",
    label: t("Back to Discover"),
    icon: ArrowLeft,
    flip: true,
    onPress: () => {
      runBpBack();
    },
  };

  const slots: Slot[] =
    queue.status === "nokey"
      ? [
          {
            key: "settings",
            label: t("Open Settings"),
            icon: Settings,
            primary: true,
            onPress: () => goBigPictureTab("settings"),
          },
          back,
        ]
      : [back];

  return (
    <div ref={rootRef} className="absolute inset-0">
      <BpQueueStage
        art={ready ? art : null}
        dir={queue.dir}
        dimmed={zone === "rail"}
        loading={queue.status === "loading"}
        focused={zone === "deck"}
        atStart={!ready || queue.index <= 0}
        atEnd={!ready || queue.index >= total - 1}
        ordinal={ordinal}
        refused={refused}
      />

      <div className="absolute inset-0 flex flex-col" style={{ paddingBottom: RAIL_BOTTOM }}>
        <div data-bp-rail-row="0" className="relative min-h-0 flex-1">
          {/* One transparent full-region cell, never a tile: data-bp-tile would
              scale the entire screen by 1.06. It stops at the top of the rail
              zone, or Down out of it has two overlapping rects to rank. It also
              carries the surface's only autofocus marker, because every seeding
              path reads that attribute and the deck is the one cell where Left
              and Right step the queue and the art is not veiled. */}
          <section data-bp-row data-bp-row-key="queue-deck" className="h-full" style={DECK_ROW}>
            <button
              type="button"
              data-bp-focusable
              data-bp-autofocus="true"
              data-bp-restore-key={DECK_KEY}
              aria-label={entry ? entry.meta.name : t("Discovery Queue")}
              onFocus={() => setZone("deck")}
              onClick={onPlay}
              className="absolute inset-0 cursor-default"
            />
          </section>

          <div
            className="pointer-events-none absolute flex flex-col gap-[clamp(8px,1.1vh,18px)]"
            style={{
              insetInlineStart: "var(--bp-gutter)",
              bottom: COPY_GAP,
              maxWidth: "min(46vw, 760px)",
              zIndex: 7,
            }}
          >
            {(ready || queue.status === "loading") && (
              <BpQueuePosition
                index={queue.index}
                total={ready ? total : 0}
                tag={copy.shown ? t(copy.shown.tag) : ready ? "" : t("Loading…")}
                tagOn={copy.shown ? copy.on : true}
              />
            )}
            {ready ? (
              <BpQueueCopy entry={entry} shown={copy.shown} on={copy.on} />
            ) : (
              <div className="flex flex-col gap-[clamp(7px,1vh,16px)]">
                <h1 className={BP_QUEUE_TITLE}>{heading}</h1>
                {blurb && (
                  <p className="max-w-[min(40vw,680px)] text-[clamp(13px,1.8vh,21px)] leading-[1.5] text-ink-muted">
                    {blurb}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          data-bp-rail-row="1"
          className="shrink-0"
          style={{ minHeight: RAIL_ZONE }}
          onFocus={() => setZone("rail")}
        >
          {ready && entry ? (
            <BpQueueRail
              entry={entry}
              onPlay={onPlay}
              onDetails={() => onSelect(entry.meta)}
              onSkip={queue.snooze}
              onBlock={() => setConfirming(true)}
              onDialog={setDialog}
            />
          ) : (
            <BpQueueSlotRail slots={slots} />
          )}
        </div>
      </div>

      <BpQueueThumb index={queue.index} total={total} />

      {/* Outside the rail parent, against a box that spans the whole surface: it
          is absolute inset-0 z-[70], so mounted inside any smaller positioned
          wrapper its scrim would cover that wrapper alone. Last in DOM order so
          bpFocusScope resolves it as the live scope. */}
      {confirming && entry && (
        <BpConfirm
          title={t("Hide this permanently?")}
          body={t("{title} will not come back in the Discovery Queue.", {
            title: entry.meta.name,
          })}
          cancelLabel={t("Keep")}
          confirmLabel={t("Not interested")}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            queue.block();
          }}
        />
      )}
    </div>
  );
}
