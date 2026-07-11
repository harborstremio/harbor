import type { Meta } from "@/lib/cinemeta";
import type { LocalEntry } from "@/lib/local-library";
import { tmdbDetails, tmdbSeasonEpisodes, type TmdbDetail, type Episode } from "@/lib/providers/tmdb/tmdb-details";
import { fetch as tauriHttpFetch } from "@tauri-apps/plugin-http";

import { resolveArtworkPaths, artworkUrl, type ArtworkPaths } from "./artwork";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type ExportSizes = { poster: string; backdrop: string; logo: string };

export type ExportResult = {
  ok: boolean;
  reason?: string;
  localArt?: { poster?: string; logo?: string; backdrop?: string };
};

function esc(s: string | number | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ratingsBlock(detail: TmdbDetail): string[] {
  if (!detail.rating) return [];
  return [
    "  <ratings>",
    '    <rating default="true" max="10" name="themoviedb">',
    `      <value>${esc(detail.rating)}</value>`,
    `      <votes>${detail.voteCount}</votes>`,
    "    </rating>",
    "  </ratings>",
  ];
}

function artThumbs(art: ArtworkPaths, sizes: ExportSizes): string[] {
  const out: string[] = [];
  if (art.poster) out.push(`  <thumb aspect="poster">${esc(artworkUrl(art.poster, sizes.poster))}</thumb>`);
  if (art.backdrop) {
    out.push("  <fanart>", `    <thumb>${esc(artworkUrl(art.backdrop, sizes.backdrop))}</thumb>`, "  </fanart>");
  }
  if (art.logo) out.push(`  <thumb aspect="clearlogo">${esc(artworkUrl(art.logo, sizes.logo))}</thumb>`);
  return out;
}

function genreStudioCountry(detail: TmdbDetail): string[] {
  const out: string[] = [];
  for (const g of detail.genres) out.push(`  <genre>${esc(g)}</genre>`);
  const studios =
    detail.kind === "tv" ? [...detail.networks, ...detail.productionCompanies] : detail.productionCompanies;
  for (const s of studios) out.push(`  <studio>${esc(s)}</studio>`);
  for (const c of detail.productionCountries) out.push(`  <country>${esc(c)}</country>`);
  return out;
}

function actorTags(detail: TmdbDetail): string[] {
  const out: string[] = [];
  for (const c of detail.cast.slice(0, 20)) {
    out.push("  <actor>");
    out.push(`    <name>${esc(c.name)}</name>`);
    out.push(`    <role>${esc(c.character ?? "")}</role>`);
    if (c.profilePath) out.push(`    <thumb>${esc(artworkUrl(c.profilePath, "h632"))}</thumb>`);
    out.push(`    <profile>https://www.themoviedb.org/person/${c.id}</profile>`);
    out.push(`    <tmdbid>${c.id}</tmdbid>`);
    out.push("  </actor>");
  }
  return out;
}

const digits = (s: string): string => s.replace(/\D/g, "");

function assemble(lines: string[]): string {
  return [...lines, ""].filter((l) => l !== "").join("\n");
}

function errText(where: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `${where}: ${msg}`.slice(0, 160);
}

function buildMovieNfo(detail: TmdbDetail, art: ArtworkPaths, sizes: ExportSizes): string {
  return assemble([
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    "<movie>",
    `  <title>${esc(detail.title)}</title>`,
    `  <originaltitle>${esc(detail.originalTitle)}</originaltitle>`,
    detail.year ? `  <year>${esc(detail.year)}</year>` : "",
    ...ratingsBlock(detail),
    `  <plot>${esc(detail.overview)}</plot>`,
    `  <outline>${esc(detail.overview)}</outline>`,
    detail.tagline ? `  <tagline>${esc(detail.tagline)}</tagline>` : "",
    detail.runtime ? `  <runtime>${esc(digits(detail.runtime))}</runtime>` : "",
    ...artThumbs(art, sizes),
    detail.imdbId ? `  <id>${esc(detail.imdbId)}</id>` : "",
    `  <tmdbid>${detail.id}</tmdbid>`,
    `  <uniqueid type="tmdb" default="false">${detail.id}</uniqueid>`,
    detail.imdbId ? `  <uniqueid type="imdb" default="true">${esc(detail.imdbId)}</uniqueid>` : "",
    detail.releaseDate ? `  <premiered>${esc(detail.releaseDate)}</premiered>` : "",
    detail.status ? `  <status>${esc(detail.status)}</status>` : "",
    ...genreStudioCountry(detail),
    ...detail.directors.map((d) => `  <director tmdbid="${d.id}">${esc(d.name)}</director>`),
    ...detail.writers.map((w) => `  <credits tmdbid="${w.id}">${esc(w.name)}</credits>`),
    ...actorTags(detail),
    "</movie>",
  ]);
}

function buildTvShowNfo(detail: TmdbDetail, art: ArtworkPaths, sizes: ExportSizes): string {
  const seasonThumbs = detail.seasons
    .filter((s) => s.posterPath && s.seasonNumber >= 0)
    .map(
      (s) =>
        `  <thumb aspect="poster" season="${s.seasonNumber}" type="season">${esc(
          artworkUrl(s.posterPath as string, sizes.poster),
        )}</thumb>`,
    );
  return assemble([
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    "<tvshow>",
    `  <title>${esc(detail.title)}</title>`,
    `  <originaltitle>${esc(detail.originalTitle)}</originaltitle>`,
    `  <showtitle>${esc(detail.title)}</showtitle>`,
    detail.year ? `  <year>${esc(detail.year)}</year>` : "",
    ...ratingsBlock(detail),
    `  <plot>${esc(detail.overview)}</plot>`,
    detail.tagline ? `  <tagline>${esc(detail.tagline)}</tagline>` : "",
    art.poster ? `  <thumb aspect="poster">${esc(artworkUrl(art.poster, sizes.poster))}</thumb>` : "",
    ...seasonThumbs,
    art.logo ? `  <thumb aspect="clearlogo">${esc(artworkUrl(art.logo, sizes.logo))}</thumb>` : "",
    ...(art.backdrop
      ? ["  <fanart>", `    <thumb>${esc(artworkUrl(art.backdrop, sizes.backdrop))}</thumb>`, "  </fanart>"]
      : []),
    detail.imdbId ? `  <imdbid>${esc(detail.imdbId)}</imdbid>` : "",
    `  <tmdbid>${detail.id}</tmdbid>`,
    `  <uniqueid type="tmdb" default="true">${detail.id}</uniqueid>`,
    detail.imdbId ? `  <uniqueid type="imdb" default="false">${esc(detail.imdbId)}</uniqueid>` : "",
    detail.firstAirDate ? `  <premiered>${esc(detail.firstAirDate)}</premiered>` : "",
    detail.status ? `  <status>${esc(detail.status)}</status>` : "",
    ...genreStudioCountry(detail),
    ...actorTags(detail),
    detail.numberOfSeasons ? `  <season>${detail.numberOfSeasons}</season>` : "",
    detail.numberOfEpisodes ? `  <episode>${detail.numberOfEpisodes}</episode>` : "",
    "</tvshow>",
  ]);
}

function buildEpisodeNfo(entry: LocalEntry, detail: TmdbDetail, ep: Episode | undefined): string {
  const title = ep?.name || (entry.episode != null ? `Episode ${entry.episode}` : entry.title);
  return assemble([
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    "<episodedetails>",
    `  <title>${esc(title)}</title>`,
    `  <showtitle>${esc(detail.title)}</showtitle>`,
    entry.season != null ? `  <season>${entry.season}</season>` : "",
    entry.episode != null ? `  <episode>${entry.episode}</episode>` : "",
    ep?.overview ? `  <plot>${esc(ep.overview)}</plot>` : "",
    ep?.airDate ? `  <aired>${esc(ep.airDate)}</aired>` : "",
    ep?.voteAverage ? `  <rating>${esc(ep.voteAverage)}</rating>` : "",
    ep?.runtime ? `  <runtime>${ep.runtime}</runtime>` : "",
    ep?.id ? `  <uniqueid type="tmdb" default="true">${ep.id}</uniqueid>` : "",
    `  <uniqueid type="tmdbshow" default="false">${detail.id}</uniqueid>`,
    detail.imdbId ? `  <showimdbid>${esc(detail.imdbId)}</showimdbid>` : "",
    "</episodedetails>",
  ]);
}

function extFromPath(filePath: string, fallback: string): string {
  const m = filePath.split("?")[0].match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : fallback;
}

async function downloadTo(url: string, dest: string): Promise<boolean> {
  try {
    const res = await tauriHttpFetch(url);
    if (!res.ok) return false;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(dest, bytes);
    return true;
  } catch {
    return false;
  }
}

async function seriesRootDir(path: typeof import("@tauri-apps/api/path"), videoPath: string): Promise<string> {
  const dir = await path.dirname(videoPath);
  const base = await path.basename(dir);
  if (/^(specials|s\d{1,2}|season[\s._-]*\d{1,2})$/i.test(base)) {
    return await path.dirname(dir);
  }
  return dir;
}

export async function exportMovie(key: string, entry: LocalEntry, sizes: ExportSizes): Promise<ExportResult> {
  try {
    return await exportMovieInner(key, entry, sizes);
  } catch (err) {
    return { ok: false, reason: errText("movie", err) };
  }
}

async function exportMovieInner(key: string, entry: LocalEntry, sizes: ExportSizes): Promise<ExportResult> {
  if (!isTauri) return { ok: false, reason: "not-desktop" };
  if (!key) return { ok: false, reason: "no-tmdb-key" };
  if (entry.tmdbId == null) return { ok: false, reason: "unidentified" };

  const metaId = `tmdb:movie:${entry.tmdbId}`;
  const meta: Meta = { id: metaId, type: "movie", name: entry.title };
  const detail = await tmdbDetails(key, meta);
  if (!detail) return { ok: false, reason: "no-detail" };
  const art = await resolveArtworkPaths(key, metaId, detail.originalLanguage);

  const path = await import("@tauri-apps/api/path");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const dir = await path.dirname(entry.path);
  const stem = (await path.basename(entry.path)).replace(/\.[^.]+$/, "");
  const at = (name: string) => path.join(dir, name);

  try {
    await writeTextFile(await at(`${stem}.nfo`), buildMovieNfo(detail, art, sizes));
  } catch (err) {
    return { ok: false, reason: errText("write", err) };
  }

  const localArt: ExportResult["localArt"] = {};
  if (art.poster) {
    const dest = await at(`${stem}-poster.${extFromPath(art.poster, "jpg")}`);
    if (await downloadTo(artworkUrl(art.poster, sizes.poster), dest)) localArt.poster = dest;
  }
  if (art.backdrop) {
    const dest = await at(`${stem}-fanart.${extFromPath(art.backdrop, "jpg")}`);
    if (await downloadTo(artworkUrl(art.backdrop, sizes.backdrop), dest)) localArt.backdrop = dest;
  }
  if (art.logo) {
    const dest = await at(`${stem}-clearlogo.${extFromPath(art.logo, "png")}`);
    if (await downloadTo(artworkUrl(art.logo, sizes.logo), dest)) localArt.logo = dest;
  }

  return { ok: true, localArt };
}

export async function exportSeries(key: string, episodes: LocalEntry[], sizes: ExportSizes): Promise<ExportResult> {
  try {
    return await exportSeriesInner(key, episodes, sizes);
  } catch (err) {
    return { ok: false, reason: errText("series", err) };
  }
}

async function exportSeriesInner(key: string, episodes: LocalEntry[], sizes: ExportSizes): Promise<ExportResult> {
  if (!isTauri) return { ok: false, reason: "not-desktop" };
  if (!key) return { ok: false, reason: "no-tmdb-key" };
  const head = episodes.find((e) => e.tmdbId != null);
  if (!head?.tmdbId || episodes.length === 0) return { ok: false, reason: "unidentified" };

  const metaId = `tmdb:tv:${head.tmdbId}`;
  const meta: Meta = { id: metaId, type: "series", name: head.title };
  const detail = await tmdbDetails(key, meta);
  if (!detail) return { ok: false, reason: "no-detail" };
  const art = await resolveArtworkPaths(key, metaId, detail.originalLanguage);

  const path = await import("@tauri-apps/api/path");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const root = await seriesRootDir(path, episodes[0].path);
  const atRoot = (name: string) => path.join(root, name);

  try {
    await writeTextFile(await atRoot("tvshow.nfo"), buildTvShowNfo(detail, art, sizes));
  } catch (err) {
    return { ok: false, reason: errText("write", err) };
  }

  const localArt: ExportResult["localArt"] = {};
  if (art.poster) {
    const dest = await atRoot(`poster.${extFromPath(art.poster, "jpg")}`);
    if (await downloadTo(artworkUrl(art.poster, sizes.poster), dest)) localArt.poster = dest;
  }
  if (art.backdrop) {
    const dest = await atRoot(`fanart.${extFromPath(art.backdrop, "jpg")}`);
    if (await downloadTo(artworkUrl(art.backdrop, sizes.backdrop), dest)) localArt.backdrop = dest;
  }
  if (art.logo) {
    const dest = await atRoot(`clearlogo.${extFromPath(art.logo, "png")}`);
    if (await downloadTo(artworkUrl(art.logo, sizes.logo), dest)) localArt.logo = dest;
  }
  for (const s of detail.seasons) {
    if (!s.posterPath || s.seasonNumber < 1) continue;
    const dest = await atRoot(
      `season${String(s.seasonNumber).padStart(2, "0")}-poster.${extFromPath(s.posterPath, "jpg")}`,
    );
    await downloadTo(artworkUrl(s.posterPath, sizes.poster), dest);
  }

  const seasonCache = new Map<number, Episode[]>();
  for (const ep of episodes) {
    const season = ep.season ?? 0;
    if (!seasonCache.has(season)) {
      seasonCache.set(season, await tmdbSeasonEpisodes(key, head.tmdbId, season).catch(() => []));
    }
    const info = seasonCache.get(season)!.find((e) => e.episodeNumber === ep.episode);
    const dir = await path.dirname(ep.path);
    const stem = (await path.basename(ep.path)).replace(/\.[^.]+$/, "");
    try {
      await writeTextFile(await path.join(dir, `${stem}.nfo`), buildEpisodeNfo(ep, detail, info));
    } catch {
      /* skip */
    }
  }

  return { ok: true, localArt };
}
