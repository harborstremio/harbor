import { useMemo } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { TmdbDetail } from "@/lib/providers/tmdb/tmdb-details";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { useSettings } from "@/lib/settings";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import tmdbIcon from "@/assets/addon-logos/tmdb.png";
import { useBpFocusedMeta } from "./bp-focus-meta";
import { useBpEnrich } from "./use-bp-enrich";
import { BP_COPY_IN, BP_COPY_OUT, useBpCopyGate } from "./bp-backdrop-commit";
import type { BpPagePhase } from "./bp-catalog-page";
import { MetaAwardsCorner } from "@/components/meta-awards-corner";
import { BpScoreChips } from "./bp-score-chips";
import { useBpCardBadges } from "./use-bp-card-badges";
import { buildBpFacts } from "./bp-logic";

export function bpFacts(meta: Meta, detail: TmdbDetail | null): string[] {
  return buildBpFacts(meta, detail);
}

const EMPTY_META: Meta = { id: "", type: "movie", name: "" };

const HERO_H = "h-[calc(clamp(374px,58.3vh,560px)_-_var(--bp-hero-give,0px))]";

const COPY_W = "max-w-[min(40vw,470px)]";

const TITLE =
  "line-clamp-2 font-display text-[clamp(36px,5.6vh,54px)] font-semibold leading-[1.12] tracking-[-0.02em] text-ink drop-shadow-[0_3px_16px_rgba(0,0,0,0.6)]";

export function BpSpotlight(_props: { phase?: BpPagePhase }) {
  // The copy is NOT settled. It updates on the frame focus lands.
  //
  // This file used to hold it on BP_META_SETTLE_MS so it could never arrive
  // ahead of its own artwork. Two things were tried and both are worse than
  // simply being fast. Holding the old copy leaves the previous title's logo,
  // score and synopsis describing a card the ring already left, for the settle
  // plus the backdrop's decode plus the cross-fade. Blanking it for the same
  // window reads as even slower, because now nothing is there at all.
  //
  // Netflix does neither: the title changes the instant you move and the
  // backdrop catches up behind it. The backdrop keeps its own settle in
  // bp-ambient, so scrubbing a row still does not fire a fetch per card.
  const meta = useBpFocusedMeta();
  const detail = useBpEnrich(meta);
  const { settings } = useSettings();
  const slides = useMemo(() => (meta ? [meta] : []), [meta?.id]);
  const logos = useHeroLogos(slides, settings);
  const mark = useProxiedImageSrc(meta?.providerBadge?.logo);
  // No ref: the spotlight is on screen by definition, so the score prefetch runs
  // at once instead of waiting on an intersection that already happened.
  const { badges } = useBpCardBadges(
    meta ?? EMPTY_META,
    undefined,
    detail?.imdbId ?? null,
  );

  // Every visible field goes through the gate as one subject. Gating the meta
  // alone left the logo, the scores and the overview reading off the live title
  // while the name under them was still the previous one, so the loudest thing
  // on screen changed identity mid-fade.
  const facts = useMemo(() => (meta ? bpFacts(meta, detail) : []), [meta, detail]);
  // useHeroLogos rebuilds its map on every render, so the resolved string is the
  // only safe dependency: the object would remake this subject every render and
  // the gate would promote in place forever.
  const heroLogo = meta ? logos[meta.id] : undefined;
  const subject = useMemo(() => {
    if (!meta) return null;
    return {
      meta,
      facts,
      badges,
      logo: detail?.logo ?? meta.logo ?? heroLogo,
      // Only when no provider answered at all. The TMDB detail score is a
      // fallback for an unconfigured install, not a tenth provider chip.
      tmdbScore: badges.length > 0 ? "" : (detail?.rating ?? ""),
      overview: detail?.overview || meta.description || "",
      imdbId: detail?.imdbId ?? (meta.id.startsWith("tt") ? meta.id.split(":")[0] : null),
    };
  }, [meta, detail, facts, badges, heroLogo]);

  const { shown, on } = useBpCopyGate(subject, `card:${meta?.id ?? ""}`);

  if (!shown) return <div data-bp-hero-box className={HERO_H} />;

  const { logo, tmdbScore, overview, imdbId } = shown;

  return (
    // Keyed on the promoted title, never the live one, so bp-rise plays once at
    // promotion instead of running under a copy block that is still faded out.
    <div
      key={shown.meta.id}
      data-bp-hero-box
      className={`relative [animation:bp-hero-land_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none] ${HERO_H}`}
    >
      <div
        data-bp-xfade
        className={`relative flex h-full flex-col justify-end gap-0 px-[var(--bp-gutter)] pb-[clamp(27px,3.6vh,58px)] ${
          on ? BP_COPY_IN : BP_COPY_OUT
        }`}
      >
        {mark && (
          <img
            src={mark}
            alt=""
            decoding="async"
            data-bp-hero-mark
            className="mb-[18px] block h-[clamp(19px,3.2vh,29px)] w-auto self-start object-contain opacity-[0.85]"
          />
        )}

        {logo ? (
          <>
          <img
            src={logo}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const h = e.currentTarget.nextElementSibling;
              if (h instanceof HTMLElement) h.removeAttribute("hidden");
            }}
            // This block is keyed on the promoted title, so the logo is a fresh
            // element on every title change and its decode would otherwise land
            // synchronously in the frame that mounts it, beside the backdrop
            // commit and the copy fade.
            decoding="async"
            data-bp-hero-logo
            className="max-h-[clamp(104px,16.2vh,188px)] w-auto max-w-[min(32vw,380px)] self-start object-contain drop-shadow-[0_5px_22px_rgba(0,0,0,0.7)]"
          />
          <h1 hidden data-bp-hero-title className={`${TITLE} ${COPY_W}`}>
            {shown.meta.name}
          </h1>
          </>
        ) : (
          <h1 data-bp-hero-title className={`${TITLE} ${COPY_W}`}>{shown.meta.name}</h1>
        )}

        <div data-bp-hero-meta className="mt-[14px] flex flex-wrap items-center gap-x-[16px] gap-y-1 text-[clamp(15.5px,1.8vh,21px)] font-semibold tracking-[0.015em] text-ink-subtle">
          {/* Not a hardcoded IMDb value. For a kitsu or mal meta,
              meta.imdbRating holds the anime score, and drawing that beside the
              IMDb mark told the user a MAL 8.2 was an IMDb 8.2. */}
          <BpScoreChips badges={shown.badges} />
          {tmdbScore && (
            <span className="flex items-center gap-[6px] tabular-nums text-ink">
              <img src={tmdbIcon} alt="TMDB" className="h-[1.6em] w-auto shrink-0 rounded-[3px]" />
              {tmdbScore}
            </span>
          )}
          {shown.facts.map((f) => (
            <span key={f} className="flex items-center">
              {f}
            </span>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 translate-y-[clamp(26px,4vh,58px)]">
          <MetaAwardsCorner meta={shown.meta} imdbId={imdbId} />
        </div>

        {overview && (
          <p
            data-bp-hero-desc
            className={`mt-[18px] line-clamp-2 text-[clamp(16px,2vh,23px)] leading-[1.55] text-ink-muted ${COPY_W}`}
          >
            {overview}
          </p>
        )}
      </div>
    </div>
  );
}
