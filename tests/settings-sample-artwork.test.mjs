import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function fixture({ delayed = new Set() } = {}) {
  const pending = new Map();
  class Image {
    set src(value) {
      this.url = value;
      const finish = () => {
        // The catalog host's redirect does not permit CORS image requests.
        if (value.startsWith("https://images.metahub.space/")) this.onerror?.();
        else this.onload?.();
      };
      if (delayed.has(value)) pending.set(value, finish);
      else queueMicrotask(finish);
    }
  }
  const document = {
    createElement: () => ({
      getContext: () => {
        let image;
        return {
          drawImage: (value) => { image = value; },
          getImageData: () => ({
            data: new Uint8ClampedArray(32 * 32 * 4).fill(image.url.includes("placeholder") ? 0 : 160),
          }),
        };
      },
    }),
  };
  const source = readFileSync(new URL("../src/lib/sample-artwork.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(`${source}\nexport const audit = { hasPosterArtwork, previewPicks };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("require", "exports", "Image", "document", code)(() => ({}), exports, Image, document);
  return { ...exports.audit, pending };
}

const poster = (id) => `https://images.metahub.space/poster/small/${id}/img`;
const item = (id, extras = {}) => ({
  id, name: id, type: "series", poster: poster(id), background: `${id}-still`, imdbRating: "8.0", ...extras,
});

test("catalog poster inspection bypasses a non-CORS redirect without accepting title placeholders", async () => {
  const f = fixture();
  assert.equal(await f.hasPosterArtwork(poster("lanterns")), true);
  assert.equal(await f.hasPosterArtwork(poster("placeholder")), false);
});

test("a usable catalog batch reaches previews before later poster probes finish", async () => {
  const late = "https://live.metahub.space/poster/small/late/img";
  const f = fixture({ delayed: new Set([late]) });
  const batches = [];
  let complete = false;
  const work = f.previewPicks([
    item("unrated", { imdbRating: "" }),
    item("adult", { adult: true }),
    ...["a", "b", "c", "d", "late"].map((id) => item(id)),
  ], (picks) => batches.push(picks)).then((picks) => { complete = true; return picks; });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(complete, false);
  assert.deepEqual(batches[0].map((pick) => pick.id), ["a", "b", "c", "d"]);
  assert.equal(batches[0][0].poster, poster("a"));
  f.pending.get(late)();
  assert.deepEqual((await work).map((pick) => pick.id), ["a", "b", "c", "d", "late"]);
  assert.equal(batches[0].length, 4, "published snapshots must not mutate as later batches arrive");
});
