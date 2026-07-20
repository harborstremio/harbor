// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  dependencies?: Record<string, string>;
};
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const rowSource = readFileSync(new URL("../src/components/row.tsx", import.meta.url), "utf8");
const queryIndex = readFileSync(new URL("../src/lib/query/index.ts", import.meta.url), "utf8");
const routerIndex = readFileSync(new URL("../src/router/index.ts", import.meta.url), "utf8");

test("tanstack packages are installed", () => {
  assert.ok(pkg.dependencies?.["@tanstack/react-query"]);
  assert.ok(pkg.dependencies?.["@tanstack/react-router"]);
  assert.ok(pkg.dependencies?.["@tanstack/react-virtual"]);
});

test("app mounts query + router providers", () => {
  assert.match(appSource, /HarborQueryProvider/);
  assert.match(appSource, /HarborRouterProvider/);
  assert.match(appSource, /ViewRouterSync/);
});

test("poster rows use native grid scroll, not horizontal virtualization", () => {
  // Horizontal virtualization mis-positioned posters; keep LazyChild rails.
  assert.doesNotMatch(rowSource, /useVirtualizer/);
  assert.match(rowSource, /LazyChild/);
  assert.match(rowSource, /grid-flow-col/);
});

test("virtual grid still uses tanstack virtual for tall grids", () => {
  const gridSource = readFileSync(
    new URL("../src/components/virtual-grid.tsx", import.meta.url),
    "utf8",
  );
  assert.match(gridSource, /@tanstack\/react-virtual/);
  assert.match(gridSource, /useVirtualizer/);
});

test("query and router modules export public API", () => {
  assert.match(queryIndex, /HarborQueryProvider/);
  assert.match(queryIndex, /queryKeys/);
  assert.match(routerIndex, /HarborRouterProvider/);
  assert.match(routerIndex, /ViewRouterSync/);
  assert.match(routerIndex, /pathFromView/);
});
