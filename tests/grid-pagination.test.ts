import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const meta = (id: number) => ({ id: String(id), name: `Title ${id}`, type: "movie" });
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

function fixture(grid: any) {
  const slots: any[] = [], effects: (() => void)[] = [];
  let slot = 0, tree: any, observer: any;
  const jsx = (type: any, props: any) => {
    if (props?.ref) props.ref.current = {};
    return { type, props };
  };
  const same = (a?: any[], b?: any[]) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  class Observer {
    active = true;
    callback: (entries: any[]) => void;
    constructor(callback: (entries: any[]) => void) { this.callback = callback; observer = this; }
    observe() {}
    disconnect() { this.active = false; }
  }
  const mocks: Record<string, any> = {
    react: {
      useRef: (value: any) => { const i = slot++; return slots[i] ??= { current: value }; },
      useState: (value: any) => {
        const i = slot++;
        if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value;
        return [slots[i], (next: any) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }];
      },
      useEffect: (run: () => any, deps: any[]) => {
        const i = slot++;
        if (!same(slots[i]?.deps, deps)) effects.push(() => {
          slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: run() };
        });
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "lucide-react": { ArrowLeft: "arrow" },
    "@/components/back-to-top": { BackToTop: "back-top" },
    "@/components/pick-card": { PickCard: "card" },
    "@/components/row": { TV_CARD_MIN: 250 },
    "@/lib/i18n": { useT: () => (s: string) => s },
    "@/lib/theme": { layoutHasGlobalBack: () => false },
    "@/lib/settings": { useSettings: () => ({ settings: {} }) },
    "@/lib/view": { useView: () => ({ goBack() {} }), useScrollMemory() {} },
  };
  const source = readFileSync(process.env.GRID_TEST_SOURCE ?? "src/views/grid.tsx", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: Record<string, any> = {};
  new Function("require", "exports", "IntersectionObserver", code)((id: string) => {
    assert.ok(id in mocks, `Unexpected import: ${id}`); return mocks[id];
  }, exports, Observer);
  const render = () => {
    slot = 0; tree = exports.GridView({ grid }); effects.splice(0).forEach(run => run());
  };
  const cards = () => {
    const ids: string[] = [];
    const visit = (node: any) => {
      if (Array.isArray(node)) node.forEach(visit);
      else if (node?.props) {
        if (node.type === "card") ids.push(node.props.meta.id);
        visit(node.props.children);
      }
    };
    visit(tree); return ids;
  };
  render();
  return { render, cards, active: () => observer?.active ?? false,
    intersect: () => { if (observer?.active) observer.callback([{ isIntersecting: true }]); },
    async next() { this.intersect(); await settle(); render(); },
  };
}

test("capped row seeds stay visible while View all fills gaps in complete pages", async () => {
  const calls: number[][] = [];
  const h = fixture({ initial: [meta(1), meta(3)], initialPage: 0,
    fetcher: async (page: number, loaded: number) => {
      calls.push([page, loaded]);
      return page === 1 ? [meta(1), meta(2)] : page === 2 ? [meta(3), meta(4)] : [];
    } });
  assert.deepEqual(h.cards(), ["1", "3"]);
  await h.next(); await h.next(); await h.next();
  assert.deepEqual(calls, [[1, 0], [2, 2], [3, 4]]);
  assert.deepEqual(h.cards(), ["1", "3", "2", "4"]);
  assert.equal(h.active(), false);
});

test("overlapping batches advance raw provider offsets and do not end the grid", async () => {
  const calls: number[][] = [];
  const h = fixture({ initial: [meta(1)], fetcher: async (page: number, loaded: number) => {
    calls.push([page, loaded]);
    return page === 2 ? [meta(1), meta(1)] : page === 3 ? [meta(2), meta(2)] : [];
  } });
  await h.next(); await h.next(); await h.next();
  assert.deepEqual(calls, [[2, 1], [3, 3], [4, 5]]);
  assert.deepEqual(h.cards(), ["1", "2"]);
  assert.equal(h.active(), false);
});

test("the final allowed page is displayed before pagination stops", async () => {
  const calls: number[] = [];
  const h = fixture({ initial: [meta(1)], initialPage: 39,
    fetcher: async (page: number) => { calls.push(page); return [meta(2)]; } });
  await h.next(); await h.next();
  assert.deepEqual(calls, [40]);
  assert.deepEqual(h.cards(), ["1", "2"]);
  assert.equal(h.active(), false);
});

test("a provider repeating the same nonempty page is bounded", async () => {
  let calls = 0;
  const h = fixture({ fetcher: async () => { calls++; return [meta(1)]; } });
  for (let i = 0; i < 45; i++) await h.next();
  assert.equal(calls, 40);
  assert.deepEqual(h.cards(), ["1"]);
  assert.equal(h.active(), false);
});

test("in-flight intersections do not start concurrent requests", async () => {
  let calls = 0, resolve!: (value: any[]) => void;
  const h = fixture({ fetcher: () => { calls++; return new Promise(r => { resolve = r; }); } });
  h.intersect(); h.intersect(); h.intersect();
  assert.equal(calls, 1);
  resolve([meta(1)]); await settle(); h.render();
  assert.deepEqual(h.cards(), ["1"]);
});

test("failed pages stop without discarding the initial row", async () => {
  const h = fixture({ initial: [meta(1)], fetcher: async () => { throw new Error("fixture offline"); } });
  await h.next();
  assert.deepEqual(h.cards(), ["1"]);
  assert.equal(h.active(), false);
});

for (const path of ["src/views/home/customizable-rows.tsx", "src/components/catalog/catalog-rows.tsx"]) {
  test(`${path}: both title and View all treat row items as preview seeds`, () => {
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
    const calls: ts.CallExpression[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "openGrid") calls.push(node);
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.equal(calls.length, 2);
    const row = { metas: [meta(1)], fetcher: async () => [], page: 3 };
    for (const call of calls) {
      const code = ts.transpileModule(`const spec = ${call.arguments[0].getText(source)};`, {}).outputText;
      const spec = new Function("row", "title", `${code};return spec;`)(row, "Fixture row");
      assert.equal(spec.initialPage, 0);
      assert.equal(spec.initial, row.metas);
      assert.equal(spec.fetcher, row.fetcher);
    }
  });
}
