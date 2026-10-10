import fs from "node:fs";
import path from "node:path";
import { settingsSearchEntries } from "./settings-search-entries.mjs";

const ROOT = path.resolve(process.argv[2] ?? ".");

// phrased the way a person asks, not the way the setting is named
const QUERIES = [
  "make the text bigger",
  "the app is too bright",
  "change the accent colour",
  "use a different font",
  "hide the sidebar",
  "put the menu on top",
  "skip the intro automatically",
  "stop asking if im still watching",
  "play the next episode by itself",
  "remember where i stopped",
  "my subtitles are out of sync",
  "yellow subtitles",
  "two subtitle languages at once",
  "hearing impaired captions",
  "download episodes to watch offline",
  "where do downloads go",
  "limit how much space downloads use",
  "connect my trakt account",
  "sync with anilist",
  "log in to stremio",
  "add a debrid service",
  "real debrid",
  "my streams are slow",
  "prefer 4k releases",
  "block cam rips",
  "hide adult content",
  "set a pin for kids",
  "parental controls",
  "who is watching profiles",
  "back up my settings",
  "restore from a backup",
  "check for updates",
  "join the beta",
  "report a bug",
  "keyboard shortcuts",
  "use a game controller",
  "control harbor from my phone",
  "cast to my tv",
  "watch together with friends",
  "clear the cache",
  "change the app icon",
  "screensaver",
  "night mode audio",
  "my tv cuts off the edges",
  "player keeps buffering",
  "downloads keep failing",
  "movies are in the wrong language",
];

// no setting exists for these, so returning nothing is the right answer
const NO_SETTING = new Set(["reset everything"]);

// pressing Enter jumps to the first result, so the first result has to be the obvious one
const TOP_RESULT = [
  ["subtitle", "Subtitle size"],
  ["anime", "Anime"],
  ["trakt", "Trakt connection"],
  ["theme", "Theme"],
  ["download", "Downloads"],
  ["language", "Languages"],
  ["player", "Player"],
  ["spoilers", "Spoilers (blur)"],
  ["backup", "Backup & restore"],
  ["hearing impaired captions", "Never auto-select tracks containing"],
  ["free up space", "Clear caches"],
  ["my tv cuts off the edges", "Edge margin (TV crops the picture)"],
  ["how do i turn off spoilers", "Blur spoilers"],
];

const MAX_HITS = 25;

const { createServer } = await import("vite");
const server = await createServer({
  root: ROOT,
  server: { middlewareMode: true },
  logLevel: "error",
  optimizeDeps: { noDiscovery: true },
});

let failed = 0;
try {
  const mod = await server.ssrLoadModule("/src/views/settings/search-match.ts");
  const { matchesSettingsSearch, rankSettingsSearch, setSettingsSearchVocabulary } = mod;

  const nav = fs.readFileSync(path.join(ROOT, "src/views/settings/nav.tsx"), "utf8");
  const entries = settingsSearchEntries(nav);

  setSettingsSearchVocabulary(entries.flatMap((e) => [e.label, ...e.keywords]));
  const identity = (s) => s;
  const find = (q) =>
    entries
      .filter((e) => matchesSettingsSearch(q, [e.label], identity, e.keywords))
      .sort(
        (a, b) =>
          rankSettingsSearch(q, a.label, a.keywords) - rankSettingsSearch(q, b.label, b.keywords),
      );

  const dead = [];
  const broad = [];
  let total = 0;
  for (const q of QUERIES) {
    if (NO_SETTING.has(q)) continue;
    const hits = find(q);
    total += hits.length;
    if (!hits.length) dead.push(q);
    if (hits.length > MAX_HITS) broad.push(q + " (" + hits.length + ")");
  }

  const checked = QUERIES.filter((q) => !NO_SETTING.has(q)).length;
  console.log("Harbor settings search\n");
  console.log("  entries indexed: " + entries.length);
  console.log("  queries checked: " + checked);
  console.log("  mean results:    " + (total / checked).toFixed(1));
  console.log("");
  console.log((dead.length ? "  FAIL  " : "  ok    ") + dead.length + "  queries a person would type that find nothing");
  dead.forEach((q) => console.log("          - " + q));
  console.log((broad.length ? "  FAIL  " : "  ok    ") + broad.length + "  queries returning more than " + MAX_HITS + " results");
  broad.forEach((q) => console.log("          - " + q));

  const misranked = [];
  for (const [q, expected] of TOP_RESULT) {
    const top = find(q)[0];
    if (!top || top.label !== expected) {
      misranked.push(q + '  ->  expected "' + expected + '", got "' + (top ? top.label : "nothing") + '"');
    }
  }
  console.log((misranked.length ? "  FAIL  " : "  ok    ") + misranked.length + "  queries whose first result is not the obvious one");
  misranked.forEach((m) => console.log("          - " + m));

  failed = (dead.length ? 1 : 0) + (broad.length ? 1 : 0) + (misranked.length ? 1 : 0);
  console.log("\n" + (failed ? failed + " check(s) failing" : "all checks clean"));
} finally {
  await server.close();
}

process.exit(failed ? 1 : 0);
