// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const nav = read("src/views/settings/nav.tsx");
const settings = read("src/views/settings.tsx");
const TRACKERS = ["trakt", "simkl", "anilist", "mal", "letterboxd"];

function trackerOptions(): Array<{ label: string; tab: string | null }> {
  const start = nav.indexOf("const SETTINGS_OPTIONS");
  const open = nav.indexOf("= [", start) + 2;
  const out: Array<{ label: string; tab: string | null }> = [];
  let depth = 0;
  let from = 0;
  for (let i = open; i < nav.length; i += 1) {
    const c = nav[i];
    if (c === "{") {
      if (depth === 0) from = i;
      depth += 1;
    } else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        const body = nav.slice(from, i + 1);
        if (/section:\s*"trackers"/.test(body)) {
          const label = /label:\s*"([^"]*)"/.exec(body);
          const tab = /\n\s*tab:\s*"([^"]*)"/.exec(body);
          out.push({ label: label ? label[1] : "?", tab: tab ? tab[1] : null });
        }
      }
    } else if (c === "]" && depth === 0) break;
  }
  return out;
}

test("every tracker search result names the tracker it opens", () => {
  const options = trackerOptions();
  assert.ok(options.length > 50, `expected the full tracker index, saw ${options.length}`);
  const untabbed = options.filter((option) => option.tab == null).map((option) => option.label);
  assert.deepEqual(
    untabbed,
    [],
    "an option with no tab lands on whatever tracker the panel opens by default, which is Trakt",
  );
  const wrong = options
    .filter((option) => !TRACKERS.includes(option.tab as string))
    .map((option) => `${option.label} -> ${option.tab}`);
  assert.deepEqual(wrong, [], "every tab must be a real tracker id");
});

test("the Simkl results open Simkl rather than Trakt", () => {
  const simkl = trackerOptions().filter((option) => /simkl/i.test(option.label));
  assert.ok(simkl.length >= 6, `expected the Simkl block, saw ${simkl.length}`);
  for (const option of simkl)
    assert.equal(option.tab, "simkl", `"${option.label}" must open the Simkl tab`);
});

test("a jump to a tracker id opens the Trackers panel on that tab", () => {
  // The five trackers have nav ids but no panel of their own, so navigating to one
  // without the remap sets a section nothing renders and the page goes blank.
  assert.match(settings, /const isTracker = \(TRACKER_IDS as string\[\]\)\.includes\(id\);/);
  assert.match(settings, /const target = isTracker \? \("trackers" as SectionId\) : id;/);
  assert.match(settings, /const wantTab = isTracker \? \(tab \?\? id\) : tab;/);
  assert.match(settings, /setActive\(target\);/);
  for (const id of TRACKERS)
    assert.doesNotMatch(
      settings,
      new RegExp(`active === "${id}" &&`),
      `${id} is a tab of the Trackers panel, not a section with its own renderer`,
    );
});

test("pressing Enter in settings search keeps the tab the result asked for", () => {
  assert.match(
    nav,
    /onSubmit\(o\.section, o\.anchorTitle \? settingsAnchor\(o\.anchorTitle\) : undefined, o\.tab\);/,
    "dropping o.tab sends every tabbed result to the section's default tab",
  );
  assert.match(nav, /onSubmit: \(id: SectionId, anchor\?: string, tab\?: string\) => void;/);
});
