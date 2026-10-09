import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path: string, mocks: Record<string, unknown>) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", output)(
    (name: string) => {
      assert.ok(name in mocks, `unexpected import ${name}`);
      return mocks[name];
    }, module, module.exports,
  );
  return module.exports;
}

function metadataHarness() {
  const requests: string[] = [];
  let imageLanguage = "en";
  let fail = false;
  const api = load("src/views/profile/profile-title-meta.ts", {
    "@/lib/cache": { lruSet: (map: Map<string, unknown>, key: string, value: unknown) => map.set(key, value) },
    "@/lib/providers/tmdb/tmdb-imdb-resolve": { tmdbIdFromImdb: async () => "tmdb:tv:1" },
    "@/lib/providers/tmdb/tmdb-client": {
      get: async (_: string, path: string, params: { language: string }) => {
        requests.push(`${path}|${params.language}`);
        return fail ? null : { name: params.language === "ar" ? "عنوان عربي" : "English title", original_name: "Original title" };
      },
    },
    "@/lib/providers/tmdb/tmdb-images": {
      tmdbLocalizedPoster: async () => fail ? undefined : `${imageLanguage}.jpg`,
    },
  });
  return { ...api, requests, setImageLanguage: (v: string) => { imageLanguage = v; }, fail: () => { fail = true; } };
}

test("profile media identity accepts exact movie/series IDs without guessing other media", () => {
  const { profileTitleId } = metadataHarness();
  assert.equal(profileTitleId("tmdb:series:42", "series"), "tmdb:tv:42");
  assert.equal(profileTitleId("tt1234567:2:4"), "tt1234567");
  assert.equal(profileTitleId("imdb:tt1234567"), "tt1234567");
  assert.equal(profileTitleId("tmdb:movie:42", "manga"), undefined);
  assert.equal(profileTitleId("Some film title"), undefined);
  assert.equal(profileTitleId("tmdb:person:42"), undefined);
});

test("profile metadata follows viewer title and artwork languages independently", async () => {
  const h = metadataHarness();
  assert.deepEqual(await h.profileTitleMeta("fixture", "tt1234567", "en", true), { title: "English title", poster: "en.jpg" });
  h.setImageLanguage("ja");
  assert.deepEqual(await h.profileTitleMeta("fixture", "tt1234567", "en", true), { title: "English title", poster: "ja.jpg" });
  assert.equal(h.requests.length, 1, "repeated titles reuse bounded metadata cache");
  assert.deepEqual(await h.profileTitleMeta("fixture", "tt1234567", "ar", true), { title: "عنوان عربي", poster: "ja.jpg" });
  assert.equal(h.requests.length, 2, "language change must not reuse old title");
  assert.equal((await h.profileTitleMeta("fixture", "tt1234567", "en", false)).title, "Original title");
});

test("missing metadata leaves the published snapshot available to callers", async () => {
  const h = metadataHarness();
  h.fail();
  assert.deepEqual(await h.profileTitleMeta("fixture", "tmdb:movie:404", "en", true), { title: undefined, poster: undefined });
});

function hookHarness() {
  const slots: any[] = [];
  const effects: (() => void)[] = [];
  const requests: { id: string; language: string; resolve: (v: unknown) => void }[] = [];
  const settings = { tmdbKey: "fixture", tmdbLanguage: "en", translateTitles: true, tmdbImageLangs: ["en"] };
  let slot = 0;
  let observe: ((entry: { isIntersecting: boolean }) => void) | undefined;
  const same = (a?: unknown[], b?: unknown[]) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const api = load("src/views/profile/use-profile-title.ts", {
    react: {
      useState(initial: unknown) {
        const i = slot++;
        if (!(i in slots)) slots[i] = initial;
        return [slots[i], (value: unknown) => { slots[i] = value; }];
      },
      useMemo(fn: () => unknown, deps: unknown[]) {
        const i = slot++;
        if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() };
        return slots[i].value;
      },
      useEffect(fn: () => (() => void) | undefined, deps: unknown[]) {
        const i = slot++;
        if (same(slots[i]?.deps, deps)) return;
        effects.push(() => {
          slots[i]?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
      },
    },
    "@/lib/settings": { useSettings: () => ({ settings }) },
    "@/lib/visibility": { observeWithin: (_: unknown, _margin: string, cb: typeof observe) => { observe = cb; return () => {}; } },
    "./profile-title-meta": {
      profileTitleId: metadataHarness().profileTitleId,
      profileTitleMeta: (_: string, id: string, language: string) => new Promise(resolve => requests.push({ id, language, resolve })),
    },
  });
  return {
    settings, requests,
    render(id = "tmdb:movie:1") {
      slot = 0;
      const value = api.useProfileTitle(id, "Published title", "published.jpg");
      effects.splice(0).forEach(fn => fn());
      return value;
    },
    visible(value: boolean) { observe?.({ isIntersecting: value }); },
  };
}

test("profile cards wait until near the viewport and reject old language responses", async () => {
  const h = hookHarness();
  h.render().ref({});
  h.render();
  assert.equal(h.requests.length, 0);
  h.visible(true);
  h.render();
  assert.equal(h.requests.length, 1);
  h.settings.tmdbLanguage = "ar";
  h.render();
  h.requests[1].resolve({ title: "عنوان عربي", poster: "arabic.jpg" });
  await Promise.resolve();
  assert.equal(h.render().title, "عنوان عربي");
  h.requests[0].resolve({ title: "English title", poster: "english.jpg" });
  await Promise.resolve();
  assert.equal(h.render().title, "عنوان عربي");
  assert.equal(h.render("tmdb:movie:2").title, "Published title", "new title must never inherit old card metadata");
});

test("artwork preference changes refresh visible cards and missing data retains snapshots", async () => {
  const h = hookHarness();
  h.render().ref({});
  h.render();
  h.visible(true);
  h.render();
  h.requests[0].resolve({ title: "English title", poster: "en.jpg" });
  await Promise.resolve();
  assert.equal(h.render().poster, "en.jpg");
  h.settings.tmdbImageLangs = ["ja"];
  h.render();
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({});
  await Promise.resolve();
  assert.equal(h.render().poster, "published.jpg");
  assert.equal(h.render().title, "Published title");
});
