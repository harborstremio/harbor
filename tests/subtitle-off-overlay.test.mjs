import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/views/player/stage-overlays.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const module = { exports: {} };
const jsx = (type, props) => ({ type, props });
let popoutOpen = false;
new Function("require", "module", "exports", compiled)(
  (id) => {
    if (id === "react") return { memo: (component) => component };
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    if (id === "@/lib/i18n") return { useT: () => (text) => text };
    if (id === "@/lib/player/captions-popout-state")
      return { useCaptionsPopoutOpen: () => popoutOpen };
    if (id.startsWith("@/components/player/")) {
      return new Proxy({}, { get: (_, name) => name });
    }
    throw new Error(`Unexpected dependency: ${id}`);
  },
  module,
  module.exports,
);

for (const engine of ["mpv", "html5"]) {
  for (const selected of [false, true]) {
    test(`${engine} overlay gates stale primary text on confirmed selection (${selected})`, () => {
      const tree = module.exports.StageOverlays({
        engine,
        snap: {
          subText: "Stale or current primary cue",
          subStartSec: 12,
          secondarySubText: "Independent secondary cue",
          subtitleTracks: [{ id: "1", selected }],
        },
        pipMode: false,
        subAssNative: false,
        volumeIndicator: { visible: false },
        contentAdvisory: { categories: [] },
      });
      const overlay = tree.props.children.find((child) => child?.type === "SubtitleOverlay");
      assert.equal(overlay.props.text, selected ? "Stale or current primary cue" : "");
      assert.equal(overlay.props.startSec, selected ? 12 : 0);
      assert.equal(overlay.props.secondaryText, "Independent secondary cue");
    });
  }
}

test("opening the subtitle pop-out hides the duplicate player overlay", () => {
  popoutOpen = true;
  try {
    const tree = module.exports.StageOverlays({
      snap: { subtitleTracks: [{ selected: true }], subText: "Cue" },
      volumeIndicator: { visible: false },
      contentAdvisory: { categories: [] },
    });
    assert.equal(
      tree.props.children.some((child) => child?.type === "SubtitleOverlay"),
      false,
    );
  } finally {
    popoutOpen = false;
  }
});
