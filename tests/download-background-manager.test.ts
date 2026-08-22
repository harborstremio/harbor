// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  resolveAutoDownloadMeta,
  type AutoDownloadMetaDeps,
  type AutoDownloadMetaRef,
} from "../src/lib/auto-download/meta.ts";
import type { Addon } from "../src/lib/addons.ts";
import type { Meta } from "../src/lib/cinemeta.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function metaRef(patch: Partial<AutoDownloadMetaRef> = {}): AutoDownloadMetaRef {
  return {
    id: "tt-series",
    type: "series",
    title: "Series",
    ...patch,
  };
}

function deps(patch: Partial<AutoDownloadMetaDeps> = {}): AutoDownloadMetaDeps {
  return {
    fetchCinemeta: async () => null,
    fetchAnime: async () => null,
    fetchAddon: async () => null,
    addonAccepts: () => false,
    ...patch,
  };
}

test("anime provider IDs resolve through Anime Kitsu with aired episode metadata", async () => {
  let requestedId = "";
  const result = await resolveAutoDownloadMeta(
    metaRef({ id: "anilist:21", type: "anime" }),
    [],
    deps({
      fetchAnime: async (id) => {
        requestedId = id;
        return {
          id,
          type: "series",
          name: "Anime",
          videos: [
            {
              id: "kitsu:10:4",
              title: "Episode 4",
              season: 1,
              episode: 4,
              released: "2026-07-25T00:00:00.000Z",
            },
          ],
        };
      },
      fetchCinemeta: async () => {
        throw new Error("anime must not fall through to Cinemeta");
      },
    }),
  );

  assert.equal(requestedId, "anilist:21");
  assert.equal(result?.type, "series");
  assert.deepEqual(result?.videos?.[0], {
    id: "kitsu:10:4",
    title: "Episode 4",
    season: 1,
    episode: 4,
    released: "2026-07-25T00:00:00.000Z",
  });
});

test("addon-native series resolve from the persisted addon origin", async () => {
  const calls: string[] = [];
  const expected: Meta = {
    id: "custom:show",
    type: "series",
    name: "Custom Show",
    videos: [{ id: "custom:show:1", season: 1, episode: 1, released: "2026-07-25" }],
  };
  const result = await resolveAutoDownloadMeta(
    metaRef({
      id: "custom:show",
      addonBase: "https://metadata.example",
      addonType: "series",
    }),
    [],
    deps({
      fetchAddon: async (base, type, id) => {
        calls.push(`${base}|${type}|${id}`);
        return expected;
      },
    }),
  );

  assert.deepEqual(calls, ["https://metadata.example|series|custom:show"]);
  assert.equal(result?.addonOrigin?.base, "https://metadata.example");
  assert.deepEqual(result?.videos, expected.videos);
});

test("legacy addon-native entries discover a compatible installed metadata addon", async () => {
  const addon: Addon = {
    transportUrl: "https://installed.example/manifest.json",
    manifest: {
      id: "installed.meta",
      name: "Installed Meta",
      resources: [{ name: "meta", types: ["series"], idPrefixes: ["custom:"] }],
      types: ["series"],
    },
  };
  const result = await resolveAutoDownloadMeta(
    metaRef({ id: "custom:legacy" }),
    [addon],
    deps({
      addonAccepts: (_addon, resource, type, id) =>
        resource === "meta" && type === "series" && id === "custom:legacy",
      fetchAddon: async () => ({
        id: "custom:legacy",
        type: "series",
        name: "Legacy",
        videos: [{ season: 1, episode: 2, released: "2026-07-25" }],
      }),
    }),
  );

  assert.equal(result?.addonOrigin?.id, "installed.meta");
  assert.equal(result?.addonOrigin?.base, "https://installed.example");
  assert.equal(result?.videos?.[0]?.episode, 2);
});

test("auto-download records persist addon metadata origin for background checks", () => {
  const store = source("../src/lib/auto-download.ts");
  assert.match(store, /addonBase\?: string/);
  assert.match(store, /addonType\?: string/);
  assert.match(store, /addonBase:\s*meta\.addonOrigin\?\.base/);
  assert.match(store, /addonType:\s*meta\.type/);
});

test("background retention is opt-in and guards both torrent removal paths", () => {
  const defaults = source("../src/lib/settings/defaults.ts");
  const media = source("../src/views/player/hooks/use-player-media.ts");

  assert.match(defaults, /keepStreamDownloadsInBackground:\s*false/);
  assert.match(media, /if \(!keepInBackground\) void torrentEngineRemove/);
  assert.match(media, /if \(hash && !keepInBackground\) scheduleTorrentRemoval/);
  assert.match(media, /settings\.keepStreamDownloadsInBackground/);
});

test("downloads page polls active torrents only while its TanStack view is active", () => {
  const app = source("../src/App.tsx");
  const downloads = source("../src/views/downloads.tsx");
  const activeTorrents = source("../src/views/downloads/use-active-torrents.ts");

  assert.match(app, /<DownloadsView active=\{downloadsTop\}\s*\/>/);
  assert.match(downloads, /<StreamingNowButton active=\{active\}\s*\/>/);
  assert.match(activeTorrents, /if \(!active\) return/);
  assert.match(activeTorrents, /window\.setInterval\(tick,\s*1500\)/);
  assert.match(activeTorrents, /window\.clearInterval\(id\)/);
});

test("native and TypeScript layers expose list, pause, and resume commands", () => {
  const native = source("../src-tauri/src/torrent_engine.rs");
  const commandList = source("../src-tauri/src/lib.rs");
  const client = source("../src/lib/torrent/local-engine.ts");

  for (const command of ["torrent_engine_list", "torrent_engine_pause", "torrent_engine_resume"]) {
    assert.match(native, new RegExp(`fn ${command}`));
    assert.match(commandList, new RegExp(`torrent_engine::${command}`));
    assert.match(client, new RegExp(`"${command}"`));
  }
});
