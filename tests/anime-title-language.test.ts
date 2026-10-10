// AniZip's `x-jat` is AniDB's abbreviated short title ("OP TV", "Bleach3",
// "SnK"), so "romaji" must come from Kitsu's own `en_jp`. Cinemeta rows are
// covered too, via the anime mapping their detail page recorded.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const KITSU_TITLES: Record<number, Record<string, string>> = {
  12: { en: "One Piece", en_jp: "One Piece", ja_jp: "ONE PIECE" },
  46903: {
    en: "BLEACH: Thousand-Year Blood War Part 2 - The Separation",
    en_jp: "BLEACH: Sennen Kessen-hen - Ketsubetsu-tan",
    ja_jp: "BLEACH 千年血戦篇-訣別譚-",
  },
};

const ANIZIP: Record<string, Record<string, string>> = {
  "kitsu:12": { "x-jat": "OP TV", en: "One Piece", ja: "ONE PIECE" },
  "kitsu:46903": {
    "x-jat": "Bleach3",
    en: "Bleach: Thousand-Year Blood War - The Separation",
    ja: "BLEACH 千年血戦篇-訣別譚-",
  },
};

type Overrides = {
  cwId?: string | null;
  imdbKitsu?: number | null;
};

function load({ cwId = null, imdbKitsu = null }: Overrides = {}) {
  const anizip = (key: string) => async () => ({
    titles: ANIZIP[key] ?? null,
  });
  const mocks: Record<string, unknown> = {
    "@/lib/providers/anizip": {
      aniZipByKitsu: (id: number) => anizip(`kitsu:${id}`)(),
      aniZipByMal: (id: number) => anizip(`mal:${id}`)(),
      aniZipByAnilist: (id: number) => anizip(`anilist:${id}`)(),
      aniZipByAnidb: (id: number) => anizip(`anidb:${id}`)(),
      aniZipByImdb: (id: string) => anizip(id)(),
    },
    "@/lib/anime-cw-ids": { getAnimeCwId: () => cwId },
    "@/lib/providers/anime-mapping": {
      externalToKitsu: async () => null,
      imdbToKitsu: async () => imdbKitsu,
    },
    "@/lib/providers/kitsu": {
      parseKitsuId: (id: string) => {
        const m = /^kitsu:(\d+)/.exec(id);
        return m ? Number(m[1]) : null;
      },
    },
  };
  const fetchStub = async (url: string) => {
    const id = Number(/anime\/(\d+)/.exec(url)?.[1]);
    const titles = KITSU_TITLES[id];
    return { ok: !!titles, json: async () => ({ data: { attributes: { titles } } }) };
  };
  const source = readFileSync("src/lib/anime-title.ts", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, (...args: never[]) => unknown> = {};
  new Function("require", "exports", "fetch", code)(
    (id: string) => {
      assert.ok(id in mocks, `unexpected import ${id}`);
      return mocks[id];
    },
    exports,
    fetchStub,
  );
  return exports as unknown as {
    resolvePreferredAnimeTitle: (id: string, lang: string) => Promise<string | null>;
  };
}

test("romaji comes from Kitsu en_jp, never AniZip's abbreviated x-jat", async () => {
  const api = load();
  assert.equal(await api.resolvePreferredAnimeTitle("kitsu:12", "romaji"), "One Piece");
  assert.equal(
    await api.resolvePreferredAnimeTitle("kitsu:46903", "romaji"),
    "BLEACH: Sennen Kessen-hen - Ketsubetsu-tan",
  );
});

test("english and native still come from AniZip", async () => {
  const api = load();
  assert.equal(
    await api.resolvePreferredAnimeTitle("kitsu:46903", "english"),
    "Bleach: Thousand-Year Blood War - The Separation",
  );
  assert.equal(
    await api.resolvePreferredAnimeTitle("kitsu:46903", "native"),
    "BLEACH 千年血戦篇-訣別譚-",
  );
});

test("a Cinemeta row resolves through the anime mapping its detail page recorded", async () => {
  const api = load({ cwId: "kitsu:12" });
  assert.equal(await api.resolvePreferredAnimeTitle("tt0388629", "romaji"), "One Piece");
});

test("a Cinemeta row with no recorded mapping falls back to the IMDb bridge", async () => {
  const api = load({ imdbKitsu: 46903 });
  assert.equal(
    await api.resolvePreferredAnimeTitle("tt14986406", "romaji"),
    "BLEACH: Sennen Kessen-hen - Ketsubetsu-tan",
  );
});

test("a non-anime Cinemeta row resolves to nothing", async () => {
  const api = load();
  assert.equal(await api.resolvePreferredAnimeTitle("tt1234567", "romaji"), null);
});

test("the Continue Watching card resolves titles for detected Cinemeta rows too", () => {
  const src = readFileSync("src/components/continue-card.tsx", "utf8");
  assert.match(src, /if \(!isAnimeCwItem\(item\) && getAnimeCwId\(item\._id\) == null\) return;/);
});
