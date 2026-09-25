import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
function load(file, mocks = {}, globals = {}) {
  const code = ts.transpileModule(read(file), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports = {};
  new Function("require", "exports", ...Object.keys(globals), code)(
    (name) => mocks[name] ?? {},
    exports,
    ...Object.values(globals),
  );
  return exports;
}
const nav = load("src/chrome/nav-items.tsx", {
  "@/lib/sports/enabled": { useSportsEnabled: () => false },
  "./navigation-policy": load("src/chrome/navigation-policy.ts"),
});
const cfg = () => ({ order: [], hidden: [], renamed: {} });

test("customization retains Music and the Sports availability gate", () => {
  assert.ok(nav.NAV_ITEMS.some((item) => item.id === "music"));
  assert.ok(nav.NAV_ITEMS.some((item) => item.id === "sports"));
  assert.ok(!nav.useAvailableNavItems().some((item) => item.id === "sports"));
});
test("hide and restore do not discard order or renamed labels", () => {
  const original = { order: ["music", "home"], hidden: [], renamed: { music: "My music" } };
  const hidden = nav.toggleNavHidden(original, "music");
  assert.ok(!nav.applyNavCustomization(nav.NAV_ITEMS, hidden).some((item) => item.id === "music"));
  const restored = nav.toggleNavHidden(hidden, "music");
  assert.deepEqual(restored, original);
  assert.equal(nav.applyNavCustomization(nav.NAV_ITEMS, restored)[0].label, "My music");
});
test("move preserves hidden and renamed items and only changes order", () => {
  const original = { ...cfg(), hidden: ["manga"], renamed: { music: "My music" } };
  const moved = nav.moveNavItem(original, "music", "home", "before");
  assert.equal(moved.order[0], "music");
  assert.deepEqual(moved.hidden, original.hidden);
  assert.deepEqual(moved.renamed, original.renamed);
  assert.equal(new Set(moved.order).size, nav.NAV_ITEMS.length);
});

function migrate(parsed) {
  const source = read("src/lib/settings/load.ts");
  const begin = source.indexOf("if (!parsed._navThemeRepairV1)");
  const end = source.indexOf("if (parsed.cwSources", begin);
  assert.ok(begin > 0 && end > begin);
  const code = ts.transpileModule(source.slice(begin, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("parsed", code)(parsed);
  return parsed;
}
test("settings repair no longer wipes saved hidden tabs", () => {
  const settings = migrate({ navCustomization: { ...cfg(), hidden: ["music", "calendar"] } });
  assert.deepEqual(settings.navCustomization.hidden, ["music", "calendar"]);
});
test("legacy Live TV and manga switches migrate once without duplicate hides", () => {
  const settings = migrate({
    hideContent: { liveTv: true, manga: true, adult: true, sports: true },
    navCustomization: { ...cfg(), hidden: ["manga", "music"] },
  });
  assert.deepEqual(settings.navCustomization.hidden, ["manga", "music", "live"]);
  assert.deepEqual(settings.hideContent, { adult: true, sports: true });
  settings.navCustomization.hidden = [];
  assert.deepEqual(migrate(settings).navCustomization.hidden, []);
});
test("edit mode publishes changes and restores the root marker on exit", () => {
  const document = { documentElement: { dataset: {} } };
  const api = load("src/chrome/nav-edit-mode.ts", {}, { document });
  api.setNavEditMode(true);
  assert.equal(document.documentElement.dataset.navEditing, "true");
  api.setNavEditMode(false);
  assert.equal(document.documentElement.dataset.navEditing, undefined);
});

const layouts = [
  "sidebar",
  "siderail",
  "nord-sidebar",
  "dracula-sidebar",
  "forest-sidebar",
  "stremio-rail",
  "topdock",
  "royal-topbar",
  "cinematic-overlay",
  "minui-dock",
];
for (const name of layouts) {
  test(`${name} retains available navigation, keyboard menus, and checked activation`, () => {
    const source = read(`src/chrome/${name}.tsx`);
    if (name === "sidebar") {
      assert.match(source, /useSidebarNavigation\(\)/);
      const shared = read("src/chrome/context-page-navigation.tsx");
      assert.match(shared, /const items = useAvailableNavItems\(\)/);
      assert.match(shared, /resolveSidebarNavigation\(items, customization, policy\)/);
    } else assert.match(source, /useAvailableNavItems\(\)/);
    assert.match(source, /onKeyDown=\{drag.onKeyDown\}/);
    assert.match(source, /onOpen: (?:onClick|\(\) => navigate\(item\))/);
    const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node, inButton = false) {
      if (ts.isJsxElement(node)) {
        const tag = node.openingElement.tagName.getText(ast);
        assert.ok(!(inButton && tag === "button"), "buttons must not nest");
        node.forEachChild((child) => visit(child, inButton || tag === "button"));
      } else {
        if (inButton && ts.isJsxSelfClosingElement(node))
          assert.notEqual(node.tagName.getText(ast), "NavHideBadge");
        node.forEachChild((child) => visit(child, inButton));
      }
    }
    visit(ast);
  });
}
test("nav menu invokes the supplied checked action rather than navigating directly", () => {
  const source = read("src/components/context-menu.tsx");
  const begin = source.indexOf('key="nav-open"');
  const block = source.slice(begin, source.indexOf('key="nav-hide"', begin));
  assert.match(block, /target.onOpen\?\.\(\)/);
  assert.doesNotMatch(block, /setView\(/);
  assert.match(source, /<MenuSurface[\s\S]*?onClose=\{close\}/);
  const surface = read("src/components/context-menu/menu-surface.tsx");
  assert.match(surface, /useMenuFocus\(ref, reveal != null\)/);
  assert.match(surface, /new ResizeObserver\(measure\)/);
  assert.match(surface, /fitMenu\(point, bounds/);
});
test("drag cleanup, reduced motion, and RTL handling are present", () => {
  const source = read("src/chrome/nav-edit.tsx");
  assert.match(source, /cleanupDrag.current\?\.\(\)/);
  assert.match(source, /g.inert = true/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /direction === "rtl"/);
  assert.match(source, /e.key === "ContextMenu"/);
});
