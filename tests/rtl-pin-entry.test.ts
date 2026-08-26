// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (p: string) => new URL(`../${p}`, import.meta.url);
const read = (p: string) => readFileSync(at(p), "utf8");
const KEYPADS = [
  "src/components/parental-pin-modal.tsx",
  "src/components/profile-picker/pin-entry.tsx",
];

test("Arabic really does flip the document, so PIN order is at risk", () => {
  assert.match(read("src/lib/i18n/store.ts"), /root\.dir = isRtl\(lang\) \? "rtl" : "ltr";/);
  assert.match(read("src/lib/i18n/languages.ts"), /code: "ar",[^\n]*rtl: true/);
});

test("every numeric keypad stays left to right", () => {
  for (const p of KEYPADS) {
    const src = read(p);
    assert.match(
      src,
      /<div dir="ltr" className="grid grid-cols-3 gap-2\.5 pt-1">/,
      `${p} keypad would render 3,2,1 in Arabic`,
    );
    assert.match(
      src,
      /aria-label=\{t\("Focus PIN entry"\)\}\s*\n\s*dir="ltr"/,
      `${p} PIN field would fill right to left in Arabic`,
    );
  }
});

test("these are still the only numeric keypads in the app", () => {
  const found: string[] = [];
  const sourceRoot = decodeURIComponent(at("src/").pathname);
  const walk = (dir: URL) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(new URL(`${e.name}/`, dir));
      else if (e.name.endsWith(".tsx")) {
        const rel = `src/${decodeURIComponent(new URL(e.name, dir).pathname).slice(sourceRoot.length)}`;
        if (read(rel).includes('"1", "2", "3", "4", "5", "6", "7", "8", "9"')) found.push(rel);
      }
    }
  };
  walk(at("src/"));
  assert.deepEqual(found.sort(), [...KEYPADS].sort());
});
