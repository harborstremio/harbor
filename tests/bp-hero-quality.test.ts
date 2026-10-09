import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path: string, mocks: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", ...Object.keys(globals), output)(
    (name: string) => {
      assert.ok(name in mocks, `unexpected import ${name}`);
      return mocks[name];
    }, module, module.exports, ...Object.values(globals),
  );
  return module.exports;
}

test("full quality changes hero candidates without expanding TV or card decode sizes", () => {
  let tv = false;
  const art = load("src/views/big-picture/bp-art.ts", {
    "@/lib/platform": { isAndroidTv: () => tv },
  });
  const src = "https://image.tmdb.org/t/p/w500/backdrop.jpg";
  const sources = [{ url: src, portrait: false }, { url: src, portrait: false }];
  assert.deepEqual(art.bpHeroCandidates(sources, true), [
    { src: src.replace("w500", "original"), portrait: false },
  ]);
  assert.equal(art.bpHeroCandidates(sources, false)[0].src, src.replace("w500", "w1280"));
  assert.equal(art.bpHeroArt(src, "portrait"), src.replace("w500", "w780"));
  tv = true;
  assert.equal(art.bpHeroCandidates(sources, true)[0].src, src.replace("w500", "w1280"));
  assert.equal(art.bpHeroArt(undefined, "wide", true), undefined);
});

function trailerHarness() {
  const slots: any[] = [];
  const pending: (() => void)[] = [];
  const timers = new Map<number, () => void>();
  const requests: { id: string; quality: string; resolve: (info: unknown) => void }[] = [];
  let slot = 0;
  let nextTimer = 0;
  let visible = true;
  const settings = { heroTrailers: true, trailerQuality: "720p", tmdbKey: "fixture" };
  const same = (a?: unknown[], b?: unknown[]) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
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
      pending.push(() => {
        slots[i]?.cleanup?.();
        slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  const api = load("src/views/big-picture/use-bp-trailer.ts", {
    react,
    "@/lib/cinemeta": { narrowMediaType: (t: string) => t, meta: async (_: string, id: string) => ({ trailers: [{ source: id }] }) },
    "@/lib/providers/tmdb": { tmdbTrailerList: async (_: string, id: string) => [id] },
    "@/lib/trailer": {
      resolveTrailerQuality: (q: string) => q === "auto" ? "360p" : q,
      fetchTrailer: (id: string, quality: string) => new Promise(resolve => requests.push({ id, quality, resolve })),
      prefetchTrailer: () => {},
      trailerSrc: (info: { stream_url: string }) => info.stream_url,
    },
    "@/lib/visibility": { usePageVisible: () => visible },
    "@/lib/settings": { useSettings: () => ({ settings }) },
  }, {
    window: {
      setTimeout: (fn: () => void) => { const id = ++nextTimer; timers.set(id, fn); return id; },
      clearTimeout: (id: number) => timers.delete(id),
    },
  });
  return {
    settings, requests,
    render(id = "tmdb:movie:1") {
      slot = 0;
      const output = api.useBpTrailer(id ? { id, type: "movie" } : null);
      pending.splice(0).forEach(fn => fn());
      return output.src;
    },
    async dwell() {
      const due = [...timers.values()];
      timers.clear();
      due.forEach(fn => fn());
      await Promise.resolve();
    },
    hide() { visible = false; },
  };
}

test("trailer uses the selected quality and replaces the same title when it changes", async () => {
  const h = trailerHarness();
  assert.equal(h.render(), null);
  assert.equal(h.requests.length, 0, "wait for focus to settle");
  await h.dwell();
  assert.equal(h.requests[0].quality, "720p");
  h.requests[0].resolve({ stream_url: "720p.mp4" });
  await Promise.resolve();
  assert.equal(h.render(), "720p.mp4");
  h.settings.trailerQuality = "1080p";
  assert.equal(h.render(), null, "hide old quality before effects run");
  await h.dwell();
  assert.equal(h.requests[1].quality, "1080p");
  h.requests[1].resolve({ stream_url: "1080p.mp4" });
  await Promise.resolve();
  assert.equal(h.render(), "1080p.mp4");
  h.hide();
  assert.equal(h.render(), null);
});

test("a stale native result cannot overwrite a new quality or disabled trailer", async () => {
  const h = trailerHarness();
  h.render();
  await h.dwell();
  h.settings.trailerQuality = "best";
  h.render();
  await h.dwell();
  h.requests[1].resolve({ stream_url: "best.mp4" });
  await Promise.resolve();
  h.requests[0].resolve({ stream_url: "stale.mp4" });
  await Promise.resolve();
  assert.equal(h.render(), "best.mp4");
  h.settings.heroTrailers = false;
  assert.equal(h.render(), null);
  await h.dwell();
  assert.equal(h.requests.length, 2);
});

test("quick focus changes cancel the old dwell; auto quality uses the shared resolver", async () => {
  const h = trailerHarness();
  h.settings.trailerQuality = "auto";
  h.render("tt-old");
  h.render("tt-current");
  await h.dwell();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].id, "tt-current");
  assert.equal(h.requests[0].quality, "360p");
  h.requests[0].resolve({ stream_url: "current.mp4" });
  await Promise.resolve();
  assert.equal(h.render("tt-current"), "current.mp4");
  assert.equal(h.render(""), null);
});
