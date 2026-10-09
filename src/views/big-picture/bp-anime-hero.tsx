import { useEffect, useMemo, useRef, useState } from "react";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import type { Meta } from "@/lib/cinemeta";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { useSettings } from "@/lib/settings";
import type { LibraryItem } from "@/lib/stremio";
import { useTitleLogo } from "@/lib/title-logo";
import { BP_COPY_IN, BP_COPY_OUT, useBpCopyGate } from "./bp-backdrop-commit";
import { BpAnimeHeroActions } from "./bp-anime-hero-actions";
import { BpAnimeHeroAvailability, BpAnimeHeroMeta } from "./bp-anime-hero-meta";
import type { BpPagePhase } from "./bp-catalog-page";
import { cwMeta } from "./bp-cw-row";
import {
  readBpCwItem,
  seedBpMeta,
  unlockBpMeta,
  unpinBpMeta,
  useBpFocusedMeta,
} from "./bp-focus-meta";

const HERO_H: Record<BpPagePhase, string> = {
  nav: "h-[clamp(374px,58.3vh,630px)]",
  hero: "h-[clamp(374px,58.3vh,630px)]",
  row: "h-[clamp(374px,58.3vh,630px)]",
};

const COPY_W = "max-w-[min(36vw,410px)]";

const LOGO_BOX = "max-h-[clamp(88px,13.7vh,160px)] max-w-[min(28vw,320px)]";

function BpHeroMark({ meta }: { meta: Meta | null }) {
  const src = useProxiedImageSrc(meta?.providerBadge?.logo);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      decoding="async"
      data-bp-hero-mark
      className="mb-[18px] block h-[clamp(19px,3.2vh,29px)] w-auto object-contain opacity-[0.85]"
    />
  );
}

function BpHeroLogo({ title, logo }: { title: string; logo?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const el = imgRef.current;
    setLoaded(Boolean(el?.complete && el.naturalWidth > 0));
    setFailed(false);
  }, [logo]);

  if (!logo || failed) {
    if (!title) return null;
    return (
      <h1
        data-bp-hero-title
        className={`line-clamp-2 font-display text-[clamp(30px,4.7vh,44px)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink ${COPY_W}`}
      >
        {title}
      </h1>
    );
  }
  return (
    <img
      ref={imgRef}
      src={logo}
      alt={title}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      style={{ opacity: loaded ? 1 : 0 }}
      data-bp-anime-logo
      className={`block w-auto object-contain object-left drop-shadow-[0_5px_22px_color-mix(in_oklab,var(--bp-void)_72%,transparent)] transition-opacity duration-[var(--bp-dur-slow)] ease-[var(--bp-ease)] motion-reduce:transition-none rtl:object-right ${LOGO_BOX}`}
    />
  );
}

export function BpAnimeHero({
  phase,
  heroSlide,
  slides,
  cwItems,
  topPicks,
  onSelect,
}: {
  phase: BpPagePhase;
  heroSlide?: Meta | null;
  slides: Meta[];
  cwItems: LibraryItem[];
  topPicks: Meta[];
  onSelect: (m: Meta) => void;
}) {
  const { settings } = useSettings();

  const leadCw = useMemo(() => cwItems.find((i) => i.background) ?? cwItems[0] ?? null, [cwItems]);
  const lead = useMemo(
    () => heroSlide ?? (leadCw ? cwMeta(leadCw) : (slides[0] ?? topPicks[0] ?? null)),
    [heroSlide, leadCw, slides, topPicks],
  );

  const subject = useBpFocusedMeta() ?? lead;

  // Logo resolution is the only thing here that runs off a settled subject.
  // Jikan metas carry no logo, so every card is a miss, and resolveLogo is a
  // sequential kitsu then tvdb then tmdb chain: undebounced, holding one arrow
  // press down spent up to five requests per card crossed. Everything else in
  // this hero is already gated (ambient 200, enrich 140, copy 180) and the map
  // this returns is keyed by id, so an already-resolved logo still paints at once.
  const settled = useBpFocusedMeta(200) ?? lead;
  const near = useMemo(() => (settled ? [settled] : []), [settled]);
  const logos = useHeroLogos(near, settings);
  const pinnedLogo = useTitleLogo(subject?.id);
  const logo = useProxiedImageSrc(
    pinnedLogo ?? (subject ? (logos[subject.id] ?? subject.logo) : undefined),
  );
  const { shown: hero, on } = useBpCopyGate(subject, `card:${subject?.id ?? ""}`);

  useEffect(() => {
    unpinBpMeta();
    seedBpMeta(lead ?? null);
  }, [lead?.id]);

  useEffect(() => unlockBpMeta, []);

  const busCw = readBpCwItem();
  const resume =
    leadCw && subject?.id === leadCw._id
      ? leadCw
      : busCw && busCw._id === subject?.id
        ? busCw
        : null;

  const fade = on ? BP_COPY_IN : BP_COPY_OUT;

  // BpAmbient paints the only backdrop here, so this reserves height and nothing
  // else. A filled box would draw a hard edge across the ambient.
  return (
    <section
      aria-label={subject?.name}
      className={`relative z-20 shrink-0 transition-[height] duration-[var(--bp-dur-slow)] ease-[var(--bp-ease)] motion-reduce:transition-none [animation:bp-hero-land_var(--bp-dur-slow)_var(--bp-ease)_backwards] motion-reduce:[animation:none] ${HERO_H[phase]}`}
    >
      {/* Vertical stack, bottom anchored in the tall HERO_H box. The box is back
          to its own 58.3vh now that data-bp-hero-box is off it, not the 42vh the
          shared spotlight rule imposed: at 42vh the logo, facts, description, two
          buttons and the availability line overflowed upward past the box top and
          the logo hid behind the nav. At 58.3vh the same stack clears the nav at
          every size and the copy uses the width the anime hero has to spend. */}
      <div className="flex h-full flex-col justify-end px-[var(--bp-gutter)] pb-[clamp(27px,3.8vh,52px)]">
        <div data-bp-xfade className={fade}>
          <BpHeroMark meta={hero ?? subject} />
          <BpHeroLogo title={hero?.name ?? subject?.name ?? ""} logo={logo} />
          <BpAnimeHeroMeta hero={hero} resume={resume} />
          {hero?.description && (
            <p
              data-bp-hero-desc-anime
              className={`mt-[clamp(14px,1.8vh,22px)] line-clamp-2 text-[clamp(15px,1.7vh,26px)] leading-[1.55] text-ink-muted ${COPY_W}`}
            >
              {hero.description}
            </p>
          )}
        </div>

        <BpAnimeHeroActions
          phase={phase}
          subject={subject}
          lead={lead}
          resume={Boolean(resume)}
          onSelect={onSelect}
        />

        <BpAnimeHeroAvailability hero={hero} fade={fade} />
      </div>
    </section>
  );
}
