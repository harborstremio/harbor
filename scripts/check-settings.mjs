import fs from "node:fs";
import path from "node:path";
import { settingsSearchEntries } from "./settings-search-entries.mjs";

const ROOT = path.resolve(process.argv[2] ?? ".");
const SRC = path.join(ROOT, "src");
const SETTINGS = path.join(SRC, "views", "settings");

const read = (f) => fs.readFileSync(f, "utf8").split("\r\n").join("\n");
const rel = (f) => path.relative(SRC, f).split(path.sep).join("/");

function tree(dir, ext = ".tsx") {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") out.push(...tree(p, ext)); }
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const allTsx = tree(SRC);
const allSrc = allTsx.concat(tree(SRC, ".ts"));
const settingsTsx = tree(SETTINGS).concat(tree(path.join(SRC, "views", "account")));
const settingsSrc = settingsTsx.concat(tree(SETTINGS, ".ts"));
const css = read(path.join(SRC, "index.css"));

const findings = [];
const report = (check, items, detail) => {
  findings.push({ check, count: items.length, items, detail });
};

const CHROME_TOP = 140;

function overlays() {
  const out = [];
  for (const f of allTsx) {
    const src = read(f);
    const lines = src.split("\n");
    lines.forEach((ln, i) => {
      const m = ln.match(/fixed inset-0[^"`]*?z-\[?(\d+)\]?/);
      if (!m) return;
      const near = lines.slice(Math.max(0, i - 8), i + 14).join(" ");
      const scrim = /bg-canvas\/|bg-black\/|backdrop-blur|animate-scrim/.test(near);
      const declares = /aria-modal|role="dialog"/.test(near);
      if (!scrim && !declares) return;
      out.push({ file: f, src, rel: rel(f), line: i + 1, z: Number(m[1]) });
    });
  }
  return out;
}

const dialogs = overlays().filter((d) => !d.rel.startsWith("views/mobile/"));

report(
  "dialogs rendered without a portal",
  dialogs.filter((d) => d.z >= 100 && !/createPortal/.test(d.src)).map((d) => d.rel + ":" + d.line),
  "an ancestor with overflow-hidden, a transform or contain will clip them whatever their z-index says",
);

report(
  "dialogs drawn under the title bar",
  dialogs
    .filter(
      (d) =>
        d.z > 0 &&
        d.z <= CHROME_TOP &&
        !d.rel.startsWith("views/manga/") &&
        !d.rel.startsWith("chrome/") &&
        !d.rel.includes("player") &&
        !/onboarding|remote-app|together-deploy/.test(d.rel),
    )
    .map((d) => d.rel + ":" + d.line + " (z-" + d.z + ")"),
  "the hybrid title bar is z-[" + CHROME_TOP + "] and 36px tall, so it clips the top of anything at or below it",
);

report(
  "dialogs with no way out",
  dialogs
    .filter((d) => !/onboarding/.test(d.rel))
    .filter((d) => {
      const esc = /useEscape|ModalShell|SettingsModal|"Escape"|'Escape'/.test(d.src);
      const backdrop = /e\.target === e\.currentTarget|aria-label=\{?t?\(?"?Close/i.test(d.src);
      const closer = /onClose\b|onDone\b|onDismiss\b/.test(d.src);
      return !esc && !backdrop && !closer;
    })
    .map((d) => d.rel + ":" + d.line),
  "no Escape, no backdrop dismiss and no close handler",
);

function keyframes() {
  const out = [];
  const re = /@keyframes\s+([A-Za-z0-9_-]+)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1, i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    out.push({ name: m[1], body: css.slice(re.lastIndex, i - 1) });
  }
  return out;
}

const frames = keyframes();
const dupNames = frames.map((f) => f.name).filter((n, i, a) => a.indexOf(n) !== i);
report(
  "keyframes defined more than once",
  [...new Set(dupNames)],
  "the later definition silently wins, so the animation is not the one the source appears to describe",
);

const IDENTITY = /^(translate[XYZ]?\((?:0|0px|0%)(?:,\s*(?:0|0px|0%))*\)|translate3d\(\s*0[a-z%]*\s*,\s*0[a-z%]*\s*,\s*0[a-z%]*\s*\)|scale[XY]?\(\s*1(?:\s*,\s*1)?\s*\)|rotate\(\s*(?:0|360)deg\s*\))$/;
const isIdentity = (v) => {
  const parts = v.trim().split(/\s+(?=[a-z])/).filter(Boolean);
  return parts.length > 0 && parts.every((p) => IDENTITY.test(p.trim()));
};

const held = new Set();
for (const m of css.matchAll(/animation:[^;]*?([A-Za-z0-9_-]+)\s+[^;]*?\b(both|forwards)\b/g)) held.add(m[1]);
for (const f of allSrc) {
  for (const m of read(f).matchAll(/animation: "([A-Za-z0-9_-]+)[^"]*\b(both|forwards)\b/g)) held.add(m[1]);
}

const pinned = [];
for (const b of frames) {
  if (!held.has(b.name)) continue;
  const stops = [...b.body.matchAll(/([0-9.]+%|from|to)\s*\{([^}]*)\}/g)];
  if (!stops.length) continue;
  const order = (a) => (a === "from" ? 0 : a === "to" ? 100 : parseFloat(a));
  const last = stops.reduce((acc, s) => (order(s[1]) >= order(acc[1]) ? s : acc), stops[0]);
  const tm = /transform:\s*([^;}]+)/.exec(last[2]);
  if (tm && isIdentity(tm[1])) pinned.push(b.name + " ends on " + tm[1].trim());
}
report(
  "keyframes pinning an identity transform",
  pinned,
  "fill-mode both/forwards holds that transform forever, making the element a containing block that traps every fixed descendant",
);

const named = frames.map((f) => f.name);
const everything = allSrc.map(read).join("\n") + css;
report(
  "keyframes nothing references",
  named.filter((n) => everything.split(n).length - 1 <= 1),
  "dead animation code",
);

const typesFile = path.join(SRC, "lib", "settings", "types.ts");
const types = read(typesFile);
const tStart = types.indexOf("export type Settings");
let d = 0, tEnd = tStart;
for (let k = types.indexOf("{", tStart); k < types.length; k++) {
  if (types[k] === "{") d++;
  else if (types[k] === "}") { d--; if (!d) { tEnd = k; break; } }
}
const keys = [...types.slice(tStart, tEnd).matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9_]*)\??:/gm)].map((m) => m[1]);
const defaults = read(path.join(SRC, "lib", "settings", "defaults.ts"));
const hasDefault = new Set([...defaults.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9_]*):/gm)].map((m) => m[1]));

