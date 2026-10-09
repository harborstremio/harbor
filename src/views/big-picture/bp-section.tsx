import { useMemo, useState } from "react";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { useBpT } from "./bp-i18n";
import { useBpFocusedMeta } from "./bp-focus-meta";
import { BP_COPY_IN, BP_COPY_OUT, BP_META_SETTLE_MS, useBpCopyGate } from "./bp-backdrop-commit";
import type { BpBand, BpBandArt } from "./use-bp-sections";

const SUBJECT_MARK =
  "h-[clamp(64px,9vh,118px)] w-auto max-w-[min(46vw,780px)] self-start object-contain drop-shadow-[0_6px_26px_rgba(0,0,0,0.7)]";

const SUBJECT_TEXT =
  "font-display text-[clamp(30px,5.4vh,76px)] font-semibold leading-[0.98] tracking-[-0.03em] text-ink drop-shadow-[0_3px_16px_rgba(0,0,0,0.6)]";

const BUG = "h-[clamp(20px,2.6vh,38px)] w-auto max-w-[clamp(56px,7vw,130px)] object-contain";

type Subject = { band: BpBand; art: BpBandArt | null };

// The subject branch already proxies nothing because a service mark is always
// https off Harbor's own hosts. A bug can be an addon's self-hosted mark over
// plain http, which the WebView refuses as mixed content, so this branch needs
// the Rust round trip and a failure path or the eyebrow keeps a blank gap.
function BpBandBug({ src }: { src: string }) {
  const url = useProxiedImageSrc(src);
  const [dead, setDead] = useState(false);
  if (!url || dead) return null;
  return <img src={url} alt="" onError={() => setDead(true)} className={BUG} />;
}

export function BpBandIdentity({
  band,
  art,
  up,
}: {
  band: BpBand | null;
  art: BpBandArt | null;
  up: boolean;
}) {
  const t = useBpT();
  const [markBroken, setMarkBroken] = useState("");
  const meta = useBpFocusedMeta(BP_META_SETTLE_MS);

  // A band-owned band waits on its own backdrop. A card-owned band announces
  // itself over the focused card's art, so it waits on the card commit: keying
  // it on the band instead would name a key nothing ever publishes and every
  // announcement would sit out the full copy ceiling before appearing.
  const key = !band
    ? ""
    : band.owns === "band"
      ? `band:${band.id}:${art?.key ?? ""}`
      : `card:${meta?.id ?? ""}`;

  // Both halves are stable references: band is a module constant and art is the
  // record the bus is holding, so this composite only changes when the subject
  // genuinely does and the gate never re-fades on a re-render.
  const subject = useMemo<Subject | null>(() => (band ? { band, art } : null), [band, art]);
  const { shown, on } = useBpCopyGate(subject, key);

  if (!shown) return null;

  const line = shown.art?.line ?? t(shown.band.line);
  const mark = shown.art?.logoScale === "subject" ? shown.art.logo : undefined;
  const bug = shown.art?.logoScale === "bug" ? shown.art.logo : undefined;
  const showMark = Boolean(mark) && markBroken !== shown.art?.key;

  return (
    <div
      aria-hidden
      data-bp-xfade
      className={`pointer-events-none absolute inset-0 flex flex-col justify-end px-[var(--bp-gutter)] pb-[clamp(26px,3.6vh,58px)] ${
        up && on ? BP_COPY_IN : BP_COPY_OUT
      }`}
    >
      <span className="flex items-center gap-[clamp(8px,0.9vw,16px)]">
        {bug && <BpBandBug key={bug} src={bug} />}
        <span className="text-[clamp(10px,1.3vh,15px)] font-bold uppercase tracking-[0.18em] text-ink-subtle">
          {t(shown.band.eyebrow)}
        </span>
      </span>
      <span className="mt-[clamp(6px,0.8vh,12px)] h-px w-[clamp(38px,4vw,72px)] bg-[var(--bp-edge-2)]" />

      {/* art.title and art.line are runtime strings off the focused cell and
          must never reach t(). Only the band's own literals are translated. */}
      <span className="mt-[clamp(10px,1.4vh,20px)] flex">
        {showMark ? (
          <img
            src={mark}
            alt=""
            onError={() => setMarkBroken(shown.art?.key ?? "")}
            className={SUBJECT_MARK}
            style={{ filter: "var(--service-logo-filter)" }}
          />
        ) : (
          <span className={SUBJECT_TEXT}>{shown.art?.title ?? t(shown.band.title)}</span>
        )}
      </span>

      <span className="mt-[clamp(8px,1.2vh,18px)] max-w-[min(44vw,40rem)] text-[clamp(12.5px,1.75vh,21px)] leading-[1.5] text-ink-muted">
        {line}
      </span>
    </div>
  );
}
