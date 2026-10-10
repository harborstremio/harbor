import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function harness() {
  const watched = new Set<string>();
  const aliases = new Map<string, string>();
  const movies = new Map<string, { ms: number; pct?: number }>();
  const episodes = new Map<string, { ms: number; pct?: number; season: number; episode: number }>();
  const mocks: Record<string, unknown> = {
    "../resume": { readResumeEntry: (id: string) => movies.get(id), lastPlayedEpisode: (id: string) => episodes.get(id) },
    "../movie-watched": { isMovieWatchedLocal: (id: string) => watched.has(id) },
    "../providers/tmdb": { tmdbImdbCached: (id: string) => aliases.get(id) },
    "../stremio": { episodeFromVideoId: () => null },
    "./timing": { FRESH_FRACTION: 0.95, RESUME_MEMO_TTL_MS: 5000 },
  };
  const output = ts.transpileModule(readFileSync("src/lib/hover-preview/resume-index.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", output)(
    (name: string) => { assert.ok(name in mocks, `unexpected import ${name}`); return mocks[name]; },
    module, module.exports,
  );
  return { ...module.exports, watched, aliases, movies, episodes };
}

const movie = { id: "tt100", type: "movie", name: "Fixture film" };
const series = { id: "tt200", type: "series", name: "Fixture series" };
const published = (id = movie.id) => ({
  _id: id, type: "movie", state: { timeOffset: 60_000, duration: 6_000_000 },
});

test("marking a movie watched overrides an already published in-progress preview", () => {
  const h = harness();
  h.publishResumeStates([published()]);
  assert.equal(h.resolveResume(movie).fraction, 0.01);
  h.watched.add(movie.id);
  assert.equal(h.resolveResume(movie), null);
});

test("watched status overrides a cached local fallback immediately", () => {
  const h = harness();
  h.movies.set(movie.id, { ms: 60_000 });
  assert.ok(h.resolveResume(movie));
  h.watched.add(movie.id);
  assert.equal(h.resolveResume(movie), null);
});

test("the mapped IMDb watched marker also suppresses a TMDB preview", () => {
  const h = harness();
  const tmdb = { ...movie, id: "tmdb:movie:100" };
  h.aliases.set(tmdb.id, movie.id);
  h.publishResumeStates([published(tmdb.id)]);
  h.watched.add(movie.id);
  assert.equal(h.resolveResume(tmdb), null);
});

test("starting a rewatch uses fresh progress rather than the retired cached preview", () => {
  const h = harness();
  h.publishResumeStates([published()]);
  h.watched.add(movie.id);
  assert.equal(h.resolveResume(movie), null);
  h.watched.delete(movie.id);
  h.movies.set(movie.id, { ms: 120_000, pct: 0.02 });
  assert.equal(h.resolveResume({ ...movie, runtime: "100 min" }).fraction, 0.02);
});

for (const type of ["movie", "series"] as const) {
  test(`a completed ${type} percentage is honored without metadata runtime`, () => {
    const h = harness();
    if (type === "movie") h.movies.set(movie.id, { ms: 60_000, pct: 0.98 });
    else h.episodes.set(series.id, { ms: 60_000, pct: 0.98, season: 1, episode: 3 });
    assert.equal(h.resolveResume(type === "movie" ? movie : series), null);
  });
  test(`a partial ${type} percentage keeps progress without inventing remaining time`, () => {
    const h = harness();
    if (type === "movie") h.movies.set(movie.id, { ms: 60_000, pct: 0.4 });
    else h.episodes.set(series.id, { ms: 60_000, pct: 0.4, season: 1, episode: 3 });
    const result = h.resolveResume(type === "movie" ? movie : series);
    assert.equal(result.fraction, 0.4);
    assert.equal(result.remainingMs, null);
  });
}

test("series Up Next and external progress preserve their existing semantics", () => {
  const h = harness();
  h.watched.add(series.id);
  h.publishResumeStates([{ ...published(series.id), type: "series", upNext: true, external: "simkl",
    state: { timeOffset: 0, duration: 0, season: 2, episode: 1 } }]);
  assert.deepEqual(h.resolveResume(series), {
    season: 2, episode: 1, fraction: null, remainingMs: null, upNext: true, external: true,
  });
});

test("unknown percentages still use runtime and elapsed time", () => {
  const h = harness();
  h.movies.set(movie.id, { ms: 60_000, pct: Number.NaN });
  const result = h.resolveResume({ ...movie, runtime: "1h 40m" });
  assert.equal(result.fraction, 0.01);
  assert.equal(result.remainingMs, 5_940_000);
});
