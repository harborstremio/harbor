import { BookOpen, Blocks, Check, Layers, Tv, User } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import type { AnimeHit, LiveTvHit, SearchPerson } from "@/lib/search";
import type { AddonHit } from "@/lib/search-addon-index";
import type { MangaSummary } from "@/lib/manga/model";
import type { TvdbCollectionHit } from "@/lib/providers/tvdb-collections";
import { pushBigPicture } from "@/lib/big-picture";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { addonLogoSrc, resolveAddonLogo } from "@/components/addon-logo";
import { SFX } from "@/lib/sfx";
import { bpBoxCss, bpBoxPx, bpCardArt, type BpArtBox } from "./bp-art";
import { useBpLivePlay } from "./use-bp-live";

const HEADSHOT = "https://image.tmdb.org/t/p/h632";
const HEADSHOT_BOX: BpArtBox = { min: 84, vw: 6.8, max: 126 };
const HEADSHOT_CELL = bpBoxCss(HEADSHOT_BOX);
const MANGA_BOX: BpArtBox = { min: 132, vw: 10.6, max: 210 };
const MANGA_CELL = bpBoxCss(MANGA_BOX);
const COLLECTION_BOX: BpArtBox = { min: 230, vw: 19, max: 340 };
const COLLECTION_CELL = bpBoxCss(COLLECTION_BOX);

const COLLECTION_SCRIM =
  "linear-gradient(to top, color-mix(in oklab, var(--bp-void) 92%, transparent) 0%, color-mix(in oklab, var(--bp-void) 45%, transparent) 52%, transparent 100%)";

export function animeMeta(hit: AnimeHit): Meta {
  const id = hit.kitsuId
    ? `kitsu:${hit.kitsuId}`
    : hit.malId
      ? `mal:${hit.malId}`
      : `anilist:${hit.anilistId}`;
  return {
    id,
    type: "anime",
    name: hit.name,
    poster: hit.poster ?? undefined,
    background: hit.background ?? hit.poster ?? undefined,
    description: hit.overview,
    releaseInfo: hit.year ?? undefined,
    imdbRating: hit.score > 0 ? hit.score.toFixed(1) : undefined,
  };
}

export function BpPersonCell({ person, onOpen }: { person: SearchPerson; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`person:${person.id}`}
      onClick={() => {
        SFX.click();
        onOpen();
      }}
      aria-label={person.name}
      className="flex shrink-0 flex-col items-center gap-[clamp(6px,0.8vh,11px)] rounded-[var(--bp-r-lg)] p-[clamp(7px,0.7vw,13px)] transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
      style={{ width: "clamp(112px, 9vw, 168px)" }}
    >
      <span
        className="relative flex items-center justify-center overflow-hidden rounded-full bg-[var(--bp-panel-2)]"
        style={{ width: HEADSHOT_CELL, aspectRatio: "1 / 1" }}
      >
        {person.profile ? (
          <img
            src={bpCardArt(`${HEADSHOT}${person.profile}`, bpBoxPx(HEADSHOT_BOX))}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <User size={26} className="text-ink-subtle" strokeWidth={1.7} />
        )}
      </span>
      <span className="flex w-full flex-col items-center gap-0.5">
        <span className="line-clamp-1 w-full text-center text-[clamp(11.5px,1.55vh,17.5px)] font-semibold leading-tight text-ink">
          {person.name}
        </span>
        <span className="line-clamp-1 w-full text-center text-[clamp(10px,1.3vh,14.5px)] font-medium leading-tight text-ink-subtle">
          {person.knownFor}
        </span>
      </span>
    </button>
  );
}

export function BpChannelCell({ hit, onCommit }: { hit: LiveTvHit; onCommit: () => void }) {
  // Guarded providers need the M3U headers, the player needs isLive, and the
  // home Guide row is seeded from play stats, so search plays through the same
  // helper as every other channel rather than rebuilding openPlayer here.
  const playChannel = useBpLivePlay();
  const play = () => {
    SFX.click();
    onCommit();
    playChannel({
      id: hit.channelId,
      tvgId: null,
      name: hit.name,
      logo: hit.logo,
      group: hit.group,
      url: hit.url,
      catchupSource: null,
      durationSec: null,
      attrs: {},
    });
  };

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`iptv:${hit.playlistId}:${hit.channelId}`}
      onClick={play}
      aria-label={hit.name}
      className="flex shrink-0 items-center gap-[clamp(9px,0.8vw,15px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] p-[clamp(9px,0.8vw,15px)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
      style={{ width: "clamp(230px, 19vw, 340px)" }}
    >
      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)]"
        style={{ width: "clamp(44px, 3.4vw, 62px)", aspectRatio: "1 / 1" }}
      >
        {hit.logo ? (
          <img src={hit.logo} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
        ) : (
          <Tv size={20} className="text-ink-subtle" strokeWidth={1.8} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-1 text-[clamp(12.5px,1.7vh,19px)] font-semibold leading-tight text-ink">
          {hit.name}
        </span>
        <span className="line-clamp-1 text-[clamp(10.5px,1.4vh,15px)] font-medium leading-tight text-ink-subtle">
          {hit.group ? `${hit.group} · ` : ""}
          {hit.playlistName}
        </span>
      </span>
    </button>
  );
}

