// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  isForeignScriptTitle,
  mergeAniZipEpisodes,
  mergeTmdbEpisodes,
  mergeTvdbEpisodes,
} from "../src/lib/providers/anime-episode-build.ts";
import { fillAiredPlaceholderTitles } from "../src/lib/providers/episode-placeholder.ts";
import type { KitsuEpisode } from "../src/lib/providers/kitsu.ts";

function episode(overrides: Partial<KitsuEpisode> = {}): KitsuEpisode {
  return {
    id: 1, number: 1, seasonNumber: 1, title: "Episode 1", synopsis: "", thumbnail: null,
    airdate: "2026-10-02", length: 24,
    ...overrides,
  };
}

test("foreign-script detection", () => {
  assert.equal(isForeignScriptTitle("Oni's Blood"), false);
  assert.equal(isForeignScriptTitle("鬼の血"), true);
  assert.equal(isForeignScriptTitle(""), false);
});

test("an English target never takes a Japanese AniZip title", () => {
  const ep = episode();
  mergeAniZipEpisodes([ep], {
    mappings: { kitsu_id: 1 },
    episodes: { "1": { episode: "1", title: { ja: "鬼の血" } } },
  } as any);
  assert.equal(ep.title, "Episode 1", "a Japanese title must not become the English name");
});

test("an English target ignores a romaji AniZip title (x-jat)", () => {
  const ep = episode();
  mergeAniZipEpisodes([ep], {
    mappings: { kitsu_id: 1 },
    episodes: {
      "1": { episode: "1", title: { en: null, "x-jat": "Bousou Suru Scorpius ga Arawareta!" } },
    },
  } as any);
  assert.equal(ep.title, "Episode 1", "romaji must not stand in for an English title");
});

test("an English AniZip title still applies", () => {
  const ep = episode();
  mergeAniZipEpisodes([ep], {
    mappings: { kitsu_id: 1 },
    episodes: { "1": { episode: "1", title: { en: "Oni's Blood" } } },
  } as any);
  assert.equal(ep.title, "Oni's Blood");
});

test("a TVDB English name replaces a Japanese pool title for an English target", () => {
  const ep = episode({ title: "鬼の血" });
  mergeTvdbEpisodes([ep], [{ id: 11, number: 1, seasonNumber: 1, name: "Oni's Blood" }]);
  assert.equal(ep.title, "Oni's Blood");
});

test("a TMDB English name replaces a Japanese pool title for an English target", () => {
  const ep = episode({ title: "鬼の血" });
  mergeTmdbEpisodes([ep], [
    { id: 11, seasonNumber: 1, episodeNumber: 1, name: "Oni's Blood" } as any,
  ]);
  assert.equal(ep.title, "Oni's Blood");
});

test("a Japanese target keeps the Japanese TVDB name", () => {
  const ep = episode();
  mergeTvdbEpisodes([ep], [{ id: 11, number: 1, seasonNumber: 1, name: "鬼の血" }], { lang: "ja" });
  assert.equal(ep.title, "鬼の血");
});

test("the English fallback pass never overwrites a Japanese title for a Japanese user", () => {
  const ep = episode({ title: "鬼の血" });
  mergeTvdbEpisodes([ep], [{ id: 11, number: 1, seasonNumber: 1, name: "Oni's Blood" }], {
    targetLang: "ja",
  });
  assert.equal(ep.title, "鬼の血", "the selected language wins over the English fallback");
});

test("the English fallback pass fills a generic title for a Japanese user", () => {
  const ep = episode({ title: "Episode 1" });
  mergeTvdbEpisodes([ep], [{ id: 11, number: 1, seasonNumber: 1, name: "Oni's Blood" }], {
    targetLang: "ja",
  });
  assert.equal(ep.title, "Oni's Blood");
});

test("the English fallback pass replaces an original-script title the user did not ask for", () => {
  // A Korean user: a leftover Japanese original is not their language, so the
  // English fallback may still improve it.
  const ep = episode({ title: "鬼の血" });
  mergeTvdbEpisodes([ep], [{ id: 11, number: 1, seasonNumber: 1, name: "Oni's Blood" }], {
    targetLang: "ko",
  });
  assert.equal(ep.title, "Oni's Blood");
});

test("the TMDB fallback pass respects the selected language too", () => {
  const jp = episode({ title: "鬼の血" });
  mergeTmdbEpisodes([jp], [{ id: 11, seasonNumber: 1, episodeNumber: 1, name: "Oni's Blood" } as any], {
    targetLang: "ja",
  });
  assert.equal(jp.title, "鬼の血");
  const kr = episode({ title: "鬼の血" });
  mergeTmdbEpisodes([kr], [{ id: 11, seasonNumber: 1, episodeNumber: 1, name: "Oni's Blood" } as any], {
    targetLang: "ko",
  });
  assert.equal(kr.title, "Oni's Blood");
});

test("an English target fills a Japanese row title from the pool", () => {
  const row = episode({ title: "鬼の血", id: 2, tvdbEpisodeId: 11 });
  const pool = episode({ title: "Oni's Blood", id: 1, tvdbEpisodeId: 11 });
  const [out] = fillAiredPlaceholderTitles([row], [pool], Date.now(), "en");
  assert.equal(out.title, "Oni's Blood");
});

test("a non-English target does not treat a foreign title as fillable", () => {
  const row = episode({ title: "鬼の血", id: 2, tvdbEpisodeId: 11 });
  const pool = episode({ title: "Oni's Blood", id: 1, tvdbEpisodeId: 11 });
  const [out] = fillAiredPlaceholderTitles([row], [pool], Date.now(), "ja");
  assert.equal(out.title, "鬼の血");
});
