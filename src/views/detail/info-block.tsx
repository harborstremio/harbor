import type { ReactNode } from "react";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { useFilmSoundtrack } from "@/lib/providers/musicbrainz-soundtrack";
import { tmdbCompanyIdByName, type TmdbDetail } from "@/lib/providers/tmdb";
import { useCriticism } from "@/lib/providers/podcast-criticism";
import { useAdaptationFamily } from "@/lib/providers/wikidata-graph";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { AdaptationRow } from "./adaptation-row";
import { CriticismRow } from "./criticism-row";
import { productionRows } from "./production-rows";
import { useProductionFacts } from "./use-production-facts";
import { SoundtrackRow } from "./soundtrack-row";

const ANIME_ROW_BY_GENRE: Record<string, string> = {
  Action: "genre-action",
  Adventure: "genre-action",
  Romance: "genre-romance",
  "Slice of Life": "genre-slice",
  Mecha: "genre-mecha",
  Fantasy: "genre-fantasy",
  "Science Fiction": "genre-scifi",
  "Sci-Fi": "genre-scifi",
  "Sci-Fi & Fantasy": "genre-fantasy",
  Psychological: "genre-psych",
  Thriller: "genre-psych",
  Horror: "genre-horror",
  Supernatural: "genre-horror",
};

function focusAnimeRow(key: string) {
  window.dispatchEvent(
    new CustomEvent("harbor:anime-focus-row", { detail: { anchor: `row:${key}` } }),
  );
}

