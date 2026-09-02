import { Heart } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { Poster } from "@/components/poster";
import type { TmdbDetail } from "@/lib/providers/tmdb";
import type { AnimeCharacter } from "@/lib/providers/anime-characters";
import type { AnilistMediaDetails, AnilistRelatedNode } from "@/lib/anilist/media-details";
import { AnimeTitlesBlock } from "@/views/detail/anime-titles-block";
import { AnimeStatsDonut } from "@/views/detail/anime-stats-donut";
import { useT } from "@/lib/i18n";
import { HIDE_SCROLL } from "./data";
import { SectionTitle } from "./ui";

function formatCount(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 10 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1)}M`;
  }
  if (n >= 1000) {
    const v = n / 1000;
    return `${v >= 10 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1)}K`;
  }
  return String(n);
}

export function CharactersRow({ characters }: { characters: AnimeCharacter[] }) {
  const t = useT();
  return (
    <section className="flex flex-col gap-3.5">
      <SectionTitle>{t("Characters")}</SectionTitle>
      <div
        className={`-mx-5 flex snap-x snap-proximity gap-3.5 overflow-x-auto px-5 ${HIDE_SCROLL}`}
      >
        {characters.map((c) => (
          <CharacterChip key={c.id} character={c} />
        ))}
      </div>
    </section>
  );
}

function CharacterChip({ character }: { character: AnimeCharacter }) {
  return (
    <div className="flex w-[88px] shrink-0 snap-start flex-col gap-2">
      <Poster
        src={character.image}
        seed={String(character.id)}
        ratio="portrait"
        lazy
        className="rounded-xl"
      />
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-1 text-[12.5px] font-medium text-ink">{character.name}</p>
        {character.role && (
          <p className="line-clamp-1 text-[11.5px] leading-tight text-ink-subtle">
            {character.role}
          </p>
        )}
        {character.favourites ? (
          <span className="inline-flex items-center gap-1 text-[11px] leading-tight text-ink-subtle">
            <Heart size={10} fill="currentColor" className="text-rose-400/80" />
            {formatCount(character.favourites)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function AnimeRelatedRow({
  title,
  nodes,
  onOpen,
}: {
  title: string;
  nodes: AnilistRelatedNode[];
  onOpen?: (node: AnilistRelatedNode) => void;
}) {
  const t = useT();
  return (
    <section className="flex flex-col gap-3.5">
      <SectionTitle>{t(title)}</SectionTitle>
      <div className={`-mx-5 flex snap-x snap-proximity gap-3 overflow-x-auto px-5 ${HIDE_SCROLL}`}>
        {nodes.map((node) => (
          <RelatedCard key={node.anilistId} node={node} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function RelatedCard({
  node,
  onOpen,
}: {
  node: AnilistRelatedNode;
  onOpen?: (node: AnilistRelatedNode) => void;
}) {
  const t = useT();
  const meta = [
    node.format,
    node.year ? String(node.year) : undefined,
    node.rating ? `★ ${node.rating}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  const Wrap: "button" | "div" = onOpen ? "button" : "div";
  const wrapProps = onOpen ? { onClick: () => onOpen(node), type: "button" as const } : {};
  return (
    <Wrap
      {...wrapProps}
      className={`flex w-[104px] shrink-0 snap-start flex-col gap-2 text-start ${
        onOpen
          ? "transition-transform active:scale-[0.97] motion-reduce:transition-none"
          : "cursor-default"
      }`}
    >
      <Poster
        src={node.poster}
        seed={String(node.anilistId)}
        ratio="portrait"
        lazy
        className="rounded-xl ring-1 ring-edge-soft/60"
      >
        <span className="pointer-events-none absolute start-1.5 top-1.5 rounded-full bg-canvas/80 px-2 py-0.5 text-[10px] text-ink backdrop-blur-sm">
          {node.relation}
        </span>
        {node.upcoming && (
          <span className="pointer-events-none absolute end-1.5 top-1.5 rounded-full bg-canvas/80 px-2 py-0.5 text-[10px] text-ink backdrop-blur-sm">
            {t("Soon")}
          </span>
        )}
      </Poster>
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-[12px] font-medium leading-tight text-ink-muted">
          {node.title}
        </p>
        {meta && <p className="text-[11px] leading-tight text-ink-subtle">{meta}</p>}
      </div>
    </Wrap>
  );
}

type InfoRow = { label: string; value: string };

export function AnimeInfo({
  detail,
  anilist,
  malRating,
}: {
  detail: TmdbDetail | null;
  anilist: AnilistMediaDetails | null;
  malRating?: string;
}) {
  const t = useT();
  const studios = anilist?.studios.length
    ? anilist.studios.slice(0, 3).join(", ")
    : detail?.productionCompanies.slice(0, 3).join(", ");
  const episodes =
    anilist?.episodes ??
    (detail && detail.numberOfEpisodes > 0 ? detail.numberOfEpisodes : undefined);
  const format = detail ? (detail.kind === "movie" ? t("Movie") : t("TV Series")) : undefined;
  const genres = detail?.genres.length ? detail.genres.join(", ") : undefined;

  const rows: InfoRow[] = [];
  if (format) rows.push({ label: t("Format"), value: format });
  if (detail?.status) rows.push({ label: t("Status"), value: detail.status });
  if (episodes) rows.push({ label: t("Episodes"), value: String(episodes) });
  if (anilist?.source) rows.push({ label: t("Source"), value: anilist.source });
  if (studios) rows.push({ label: t("Studio"), value: studios });
  if (malRating) rows.push({ label: t("MAL Score"), value: `★ ${malRating}` });
  if (anilist?.favourites)
    rows.push({ label: t("AniList Favorites"), value: formatCount(anilist.favourites) });
  if (genres) rows.push({ label: t("Genres"), value: genres });

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t("Information")}</SectionTitle>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {rows.map((r) => (
          <div key={r.label} className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              {r.label}
            </span>
            <span className="text-[13.5px] leading-snug text-ink">{r.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function hasAnimeTitles(details: AnilistMediaDetails, primaryTitle: string): boolean {
  const p = primaryTitle.trim().toLowerCase();
  const diff = (v?: string) => !!v && v.trim().toLowerCase() !== p;
  return (
    diff(details.nativeTitle) ||
    diff(details.romajiTitle) ||
    diff(details.englishTitle) ||
    details.synonyms.length > 0
  );
}

export function AnimeTitles({
  details,
  primaryTitle,
}: {
  details: AnilistMediaDetails;
  primaryTitle: string;
}) {
  const t = useT();
  return (
    <section className="flex flex-col gap-3.5">
      <SectionTitle>{t("Titles")}</SectionTitle>
      <AnimeTitlesBlock details={details} primaryTitle={primaryTitle} />
    </section>
  );
}

export function AnimeStats({ details }: { details: AnilistMediaDetails }) {
  const t = useT();
  if (details.statusDistribution.length === 0) return null;
  return (
    <section className="flex flex-col gap-3.5">
      <SectionTitle>{t("Statistics")}</SectionTitle>
      <AnimeStatsDonut slices={details.statusDistribution} />
    </section>
  );
}

export function relatedToMeta(node: AnilistRelatedNode): Meta {
  return {
    id: `anilist:${node.anilistId}`,
    type: node.format === "Movie" ? "movie" : "series",
    name: node.title,
    poster: node.poster,
  } as Meta;
}
