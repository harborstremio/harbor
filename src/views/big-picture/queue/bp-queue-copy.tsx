import { useEffect, useMemo, useState } from "react";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { useSettings } from "@/lib/settings";
import { useTitleLogo } from "@/lib/title-logo";
import { BP_COPY_IN, BP_COPY_OUT } from "../bp-backdrop-commit";
import { useBpEnrichFor } from "../use-bp-enrich";
import type { BpQueueEntry } from "./use-bp-queue";

export const BP_QUEUE_TITLE =
  "font-display text-[clamp(28px,5vh,74px)] font-semibold leading-[1.02] tracking-[-0.025em] text-ink drop-shadow-[0_3px_20px_rgba(0,0,0,0.65)]";

function BpQueueLogo({ title, logo }: { title: string; logo?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [logo]);

  if (!logo || failed) return <h1 className={BP_QUEUE_TITLE}>{title}</h1>;

  return (
    <img
      src={logo}
      alt={title}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      style={{ opacity: loaded ? 1 : 0, transition: "opacity var(--bp-dur-slow) var(--bp-ease)" }}
      className="max-h-[clamp(56px,11vh,180px)] w-auto max-w-[min(42vw,700px)] object-contain object-left drop-shadow-[0_6px_26px_rgba(0,0,0,0.7)] rtl:object-right"
    />
  );
}

/**
 * The gated copy column.
 *
 * `entry` is the live cursor and drives the enrichment and logo lookups, so only
 * one title is ever being fetched. `shown` is what the gate has released and is
 * the only thing printed. One block, one fade: four separately staggered fades
 * would read as a web page.
 */
export function BpQueueCopy({
  entry,
  shown,
  on,
}: {
  entry: BpQueueEntry | null;
  shown: BpQueueEntry | null;
  on: boolean;
}) {
  const { settings } = useSettings();
  const meta = entry?.meta ?? null;
  const slides = useMemo(() => (meta ? [meta] : []), [meta]);
  const logos = useHeroLogos(slides, settings);
  const pinned = useTitleLogo(meta?.id);
  const logo = useProxiedImageSrc(pinned ?? (meta ? (logos[meta.id] ?? meta.logo) : undefined));
  const enrich = useBpEnrichFor(meta);

  const seen = shown?.meta ?? null;
  // Tagged, never bare: the enrichment is one render ahead of the gated copy
  // while a step is in flight, so an untagged read prints the incoming title's
  // runtime and genres under the outgoing title's name.
  const detail = seen && enrich.id === seen.id ? enrich.detail : null;

  const facts = seen
    ? [
        detail?.year ?? seen.releaseInfo,
        detail?.runtime ?? seen.runtime,
        detail?.rating ?? seen.imdbRating,
        ...(detail?.genres ?? seen.genres ?? []).slice(0, 2),
      ]
        .filter(Boolean)
        .map(String)
    : [];
  const overview = detail?.overview || seen?.description || "";

  return (
    <div
      data-bp-xfade
      className={`flex flex-col items-start gap-[clamp(7px,1vh,16px)] ${on ? BP_COPY_IN : BP_COPY_OUT}`}
    >
      {seen && <BpQueueLogo title={seen.name} logo={logo} />}
      {facts.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-[clamp(7px,0.8vw,14px)] gap-y-1 text-[clamp(12px,1.7vh,20px)] font-semibold tabular-nums text-ink-muted">
          {facts.map((fact, i) => (
            <span key={`${fact}-${i}`} className="flex items-center gap-[clamp(7px,0.8vw,14px)]">
              {i > 0 && (
                <span aria-hidden className="opacity-40">
                  •
                </span>
              )}
              {fact}
            </span>
          ))}
        </div>
      )}
      {overview && (
        <p className="line-clamp-3 max-w-[min(40vw,680px)] text-[clamp(13px,1.8vh,21px)] leading-[1.5] text-ink-muted">
          {overview}
        </p>
      )}
    </div>
  );
}
