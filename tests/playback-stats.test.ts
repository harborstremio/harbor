// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
import { loadSource } from "../scripts/benchmark-name-sync.mjs";

async function renderStats(values: Record<string, number>) {
  let stats: unknown;
  let effect: (() => void) | undefined;
  const requested: string[] = [];
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { __TAURI_INTERNALS__: {}, setInterval: () => 1, clearInterval: () => {} },
  });
  try {
    const { StatsOverlay } = loadSource(
      readFileSync("src/components/player/stats-overlay.tsx", "utf8"),
      {
        react: {
          useState: (initial: unknown) => [stats ?? initial, (next: unknown) => (stats = next)],
          useEffect: (fn: () => void) => (effect = fn),
        },
        "react/jsx-runtime": {
          jsx: (type: unknown, props: unknown) => ({ type, props }),
          jsxs: (type: unknown, props: unknown) => ({ type, props }),
        },
        "@tauri-apps/api/core": {
          invoke: async (_command: string, { name }: { name: string }) => {
            requested.push(name);
            if (!(name in values)) throw new Error("Property unavailable");
            return values[name];
          },
        },
        "@/lib/i18n": { useT: () => (value: string) => value },
      },
    );
    const props = {
      snap: { audioTracks: [], subtitleTracks: [], rate: 1, volume: 1 },
      engine: "mpv",
    };
    StatsOverlay(props);
    effect?.();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    return { requested, rendered: JSON.stringify(StatsOverlay(props)) };
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("playback stats distinguish decoder drops from video-output drops", async () => {
  const result = await renderStats({ "decoder-frame-drop-count": 3, "frame-drop-count": 7 });
  assert.ok(result.requested.includes("decoder-frame-drop-count"));
  assert.ok(result.requested.includes("frame-drop-count"));
  assert.ok(!result.requested.includes("vo-drop-frame-count"));
  assert.ok(result.rendered.includes("3 / 7"));
});

test("unavailable drop counters are not reported as measured zero", async () => {
  const result = await renderStats({ "frame-drop-count": 7 });
  assert.ok(result.rendered.includes("— / 7"));
  const decoderOnly = await renderStats({ "decoder-frame-drop-count": 3 });
  assert.ok(decoderOnly.rendered.includes("3 / —"));
});
