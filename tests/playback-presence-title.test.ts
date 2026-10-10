// Presence must show one title for the session. The meta a launch carries is
// source-dependent (a Kitsu addon meta is the Kitsu canonical title, often
// romaji), so the hook resolves a preferred anime title the same way the cards
// do — and must not pay for that lookup when presence is off or the title is not
// anime.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// The hook schedules a position refresh; Node has no window.
(globalThis as { window?: unknown }).window = {
  setInterval: () => 1,
  clearInterval: () => {},
};

function createHarness(settingsOverrides: Record<string, unknown> = {}) {
  const effects: Array<{ deps?: unknown[]; cleanup?: (() => void) | undefined }> = [];
  const states: unknown[] = [];
  let effectSlot = 0;
  let stateSlot = 0;
  let dirty = false;
  const pending: Array<() => void> = [];
  const published: Array<Record<string, unknown>> = [];
  const lookups: string[] = [];
  let release: (value: string | null) => void = () => {};
  const titlePromise = new Promise<string | null>((resolve) => {
    release = resolve;
  });

  const react = {
    useState(initial: unknown) {
      const slot = stateSlot++;
      if (!(slot in states)) states[slot] = initial;
      return [
        states[slot],
        (next: unknown) => {
          const value =
            typeof next === "function" ? (next as (prev: unknown) => unknown)(states[slot]) : next;
          if (!Object.is(value, states[slot])) {
            states[slot] = value;
            dirty = true;
          }
        },
      ];
    },
    useEffect(fn: () => void | (() => void), deps?: unknown[]) {
      const slot = effectSlot++;
      const prev = effects[slot];
      const same =
        prev?.deps &&
        deps &&
        prev.deps.length === deps.length &&
        deps.every((dep, i) => Object.is(dep, prev.deps![i]));
      if (same) return;
      pending.push(() => {
        prev?.cleanup?.();
        effects[slot] = { deps, cleanup: fn() ?? undefined };
      });
    },
  };

  const settings = {
    discordRichPresence: true,
    shareWatchPresence: false,
    animeTitleLanguage: "english",
    ...settingsOverrides,
  };

  const clockListeners = new Set<() => void>();
  let clockPos = 0;

  const mocks: Record<string, unknown> = {
    react,
    "@/lib/discord/presence": {
      setPlaybackPresence: (payload: Record<string, unknown>) => {
        published.push(payload);
      },
    },
    "@/lib/anime-title": {
      resolvePreferredAnimeTitle: (id: string) => {
        lookups.push(id);
        return titlePromise;
      },
    },
    "@/lib/settings": { useSettings: () => ({ settings }) },
    "@/lib/player/playback-clock": {
      getPlaybackPosition: () => clockPos,
      subscribePlaybackClock: (fn: () => void) => {
        clockListeners.add(fn);
        return () => {
          clockListeners.delete(fn);
        };
      },
    },
  };

  const source = readFileSync("src/views/player/hooks/use-playback-presence.ts", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: { usePlaybackPresence?: (params: unknown) => void } = {};
  new Function("require", "exports", code)((id: string) => {
    assert.ok(id in mocks, `unexpected import ${id}`);
    return mocks[id];
  }, exports);

  return {
    published,
    lookups,
    resolve: (value: string | null) => release(value),
    setClock(pos: number) {
      clockPos = pos;
      for (const fn of clockListeners) fn();
    },
    render(params: Record<string, unknown>) {
      for (let pass = 0; pass < 8; pass++) {
        stateSlot = 0;
        effectSlot = 0;
        dirty = false;
        exports.usePlaybackPresence?.(params);
        for (const run of pending.splice(0)) run();
        if (!dirty) break;
      }
    },
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

const params = (id: string, name: string) => ({
  src: {
    meta: { id, name, type: "series" },
    episode: { season: 1, episode: 2, name: "Episode 2" },
  },
  snap: { status: "playing", durationSec: 1400, positionSec: 42 },
  season: 1,
  episode: 2,
  liveGuideOpen: false,
});

const ROMAJI = "Mushoku Tensei: Isekai Ittara Honki Dasu 3rd Season";
const ENGLISH = "Mushoku Tensei: Jobless Reincarnation Season 3";

test("an anime meta publishes the resolved preferred title, not the romaji meta name", async () => {
  const h = createHarness();
  h.render(params("kitsu:49002", ROMAJI));
  assert.equal(h.published.at(-1)?.title, ROMAJI, "the raw meta name shows until resolved");

  h.resolve(ENGLISH);
  await settle();
  h.render(params("kitsu:49002", ROMAJI));

  assert.equal(h.published.at(-1)?.title, ENGLISH);
  assert.deepEqual(h.lookups, ["kitsu:49002"]);
});

test("a non-anime title never pays for a lookup", () => {
  const h = createHarness();
  h.render(params("tt1234567", "Some Live Action Show"));
  assert.equal(h.published.at(-1)?.title, "Some Live Action Show");
  assert.deepEqual(h.lookups, []);
});

test("presence being off never pays for a lookup", () => {
  const h = createHarness({ discordRichPresence: false, shareWatchPresence: false });
  h.render(params("kitsu:49002", ROMAJI));
  assert.equal(h.published.at(-1)?.title, ROMAJI);
  assert.deepEqual(h.lookups, []);
});

test("the social watch-share also earns the resolved title", () => {
  const h = createHarness({ discordRichPresence: false, shareWatchPresence: true });
  h.render(params("kitsu:49002", ROMAJI));
  assert.deepEqual(h.lookups, ["kitsu:49002"], "sharing presence is enough to resolve");
});

test("an unresolved lookup falls back to the meta name", async () => {
  const h = createHarness();
  h.render(params("kitsu:49002", ROMAJI));
  h.resolve(null);
  await settle();
  h.render(params("kitsu:49002", ROMAJI));
  assert.equal(h.published.at(-1)?.title, ROMAJI);
});

test("a resume seek re-publishes the position at once", () => {
  // The resume is applied as a seek after the file loads: the first publish
  // lands at 0:00, so Discord must be corrected the moment the seek arrives
  // instead of waiting for the 30s refresh.
  const h = createHarness();
  h.setClock(0);
  h.render(params("tt1234567", "Some Live Action Show"));
  assert.equal(h.published.at(-1)?.positionSec, 0);
  const before = h.published.length;

  h.setClock(320);
  assert.ok(h.published.length > before, "a seek publishes immediately");
  assert.equal(h.published.at(-1)?.positionSec, 320);
});

test("ordinary playback advance does not re-publish on every tick", () => {
  const h = createHarness();
  h.setClock(100);
  h.render(params("tt1234567", "Some Live Action Show"));
  const before = h.published.length;
  h.setClock(101);
  assert.equal(h.published.length, before, "a one-second advance is not a seek");
});

test("the CW card re-resolves when the title language changes", () => {
  // Its own effect, keyed on the preference: changing the language must update
  // the card live, not wait for a remount, and must not re-run the artwork
  // hydration that shares the old effect.
  const src = readFileSync("src/components/continue-card.tsx", "utf8");
  assert.match(src, /resolvePreferredAnimeTitle\(item\._id, settings\.animeTitleLanguage\)/);
  assert.match(src, /\}, \[item\._id, settings\.animeTitleLanguage\]\);/);
});