export function BpCollectionCell({ hit, onCommit }: { hit: TvdbCollectionHit; onCommit: () => void }) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`collection:${hit.id}`}
      onClick={() => {
        SFX.click();
        onCommit();
        pushBigPicture({
          kind: "collection",
          collectionId: hit.id,
          name: hit.name,
          image: hit.image,
        });
      }}
      aria-label={hit.name}
      className="relative flex shrink-0 items-end overflow-hidden rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
      style={{ width: COLLECTION_CELL, aspectRatio: "16 / 9" }}
    >
      {hit.image && (
        <img
          src={bpCardArt(hit.image, bpBoxPx(COLLECTION_BOX))}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
      )}
      <span aria-hidden className="absolute inset-0" style={{ background: COLLECTION_SCRIM }} />
      <span className="relative flex w-full items-center gap-[clamp(6px,0.5vw,10px)] p-[clamp(10px,0.9vw,17px)]">
        <Layers size={17} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
        <span className="line-clamp-1 text-[clamp(12.5px,1.7vh,19px)] font-semibold leading-tight text-ink">
          {hit.name}
        </span>
      </span>
    </button>
  );
}

// Manga has no Big Picture route of its own, so this hands off to the desktop
// reader exactly the way BpHeroManga already does. Do not swap it for a
// pushBigPicture({ kind: "manga" }) until that route actually exists; the detail
// route cannot resolve a manga id and the card opens nothing.
export function BpMangaCell({
  manga,
  onOpen,
}: {
  manga: MangaSummary;
  onOpen: () => void;
}) {
  const src = useProxiedImageSrc(bpCardArt(manga.cover, bpBoxPx(MANGA_BOX)));
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`manga:${manga.id}`}
      onClick={() => {
        SFX.click();
        onOpen();
      }}
      aria-label={manga.title}
      className="group relative flex shrink-0 flex-col justify-end overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] text-start transition-transform duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)]"
      style={{ width: MANGA_CELL, aspectRatio: "2 / 3" }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center">
          <BookOpen size={24} className="text-ink-subtle" strokeWidth={1.7} />
        </span>
      )}
      <span aria-hidden className="absolute inset-0" style={{ background: COLLECTION_SCRIM }} />
      <span className="relative line-clamp-2 p-[clamp(8px,0.7vw,14px)] text-[clamp(11.5px,1.55vh,17px)] font-semibold leading-tight text-ink">
        {manga.title}
      </span>
    </button>
  );
}

export function BpAddonHitCell({ hit, onOpen }: { hit: AddonHit; onOpen: () => void }) {
  const bundled = addonLogoSrc(hit.id, hit.name);
  const chosen = resolveAddonLogo(hit.logo, hit.transportUrl ?? null) ?? bundled;
  const src = useProxiedImageSrc(chosen ?? undefined) ?? chosen;
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`addon:${hit.id}`}
      onClick={() => {
        SFX.click();
        onOpen();
      }}
      aria-label={hit.name}
      className="flex shrink-0 items-center gap-[clamp(9px,0.8vw,15px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] p-[clamp(9px,0.8vw,15px)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
      style={{ width: "clamp(230px, 19vw, 340px)" }}
    >
      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)]"
        style={{ width: "clamp(44px, 3.4vw, 62px)", aspectRatio: "1 / 1" }}
      >
        {src ? (
          <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <Blocks size={20} className="text-ink-subtle" strokeWidth={1.8} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-1 text-[clamp(12.5px,1.7vh,19px)] font-semibold leading-tight text-ink">
          {hit.name}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-[clamp(10.5px,1.4vh,15px)] font-medium leading-tight text-ink-subtle">
          {hit.installed && <Check size={13} strokeWidth={2.6} className="shrink-0" />}
          <span className="line-clamp-1">{hit.blurb ?? ""}</span>
        </span>
      </span>
    </button>
  );
}
