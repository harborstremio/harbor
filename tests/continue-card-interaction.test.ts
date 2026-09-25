import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as icons from "lucide-react";
import { createRoot } from "react-dom/client";

function harness() {
  const dom = new JSDOM("<!doctype html><body><div id='app'></div>", { url: "http://localhost/" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const empty = () => {};
  Object.assign(globalThis, {
    IntersectionObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  let target: any;
  const starts: any[] = [];
  const removed: any[] = [];
  const noopProvider = {
    aniZipByAnidb: async () => null,
    aniZipByAnilist: async () => null,
    aniZipByKitsu: async () => null,
    aniZipByMal: async () => null,
  };
  const t = (key: string) => key;
  let profile = "fixture-a";
  const deps: Record<string, any> = {
    react: React,
    "react/jsx-runtime": jsx,
    "lucide-react": icons,
    "@/components/icons/play-filled": { Play: icons.Play },
    "@/lib/cinemeta": { narrowMediaType: (type: string) => type },
    "@/lib/meta-resource": { resolveMeta: async () => null },
    "@/lib/providers/anime-kitsu-addon": { animeKitsuMeta: async () => null },
    "@/lib/providers/anime-franchise-root": { isSplitFranchiseKitsu: () => false },
    "@/lib/providers/kitsu": { parseKitsuId: () => null },
    "@/lib/streams/anime-identity-core": {
      isForeignSplitSeason: () => false,
      splitFranchiseDisplaySeason: () => undefined,
    },
    "@/lib/subtitles/anime-numbering": { classifyAnimeNumbering: () => ({ mode: "season" }) },
    "@/lib/providers/tmdb/tmdb-lite": { tmdbLiteMeta: async () => null },
    "@/lib/providers/tmdb": { tmdbIdFromImdb: async () => null },
    "@/lib/context-menu": {
      useContextMenu: () => ({
        open: (event: Event, value: any) => {
          event.preventDefault();
          event.stopPropagation();
          target = value;
        },
      }),
    },
    "@/lib/i18n": { useT: () => t },
    "@/lib/snapshots": { readSnapshot: () => null, useSnapshotVersion: empty },
    "@/lib/stremio": {
      episodeFromVideoId: () => null,
      isAnimeCwItem: () => false,
      libraryMetaType: (type: string) => type,
    },
    "@/lib/new-episodes": { useHasNewEpisode: () => 0 },
    "@/views/detail/tooltip": { Tooltip: ({ children }: any) => children },
    "@/lib/profiles": {
      useProfiles: () => ({ profiles: [], activeProfile: { id: profile } }),
      sharesStremioStorage: () => false,
    },
    "@/lib/auth": { useAuth: () => ({ authKey: "fixture-auth" }) },
    "@/lib/settings": { useSettings: () => ({ settings: { liquidGlass: false } }) },
    "@/lib/view": {
      useView: () => ({
        openMeta: (meta: any) => starts.push({ details: meta }),
        openPicker: (meta: any, episode: any, mode: any) => starts.push({ meta, episode, mode }),
        openPlayer: (src: any) => starts.push({ src }),
      }),
    },
    "@/lib/watched-by": { getWatchedBy: () => null },
    "@/lib/local-library/playback": { resolveLocalPlayVersions: () => [] },
    "@/lib/local-library/player-src": { localPlayerSrc: empty },
    "@/lib/player/local-versions-modal": { openLocalVersions: empty },
    "@/lib/media-server/connections": { mediaServerConnections: () => [] },
    "@/lib/media-server/index-store": { mediaServerItems: async () => [] },
    "@/lib/media-server/selectors": {
      matchingServerItems: () => [],
      serverPlayableCopies: () => [],
    },
    "@/lib/media-server/playback": {
      createMediaServerPlayerSrc: empty,
      decidePlaybackSource: () => ({ kind: "online" }),
    },
    "@/lib/series-episodes": { fetchSeasonEpisodes: async () => [] },
    "@/lib/providers/anizip": noopProvider,
    "@/lib/logo": { peekCachedLogo: () => null, resolveLogo: async () => null },
    "@/lib/anime-title": { resolvePreferredAnimeTitle: async () => null },
    "@/lib/providers/jikan": { stripFranchiseSuffix: (name: string) => name },
    "@/lib/anime-cw-ids": { getAnimeCwId: () => null },
    "@/lib/cw-anime-episode": {
      aniZipLookupKey: () => null,
      applyAniZipEpisode: empty,
      needsAniZipSyncIds: () => false,
    },
    "@/components/ThreeLiquidGlassSurface": {
      ThreeLiquidGlassSurface: ({ children }: any) => children,
    },
    "@/components/lists/list-toast": { emitListToast: empty },
    "@/lib/playback-history": {
      capturePlaybackActor: () => profile,
      isPlaybackActorCurrent: (actor: string) => profile === actor,
    },
    "@/lib/cw-dismiss": {
      isCwDismissed: (item: any) => removed.some((entry) => entry._id === item._id),
    },
    "@/lib/local-cw": { localCwEntry: () => ({}) },
    "@/lib/manual-watched": { isManualWatchedDismissed: () => false },
  };
  const load = (path: string) => {
    const mod = { exports: {} as any };
    const output = ts.transpileModule(
      readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText;
    new Function("require", "module", "exports", output)(
      (name: string) => {
        if (name === "@/lib/continue-card-actions") return load("src/lib/continue-card-actions.ts");
        if (name.startsWith("@/assets/")) return "fixture-art";
        assert.ok(name in deps, `Unexpected dependency ${name}`);
        return deps[name];
      },
      mod,
      mod.exports,
    );
    return mod.exports;
  };
  const { ContinueCard } = load("src/components/continue-card.tsx");
  const root = createRoot(document.querySelector("#app")!);
  const item = {
    _id: "older-b",
    type: "series",
    name: "Older B",
    state: { season: 2, episode: 3, video_id: "older-b:2:3", duration: 600000, timeOffset: 90000 },
  };
  const render = async () =>
    React.act(() =>
      root.render(
        jsx.jsx(ContinueCard, {
          item,
          onDismiss: (entry: any) => {
            removed.push(entry);
          },
        }),
      ),
    );
  return {
    starts,
    removed,
    item,
    render,
    get target() {
      return target;
    },
    set profile(value: string) {
      profile = value;
    },
    async context(selector: string) {
      await React.act(() =>
        document
          .querySelector(selector)!
          .dispatchEvent(
            new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
          ),
      );
    },
    async click(selector: string) {
      await React.act(async () => {
        document
          .querySelector(selector)!
          .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });
    },
    async dispose() {
      await React.act(() => root.unmount());
      dom.window.close();
    },
  };
}

test("real ContinueCard poster, title and play controls resolve the older entry and reuse primary continuation instead of the body source picker", async () => {
  const h = harness();
  try {
    await h.render();
    await h.click("button[title='Choose another source']");
    assert.deepEqual(h.starts[0].mode, { autoPlay: false, resume: false });
    for (const selector of [
      "button[title='Choose another source']",
      "button[aria-label='Open details: Older B']",
      "button[title='Play']",
    ]) {
      await h.context(selector);
      assert.equal(h.target.meta.id, "older-b");
      assert.equal(h.target.primary.actions()[0].label, "Continue watching");
      await React.act(() => h.target.primary.actions()[0].run());
      const request = h.starts.at(-1);
      assert.equal(request.meta.id, "older-b");
      assert.deepEqual(request.episode, { season: 2, episode: 3 });
      assert.deepEqual(request.mode, { autoPlay: true, resume: true });
    }
    await h.click("button[title='Play']");
    assert.deepEqual(h.starts.at(-1).mode, { autoPlay: true, resume: true });
    await React.act(() => h.target.extra.actions()[0].run());
    assert.equal(h.removed[0], h.item);
    assert.equal(h.target.isValid(), false);
  } finally {
    await h.dispose();
  }
});

test("an open older-card menu cannot execute after a profile change", async () => {
  const h = harness();
  try {
    await h.render();
    await h.context("button[title='Play']");
    const target = h.target;
    h.profile = "fixture-b";
    await h.render();
    assert.equal(target.isValid(), false);
    await assert.rejects(target.primary.actions()[0].run(), /no longer available/);
    await assert.rejects(target.extra.actions()[0].run(), /no longer available/);
    assert.equal(h.starts.length, 0);
    assert.equal(h.removed.length, 0);
  } finally {
    await h.dispose();
  }
});

test("original removal invalidates an already-open card menu and matches removal from a separate equivalent fixture", async () => {
  const original = harness();
  let directItem: unknown;
  try {
    await original.render();
    await original.context("button[title='Play']");
    const openMenu = original.target;
    await original.click("button[aria-label='Remove from Continue Watching']");
    directItem = original.removed[0];
    assert.equal(openMenu.isValid(), false);
    await assert.rejects(openMenu.primary.actions()[0].run(), /no longer available/);
    await assert.rejects(openMenu.extra.actions()[0].run(), /no longer available/);
    assert.equal(original.removed.length, 1);
    assert.equal(original.starts.length, 0);
  } finally {
    await original.dispose();
  }
  const contextual = harness();
  try {
    await contextual.render();
    await contextual.context("button[title='Play']");
    await React.act(() => contextual.target.extra.actions()[0].run());
    assert.deepEqual(contextual.removed, [directItem]);
  } finally {
    await contextual.dispose();
  }
});