report(
  "settings keys with no default",
  keys.filter((k) => !hasDefault.has(k)),
  "undefined at runtime, so the control that reads it renders wrong",
);

const uiSrc = settingsTsx.map(read).join("\n");
const consumerSrc = allSrc
  .filter((f) => !rel(f).startsWith("views/settings") && !rel(f).startsWith("views/account") && !rel(f).startsWith("lib/settings/"))
  .map(read)
  .join("\n")
  + tree(path.join(ROOT, "src-tauri", "src"), ".rs").map(read).join("\n");

const writes = (k) =>
  new RegExp("[{,]\\s*" + k + "\\s*[:,}]").test(uiSrc) || new RegExp('["\'`]' + k + '["\'`]').test(uiSrc);
const reads = (k) =>
  new RegExp("\\.\\s*" + k + "\\b").test(consumerSrc) ||
  new RegExp("[{,]\\s*" + k + "\\s*[,}=:]").test(consumerSrc) ||
  new RegExp('["\'`]' + k + '["\'`]').test(consumerSrc);

report(
  "controls that change nothing",
  keys.filter((k) => writes(k) && !reads(k)),
  "a settings control writes the key and nothing outside settings ever reads it; keys read only to drive the settings UI itself will show here too",
);

const nav = read(path.join(SETTINGS, "nav.tsx"));
const headings = new Set();
for (const f of settingsSrc) {
  const s = read(f);
  for (const m of s.matchAll(/title=\{t\("([^"]+)"\)\}/g)) headings.add(m[1]);
  for (const m of s.matchAll(/label=\{t\("([^"]+)"\)\}/g)) headings.add(m[1]);
  for (const m of s.matchAll(/title=\{?"([^"]+)"\}?/g)) headings.add(m[1]);
  for (const m of s.matchAll(/(?:title|label|scope|group):\s*"([^"]+)"/g)) headings.add(m[1]);
  for (const m of s.matchAll(/(?:TITLE|LABEL)\s*=\s*"([^"]+)"/g)) headings.add(m[1]);
  for (const m of s.matchAll(/settingsAnchor\("([^"]+)"\)/g)) headings.add(m[1]);
}
const entries = settingsSearchEntries(nav);

report(
  "search entries pointing at a heading that does not exist",
  entries.filter((e) => e.anchor && !headings.has(e.anchor)).map((e) => e.label + " -> " + e.anchor),
  "the search result opens the page and then scrolls nowhere",
);

const seen = new Map();
for (const e of entries) {
  const k = e.label + "|" + e.section + "|" + (e.anchor ?? "");
  seen.set(k, (seen.get(k) ?? 0) + 1);
}
report(
  "duplicate search entries",
  [...seen].filter(([, n]) => n > 1).map(([k]) => k.split("|")[0]),
  "the same row appears twice in search results",
);

const shell = read(path.join(SRC, "views", "settings.tsx"));
const pages = [...shell.matchAll(/^\s*([a-zA-Z]+):\s*\(\)\s*=>\s*import\("\.\/settings\//gm)].map((m) => m[1]);
const covered = new Set(entries.map((e) => e.section));
report(
  "settings pages no search entry reaches",
  pages.filter((p) => !covered.has(p)),
  "the page exists but cannot be found by searching",
);

const shouting = [];
for (const f of settingsTsx) {
  for (const m of read(f).matchAll(/t\("([A-Z][A-Z0-9 &/'-]{3,})"\)/g)) {
    if (/^(RPDB|TMDB|SUBDL|SIMKL|MAL|HI\/SDH|EPG|JSON|DLNA|URL)/.test(m[1])) continue;
    shouting.push(rel(f) + '  "' + m[1] + '"');
  }
}
report(
  "source strings written in capitals",
  shouting,
  "CSS already uppercases these labels, so the caps are redundant and translators receive shouting",
);

const labelKeys = new Map();
for (const f of settingsTsx) {
  const lines = read(f).split("\n");
  lines.forEach((ln, i) => {
    const m = /label=\{t\("([^"]+)"\)\}/.exec(ln);
    if (!m) return;
    const k = /update\(\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*[:}]/.exec(lines.slice(i, i + 10).join(" "));
    if (!k) return;
    if (!labelKeys.has(m[1])) labelKeys.set(m[1], new Set());
    labelKeys.get(m[1]).add(k[1]);
  });
}
report(
  "one label naming two different settings",
  [...labelKeys].filter(([, v]) => v.size > 1).map(([l, v]) => '"' + l + '" -> ' + [...v].join(", ")),
  "two unrelated controls share a name, so search shows them identically",
);

let failed = 0;
console.log("Harbor settings health\n");
for (const f of findings) {
  const ok = f.count === 0;
  if (!ok) failed++;
  console.log((ok ? "  ok    " : "  FAIL  ") + String(f.count).padStart(3) + "  " + f.check);
  if (!ok) {
    console.log("          " + f.detail);
    for (const it of f.items.slice(0, 12)) console.log("          - " + it);
    if (f.items.length > 12) console.log("          ... " + (f.items.length - 12) + " more");
  }
}
console.log("\n" + (failed ? failed + " check(s) failing" : "all checks clean"));
process.exit(failed ? 1 : 0);
