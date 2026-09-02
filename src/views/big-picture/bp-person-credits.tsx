import { useMemo } from "react";
import { Film } from "lucide-react";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import type { Meta } from "@/lib/cinemeta";
import { creditToMeta, type PersonCredit } from "@/lib/providers/tmdb/tmdb-people";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { useSettings } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import { bpBoxCss, bpBoxPx, bpCardArt, type BpArtBox } from "./bp-art";
import { BpArt } from "./bp-art-img";
import { publishBpMeta, registerBpTarget } from "./bp-focus-meta";
import { BP_DETAIL_HEADING, BP_DETAIL_TRACK } from "./detail/bp-detail-chrome";

// One record for the drawn width and the requested one, the rule bp-art states.
// tmdb-people hands posters over at w342 and backdrops at w780, and this box
// floors at 146 on a television across every section this page mounts at once.
const CREDIT: BpArtBox = { min: 146, vw: 11.6, max: 230 };
const CREDIT_CELL_W = bpBoxCss(CREDIT);

// Only the IMDb Top row pays for real IMDb lookups, so every other card used to
// show no score at all while a rating it already held sat unread on the credit.
// The fallback is free: voteAverage arrives with the filmography.
//
// Gated on the same card settings every BpTile reads. Printing a TMDB score on
// a card belonging to a user who switched the TMDB badge off is the inversion of
// the complaint this whole pass exists to answer, and the mark is the real logo
// asset for the same reason: a hand-typed "TMDB" was the one score on the TV
// with no provider mark on it.
function BpCreditRating({ credit, imdb }: { credit: PersonCredit; imdb?: string }) {
  const { settings } = useSettings();
  if (imdb && settings.showImdbBadge) {
    return (
      <span data-bp-cell-meta className="flex items-center gap-1.5 text-[clamp(12px,1.6vh,18px)] font-semibold tabular-nums text-ink">
        <ImdbIcon className="h-[1.25em] w-auto shrink-0" />
        {imdb}
      </span>
    );
  }
  if (!settings.showTmdbBadge || credit.voteAverage <= 0) return null;
  return (
    <span data-bp-cell-meta className="flex items-center gap-1.5 text-[clamp(12px,1.6vh,18px)] font-semibold tabular-nums text-ink-muted">
      <img src={tmdbLogo} alt="" className="h-[1.25em] w-auto max-w-[2.4em] shrink-0 object-contain" />
      {credit.voteAverage.toFixed(1)}
    </span>
  );
}

