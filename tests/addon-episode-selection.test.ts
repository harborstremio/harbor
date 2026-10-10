// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
import type { Meta } from "../src/lib/cinemeta.ts";
import { buildStreamIds } from "../src/lib/streams/stream-ids.ts";
import * as groups from "../src/views/detail/episode-groups.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const compile = (source: string) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Exercise the actual picker input's embedded-file selection as well as the request IDs.
const inputPath = "src/lib/streams/episode-pipeline-input.ts";
const inputSource = ts.createSourceFile(inputPath, read(inputPath), ts.ScriptTarget.Latest, true);
const embeddedFn = inputSource.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "embeddedStreams");
assert.ok(embeddedFn);
const embeddedStreams = new Function(`${compile(embeddedFn!.getText(inputSource))}; return embeddedStreams;`)();

function harness(layout: "list" | "grid" | "strip", videos: NonNullable<Meta["videos"]>) {
  const picked: any[] = [];
  const meta: Meta = { id: "fixture:library:pack", type: "series", name: "Library files", videos,
    addonOrigin: { id: "fixture.addon", name: "Fixture addon" } };
  const mocks: Record<string, any> = {
    "react/jsx-runtime": jsx,
    react: { useMemo: (fn: any) => fn(), useEffect() {}, useRef: (current: any) => ({ current }),
      useState: (initial: any) => [typeof initial === "function" ? initial() : initial, () => {}], useSyncExternalStore: () => 0 },
    "react-dom": { createPortal() {} },
    "lucide-react": { Check: "Check", ChevronDown: "ChevronDown" },
    "@/components/icons/play-filled": { Play: "Play" },
    "@/components/episode-watched-menu": { EpisodeWatchedMenu: "EpisodeWatchedMenu" },
    "@/lib/manual-watched": { manualEpisodeKeys: () => ({ watched: [], unwatched: [] }), manualWatchedState: () => undefined },
    "@/components/poster": { Poster: "Poster" },
    "@/lib/settings": { useSettings: () => ({ settings: { episodeLayout: layout, instantPlay: false }, update() {} }) },
    "@/lib/local-library/use-series-play": { useLocalAwareSeriesPlay: () => (input: any) => picked.push(input) },
    "@/lib/i18n": { useT: () => (key: string) => key },
    "./episode-download-button": { EpisodeDownloadButton: "EpisodeDownloadButton" },
    "@/lib/episode-progress": { resumeDefaultSeason: (_id: any, stats: any) => stats[0]?.seasonNumber ?? 0 },
    "@/components/drag-strip": { DragStrip: "DragStrip" },
    "./episode-grid": { EpisodeGrid: "EpisodeGrid" },
    "./episode-grid-card": { EpisodeGridCard: "EpisodeGridCard" },
    "./episode-layout-toggle": { EpisodeLayoutToggle: "EpisodeLayoutToggle" },
    "./helpers": { isUpcomingDate: () => false },
    "./season-stepper": { SeasonStepper: "SeasonStepper" },
    "./use-episode-auto-scroll": { useEpisodeAutoScroll: () => () => {} },
    "./episode-groups": groups,
  };
  const exports: Record<string, any> = {};
  new Function("require", "exports", compile(read("src/views/detail/cinemeta-episodes.tsx")))((id: string) => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected import: ${id}`);
    return mocks[id];
  }, exports);
  const tree = exports.CinemetaEpisodes({ meta, videos });
  function nodes(node: any): any[] {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== "object") return [];
    return [node, ...nodes(node.props?.children)];
  }
  return { meta, play(index: number) {
    const all = nodes(tree);
    if (layout === "grid") all.find((n) => n.type === "EpisodeGrid").props.episodes[index].play({ resume: false });
    else if (layout === "strip") all.filter((n) => n.type === "EpisodeGridCard")[index].props.g.play({ resume: false });
    else {
      const row = all.filter((n) => n.type === exports.CinemetaEpisodeRow)[index];
      nodes(exports.CinemetaEpisodeRow(row.props)).find((n) => n.type === "button").props.onClick();
    }
    return picked.at(-1);
  } };
}

for (const layout of ["list", "grid", "strip"] as const) {
  test(`${layout} selects the exact addon file when episode numbers coincide`, () => {
    const videos = ["standard", "extended"].map((edition) => ({
      id: `fixture:file:${edition}`, season: 1, episode: 1, title: edition,
      streams: [{ url: `fixture://${edition}.mkv` }],
    }));
    const h = harness(layout, videos);
    const { episode } = h.play(1);
    assert.equal(buildStreamIds(h.meta.id, episode, null)[0], videos[1].id);
    assert.equal(embeddedStreams(h.meta, episode)[0]?.url, "fixture://extended.mkv");
    assert.equal(episode.name, "extended");
  });

  test(`${layout} can select an unnumbered addon file`, () => {
    const videos = ["intro", "bonus"].map((name) => ({
      id: `fixture:file:${name}`, name, streams: [{ url: `fixture://${name}.mkv` }],
    }));
    const h = harness(layout, videos);
    const { episode } = h.play(1);
    assert.equal(buildStreamIds(h.meta.id, episode, null)[0], videos[1].id);
    assert.equal(embeddedStreams(h.meta, episode)[0]?.url, "fixture://bonus.mkv");
  });
}

test("episodes without a provider ID keep their numeric stream fallback", () => {
  const h = harness("grid", [{ season: 2, episode: 4, name: "Episode four" }]);
  const { episode } = h.play(0);
  assert.equal(episode.videoId, undefined);
  assert.equal(buildStreamIds("tt1234567", episode, "tt1234567")[0], "tt1234567:2:4");
});