export function InfoBlock({ detail, isAnime = false }: { detail: TmdbDetail; isAnime?: boolean }) {
  const t = useT();
  const { openFilter, setView } = useView();
  const adaptation = useAdaptationFamily(isAnime ? undefined : (detail.imdbId ?? undefined));
  const soundtrack = useFilmSoundtrack(detail.imdbId ?? undefined);
  const production = useProductionFacts(
    !isAnime && detail.kind === "movie" && detail.year
      ? {
          title: detail.title,
          originalTitle: detail.originalTitle || undefined,
          year: detail.year,
          imdbId: detail.imdbId,
        }
      : null,
  );
  const criticism = useCriticism(
    isAnime || detail.kind === "tv"
      ? undefined
      : {
          title: detail.title,
          originalTitle: detail.originalTitle || undefined,
          year: detail.year,
          directors: detail.directors.map((person) => person.name),
        },
  );
  const mediaType: "movie" | "tv" = detail.kind === "tv" ? "tv" : "movie";

  const fmtMoney = (n?: number) =>
    n && n > 0 ? `$${(n / 1_000_000).toFixed(n >= 1_000_000_000 ? 2 : 0)}${n >= 1_000_000_000 ? "B" : "M"}` : null;

  const { settings } = useSettings();
  const tmdbKey = settings.tmdbKey;
  const networkChips = detail.networksRich.slice(0, 4).map((n) => ({
    label: n.name,
    onClick: () => openFilter({ kind: "network", mediaType, name: n.name, id: n.id }),
  }));
  const namedStudios =
    detail.productionCompaniesRich.length > 0
      ? detail.productionCompaniesRich.slice(0, 3)
      : detail.productionCompanies.slice(0, 3).map((name) => ({ id: 0, name }));
  const studioChips = namedStudios.map((c) => ({
    label: c.name,
    onClick: () => {
      if (c.id > 0) {
        openFilter({ kind: "studio", mediaType, name: c.name, id: c.id });
        return;
      }
      if (!tmdbKey) return;
      void tmdbCompanyIdByName(tmdbKey, c.name).then((id) => {
        if (id) openFilter({ kind: "studio", mediaType, name: c.name, id });
      });
    },
  }));
  const countryChips = detail.productionCountriesRich.map((c) => ({
    label: c.name,
    onClick: () => openFilter({ kind: "country", mediaType, name: c.name, iso: c.iso }),
  }));
  const langChips = detail.spokenLanguagesRich.slice(0, 1).map((l) => ({
    label: l.name,
    onClick: () => openFilter({ kind: "language", mediaType, name: l.name, iso: l.iso }),
  }));
  const genreChips = detail.genres
    .map((name) => {
      if (isAnime) {
        const anchor = ANIME_ROW_BY_GENRE[name];
        return {
          label: name,
          onClick: () => {
            setView("anime");
            if (anchor) {
              window.setTimeout(() => focusAnimeRow(anchor), 60);
            }
          },
        };
      }
      const id = (mediaType === "movie" ? MOVIE_GENRES : TV_GENRES)[name];
      if (id == null) return null;
      return {
        label: name,
        onClick: () => openFilter({ kind: "genre", mediaType, name, id }),
      };
    })
    .filter((c): c is { label: string; onClick: () => void } => c !== null);

  type Row = { label: string } & (
    | { kind: "text"; value: string }
    | { kind: "chips"; chips: Array<{ label: string; onClick: () => void }> }
    | { kind: "node"; node: ReactNode }
  );

  const rows: Array<Row | null> = [
    detail.status ? { label: t("Status"), kind: "text", value: detail.status } : null,
    detail.kind === "tv" && detail.numberOfSeasons > 0
      ? {
          label: t("Seasons"),
          kind: "text",
          value: `${detail.numberOfSeasons} · ${t("{n} episodes", { n: detail.numberOfEpisodes })}`,
        }
      : null,
    detail.kind === "tv" && detail.firstAirDate
      ? { label: t("First aired"), kind: "text", value: detail.firstAirDate }
      : null,
    detail.kind === "tv" && detail.lastAirDate
      ? { label: t("Last aired"), kind: "text", value: detail.lastAirDate }
      : null,
    networkChips.length > 0 ? { label: t("Networks"), kind: "chips", chips: networkChips } : null,
    studioChips.length > 0 ? { label: t("Studio"), kind: "chips", chips: studioChips } : null,
    countryChips.length > 0 ? { label: t("Country"), kind: "chips", chips: countryChips } : null,
    langChips.length > 0
      ? { label: t("Original language"), kind: "chips", chips: langChips }
      : null,
    detail.originalTitle && detail.originalTitle !== detail.title
      ? { label: t("Original title"), kind: "text", value: detail.originalTitle }
      : null,
    adaptation
      ? { label: t("Based on"), kind: "node", node: <AdaptationRow family={adaptation} /> }
      : null,
    soundtrack
      ? { label: t("Soundtrack"), kind: "node", node: <SoundtrackRow album={soundtrack} /> }
      : null,
    genreChips.length > 0 ? { label: t("Genres"), kind: "chips", chips: genreChips } : null,
    fmtMoney(detail.budget) != null
      ? { label: t("Budget"), kind: "text", value: fmtMoney(detail.budget)! }
      : null,
    fmtMoney(detail.revenue) != null
      ? { label: t("Revenue"), kind: "text", value: fmtMoney(detail.revenue)! }
      : null,
    ...(production ? productionRows(production, t) : []).map(
      (row): Row => ({ label: row.label, kind: "node", node: row.node }),
    ),
    criticism.length > 0
      ? {
          label: t("Discussed on"),
          kind: "node",
          node: <CriticismRow title={detail.title} episodes={criticism} />,
        }
      : null,
    detail.rating
      ? {
          label: t("Rating"),
          kind: "text",
          value: `${detail.rating} · ${t("{n} votes", { n: detail.voteCount.toLocaleString() })}`,
        }
      : null,
  ];
  const filtered = rows.filter((r): r is Row => r !== null);

  if (filtered.length === 0) return null;

  return (
    <div className="pt-12">
      <h3 className="mb-6 text-[22px] font-medium tracking-tight text-ink">{t("Information")}</h3>
      <dl className="grid grid-cols-1 gap-x-12 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((row) => (
          <div key={row.label} className="flex flex-col gap-1.5">
            <dt className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
              {row.label}
            </dt>
            <dd className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14.5px] text-ink">
              {row.kind === "text"
                ? row.value
                : row.kind === "node"
                  ? row.node
                  : row.chips.map((c, i) => (
                      <span key={c.label} className="flex items-center">
                        <button
                          type="button"
                          onClick={c.onClick}
                          className="rounded-md text-ink underline-offset-4 transition-colors hover:text-accent hover:underline"
                        >
                          {c.label}
                        </button>
                        {i < row.chips.length - 1 && (
                          <span className="ms-1.5 text-ink-subtle">·</span>
                        )}
                      </span>
                    ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
