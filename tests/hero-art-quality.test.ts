import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile(
  "hero.tsx",
  readFileSync("src/components/hero.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const helper = source.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "upsizeTmdb",
);
assert.ok(helper);
const js = ts.transpileModule(helper.getText(source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function heroImage(height: number, pixelRatio: number) {
  return new Function("window", `${js}; return upsizeTmdb;`)(
    { screen: { height }, devicePixelRatio: pixelRatio },
  ) as (url?: string, full?: boolean) => string | undefined;
}

test("explicit full hero quality requests original art on ordinary and high-density displays", () => {
  for (const [height, ratio] of [[768, 1], [1080, 1], [1080, 1.25], [1080, 2], [2160, 1]]) {
    const image = heroImage(height, ratio);
    assert.equal(image("https://image.tmdb.org/t/p/w780/hero.jpg", true),
      "https://image.tmdb.org/t/p/original/hero.jpg", `${height}px at ${ratio}x`);
  }
});

test("turning full quality off restores the optimized hero image", () => {
  const image = heroImage(2160, 2);
  assert.equal(image("https://image.tmdb.org/t/p/original/hero.jpg", false),
    "https://image.tmdb.org/t/p/w1280/hero.jpg");
  assert.equal(image("https://image.tmdb.org/t/p/w780/hero.jpg"),
    "https://image.tmdb.org/t/p/w1280/hero.jpg");
});

test("missing artwork and other providers are preserved", () => {
  const image = heroImage(1080, 1);
  assert.equal(image(undefined, true), undefined);
  const remote = "https://example.com/artwork/hero.jpg";
  assert.equal(image(remote, true), remote);
  assert.equal(image(remote, false), remote);
});