function BpCreditCard({
  credit,
  onSelect,
  autofocus,
  ratings,
}: {
  credit: PersonCredit;
  onSelect: (m: Meta) => void;
  autofocus?: boolean;
  ratings?: Map<string, string>;
}) {
  const meta = useMemo(() => creditToMeta(credit), [credit]);
  // No useBpPosterChain here, deliberately. Every credit id is tmdb:movie:N or
  // tmdb:tv:N, and needsImdbForPoster is true for exactly that shape, so an
  // RPDB user pays one tmdbImdbId per card. This page mounts every card of
  // every section at once (content-visibility skips paint, not mount), which is
  // ~300 lookups on a working actor. Custom posters need windowed credit rows
  // or a batched id resolve before they can come here.
  const src = useProxiedImageSrc(bpCardArt(meta.poster ?? meta.background ?? undefined, bpBoxPx(CREDIT)));
  const rating = ratings?.get(meta.id);
  const role = credit.character?.trim() || credit.job?.trim() || "";
  const sub = [role, credit.releaseInfo].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-autofocus={autofocus ? "true" : undefined}
      data-bp-restore-key={meta.id}
      ref={(el) => registerBpTarget(el, { meta })}
      onFocus={() => publishBpMeta(meta)}
      onClick={() => {
        SFX.click();
        onSelect(meta);
      }}
      aria-label={role ? `${meta.name}, ${role}` : meta.name}
      className="flex shrink-0 flex-col overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
      style={{ width: CREDIT_CELL_W }}
    >
      <span
        className="relative flex w-full items-center justify-center overflow-hidden bg-[var(--bp-panel-2)]"
        style={{ aspectRatio: "2 / 3" }}
      >
        {src ? (
          <BpArt src={src} className="object-cover" />
        ) : (
          <Film size={26} className="text-ink-subtle" strokeWidth={1.7} />
        )}
      </span>
      <span className="flex w-full flex-col gap-[2px] p-[clamp(9px,0.9vw,15px)]">
        <span data-bp-cell-name className="line-clamp-2 text-[clamp(11.5px,1.55vh,17.5px)] font-semibold leading-tight text-ink">
          {meta.name}
        </span>
        <BpCreditRating credit={credit} imdb={rating} />
        {sub && (
          <span data-bp-cell-meta className="line-clamp-1 text-[clamp(12px,1.6vh,18px)] font-medium leading-tight text-ink-subtle">
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}

export function BpCreditRow({
  rowKey,
  title,
  credits,
  onSelect,
  autofocusFirst,
  ratings,
}: {
  rowKey: string;
  title: string;
  credits: PersonCredit[];
  onSelect: (m: Meta) => void;
  autofocusFirst?: boolean;
  ratings?: Map<string, string>;
}) {
  if (credits.length === 0) return null;

  return (
    // Without data-bp-row-key, readBpRowPosition never fires and every Down into
    // a credit row lands on card one no matter where the user left it.
    <section data-bp-row data-bp-row-key={rowKey} className="relative">
      <h2 className={BP_DETAIL_HEADING}>{title}</h2>
      <div data-bp-scroll-x className={BP_DETAIL_TRACK}>
        {credits.map((c, i) => (
          <BpCreditCard
            key={`${c.mediaType}-${c.id}-${c.job ?? ""}-${i}`}
            credit={c}
            onSelect={onSelect}
            autofocus={autofocusFirst && i === 0}
            ratings={ratings}
          />
        ))}
      </div>
    </section>
  );
}

// Plates, the trade bp-page-skeleton.tsx:6-15 records. This was nine
// animate-pulse blocks, which is nine group opacities strictly between 0
// and 1, so nine live offscreen passes against a cliff that saturates at eight,
// and they ran for as long as the person page was loading.
export function BpCreditRowSkeleton() {
  return (
    <section>
      <div
        data-bp-plate
        className="mb-[clamp(6px,0.8vh,12px)] mx-[var(--bp-gutter)] h-[clamp(16px,2.4vh,30px)] w-[clamp(140px,14vw,260px)] rounded-full bg-[var(--bp-panel)]"
      />
      <div className="flex gap-[clamp(16px,1.35vw,30px)] overflow-hidden px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shrink-0" style={{ width: CREDIT_CELL_W }}>
            <div
              data-bp-plate
              className="w-full rounded-sm bg-[var(--bp-panel)]"
              style={{ aspectRatio: "2 / 3" }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function BpFilterRow({
  id,
  label,
  options,
  value,
  onChange,
  trailing,
  caption,
}: {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (next: string) => void;
  trailing?: string;
  caption?: string;
}) {
  return (
    // A one-line row would otherwise reserve the 340px row placeholder that the
    // Big Picture tokens give every off-screen [data-bp-row].
    <div
      data-bp-row
      data-bp-row-key={`person-filter:${id}`}
      style={{ containIntrinsicSize: caption ? "auto 112px" : "auto 76px" }}
    >
      <div className="flex items-center gap-[clamp(8px,0.8vw,16px)] px-[var(--bp-gutter)]">
        <span className="shrink-0 text-[clamp(11px,1.5vh,17px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          {label}
        </span>
        <div
          data-bp-scroll-x
          className="flex items-center gap-[clamp(6px,0.6vw,12px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              data-bp-focusable
              data-bp-chip
              data-bp-filter-chip
              data-bp-restore-key={`person-filter:${id}:${o.value}`}
              aria-pressed={o.value === value}
              onClick={() => {
                SFX.click();
                onChange(o.value);
              }}
              className={`h-[clamp(44px,4.8vh,58px)] shrink-0 rounded-full px-[clamp(14px,1.2vw,22px)] text-[clamp(12.5px,1.78vh,20px)] font-semibold transition-colors duration-[var(--bp-dur-fast)] ${
                o.value === value
                  ? "bg-[var(--bp-on)] text-ink"
                  : "border border-[var(--bp-edge)] text-ink-subtle"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {trailing && (
          <span className="ms-auto shrink-0 text-[clamp(11px,1.5vh,17px)] font-semibold uppercase tracking-[0.16em] tabular-nums text-ink-subtle">
            {trailing}
          </span>
        )}
      </div>
      {caption && (
        <p className="px-[var(--bp-gutter)] pt-[clamp(3px,0.5vh,8px)] text-[clamp(10.5px,1.4vh,15px)] font-medium leading-tight tabular-nums text-ink-subtle">
          {caption}
        </p>
      )}
    </div>
  );
}
