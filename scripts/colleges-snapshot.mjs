// Refreshes the bundled College Sports school list (src/lib/jl/sports/data/colleges.json) from the
// NCAA's public member directory: names, divisions, conferences, states and athletics sites only.
// With a snapshot bundled, the app (web build included) skips fetching the directory on device.
//
// Run: node scripts/colleges-snapshot.mjs
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NCAA_DIRECTORY_URL, parseNcaaDirectory } from "../src/lib/jl/sports/colleges.ts";

const out = resolve("src/lib/jl/sports/data/colleges.json");
const res = await fetch(NCAA_DIRECTORY_URL, {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(60_000),
});
if (!res.ok) throw new Error(`directory answered ${res.status}`);
const list = parseNcaaDirectory(await res.json());
if (list.length < 500) throw new Error(`directory too small (${list.length} schools)`);
await writeFile(out, `${JSON.stringify(list)}\n`);
console.log(`${list.length} schools → ${out}`);
