#!/usr/bin/env node
// Imports a folder of team art into a JL account's Sports art (media.custom_art + the private
// `media-art` bucket).
//
//   node scripts/import-sports-art.mjs <folder> [--league NCAAF] [--apply]
//
// <folder> holds one folder per team, named after the team ("Oregon Ducks", or with a league
// hint: "Oregon Ducks [NCAAF]"), each with any of hero / wordmark / story / card / wallpaper as
// .png, .jpg/.jpeg or .webp. Each team name is resolved to its ESPN team id and league through
// ESPN's public search, and the plan is printed. Nothing is uploaded without --apply.
//
// --apply needs, from the environment (never from this file):
//   JL_SUPABASE_URL           the JL accounts project URL (or the app's VITE_JL_SUPABASE_URL)
//   JL_SUPABASE_ANON_KEY      its public anon key (or VITE_JL_SUPABASE_ANON_KEY)
//   JL_SUPABASE_ACCESS_TOKEN  a signed-in user's access token (the art is saved to that account)
// Row-level security limits the token to its own rows and its own folder in the bucket.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const KINDS = ["hero", "wordmark", "story", "card", "wallpaper"];
const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const MAX_BYTES = 15 * 1024 * 1024;
const BUCKET = "media-art";
const SEARCH = "https://site.web.api.espn.com/apis/search/v2";
// ESPN league uids, as the app's league tags (src/lib/jl/sports/search-parse.ts).
const LEAGUE_BY_UID = { 28: "NFL", 23: "NCAAF", 46: "NBA", 41: "NCAA", 90: "NHL", 10: "MLB" };

function usage(message) {
  if (message) console.error(`error: ${message}\n`);
  console.error("usage: node scripts/import-sports-art.mjs <folder> [--league NCAAF] [--apply]");
  process.exit(message ? 1 : 0);
}

function parseArgs(argv) {
  const out = { folder: null, league: null, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--league")
      out.league = (argv[++i] ?? "").toUpperCase() || usage("--league needs a value");
    else if (a === "-h" || a === "--help") usage();
    else if (a.startsWith("-")) usage(`unknown option ${a}`);
    else if (!out.folder) out.folder = a;
    else usage(`unexpected argument ${a}`);
  }
  if (!out.folder) usage("missing <folder>");
  return out;
}

/** "Oregon Ducks [NCAAF]" → { name: "Oregon Ducks", league: "NCAAF" }. */
export function parseFolderName(folder) {
  const m = /^(.*?)\s*\[([A-Za-z0-9]+)\]\s*$/.exec(folder);
  return m
    ? { name: m[1].trim(), league: m[2].toUpperCase() }
    : { name: folder.trim(), league: null };
}

const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** ESPN search results → team hits with the app's league tags. */
export function parseTeamHits(doc) {
  const hits = [];
  for (const group of Array.isArray(doc?.results) ? doc.results : []) {
    if (group?.type !== "team") continue;
    for (const c of Array.isArray(group.contents) ? group.contents : []) {
      const uid = String(c?.uid ?? "");
      const league = LEAGUE_BY_UID[/~l:(\d+)/.exec(uid)?.[1] ?? ""];
      const id = /~t:(\d+)/.exec(uid)?.[1];
      if (league && id && typeof c.displayName === "string")
        hits.push({ league, id, name: c.displayName });
    }
  }
  return hits;
}

async function searchTeams(query) {
  const res = await fetch(`${SEARCH}?query=${encodeURIComponent(query)}&limit=20`);
  if (!res.ok) throw new Error(`ESPN search failed (${res.status})`);
  return parseTeamHits(await res.json());
}

/** The best search hit for a team name: an exact name match first, in the hinted league. */
export function pickTeam(hits, name, league) {
  const pool = league
    ? hits.filter((h) => h.league === league || (league === "NCAAB" && h.league === "NCAA"))
    : hits;
  const wanted = norm(name);
  return (
    pool.find((h) => norm(h.name) === wanted) ??
    pool.find((h) => norm(h.name).startsWith(`${wanted} `)) ??
    pool[0] ??
    null
  );
}

async function teamFiles(dir) {
  const files = [];
  const problems = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const m = /^(hero|wordmark|story|card|wallpaper)\.(png|jpe?g|webp)$/i.exec(entry.name);
    if (!m) {
      if (!entry.name.startsWith(".")) problems.push(`skipped ${entry.name} (not a slot image)`);
      continue;
    }
    const kind = m[1].toLowerCase();
    const ext = m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase();
    const file = path.join(dir, entry.name);
    const { size } = await stat(file);
    if (size > MAX_BYTES) problems.push(`skipped ${entry.name} (larger than 15 MB)`);
    else if (files.some((f) => f.kind === kind))
      problems.push(`skipped ${entry.name} (two ${kind} files)`);
    else files.push({ kind, ext, file, size, type: TYPES[m[2].toLowerCase()] });
  }
  files.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
  return { files, problems };
}

function tokenOwner(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

async function upload(env, owner, ref, entry, label) {
  const objectPath = `${owner}/${ref}/${entry.kind}.${entry.ext}`;
  const auth = { apikey: env.anonKey, Authorization: `Bearer ${env.token}` };
  const put = await fetch(`${env.url}/storage/v1/object/${BUCKET}/${encodePath(objectPath)}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": entry.type, "x-upsert": "true", "Cache-Control": "3600" },
    body: await readFile(entry.file),
  });
  if (!put.ok) throw new Error(`upload ${entry.kind} failed (${put.status}): ${await put.text()}`);
  const row = await fetch(`${env.url}/rest/v1/custom_art?on_conflict=owner,kind,ref_id`, {
    method: "POST",
    headers: {
      ...auth,
      "Content-Type": "application/json",
      "Accept-Profile": "media",
      "Content-Profile": "media",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ kind: entry.kind, ref_id: ref, label, storage_path: objectPath }),
  });
  if (!row.ok) throw new Error(`saving ${entry.kind} failed (${row.status}): ${await row.text()}`);
  return objectPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.folder);
  let env = null;
  let owner = "<owner>";
  if (args.apply) {
    env = {
      url: (process.env.JL_SUPABASE_URL ?? process.env.VITE_JL_SUPABASE_URL ?? "")
        .trim()
        .replace(/\/+$/, ""),
      anonKey: (
        process.env.JL_SUPABASE_ANON_KEY ??
        process.env.VITE_JL_SUPABASE_ANON_KEY ??
        ""
      ).trim(),
      token: (process.env.JL_SUPABASE_ACCESS_TOKEN ?? "").trim(),
    };
    if (!env.url || !env.anonKey || !env.token)
      usage(
        "--apply needs JL_SUPABASE_URL, JL_SUPABASE_ANON_KEY and JL_SUPABASE_ACCESS_TOKEN in the environment",
      );
    owner = tokenOwner(env.token) ?? usage("JL_SUPABASE_ACCESS_TOKEN is not a user access token");
  }

  const folders = (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory());
  if (!folders.length) usage(`no team folders in ${root}`);
  console.log(
    `${args.apply ? "Importing" : "Dry run (add --apply to upload)"}: ${folders.length} team folder(s) in ${root}\n`,
  );

  let planned = 0;
  let failed = 0;
  for (const folder of folders.sort((a, b) => a.name.localeCompare(b.name))) {
    const { name, league: hint } = parseFolderName(folder.name);
    const { files, problems } = await teamFiles(path.join(root, folder.name));
    let team = null;
    try {
      team = pickTeam(await searchTeams(name), name, hint ?? args.league);
    } catch (error) {
      problems.push(String(error.message ?? error));
    }
    if (!team) {
      console.log(
        `✗ ${folder.name}: no ESPN team found${(hint ?? args.league) ? ` in ${hint ?? args.league}` : ""}`,
      );
      for (const p of problems) console.log(`    ${p}`);
      failed++;
      continue;
    }
    const ref = `team:${team.league.toLowerCase()}:${team.id}`;
    console.log(`• ${folder.name} → ${team.name} (${team.league}, ESPN ${team.id})  ref ${ref}`);
    for (const p of problems) console.log(`    ! ${p}`);
    if (!files.length) console.log("    (no slot images)");
    for (const entry of files) {
      const target = `${owner}/${ref}/${entry.kind}.${entry.ext}`;
      if (!args.apply) {
        console.log(
          `    ${entry.kind.padEnd(9)} ${path.basename(entry.file)} → ${BUCKET}/${target} (${Math.round(entry.size / 1024)} KB)`,
        );
        planned++;
        continue;
      }
      try {
        await upload(env, owner, ref, entry, team.name);
        console.log(`    ✓ ${entry.kind.padEnd(9)} ${BUCKET}/${target}`);
        planned++;
      } catch (error) {
        console.log(`    ✗ ${entry.kind.padEnd(9)} ${error.message ?? error}`);
        failed++;
      }
    }
  }
  console.log(
    `\n${args.apply ? "Uploaded" : "Planned"} ${planned} image(s)${failed ? `, ${failed} problem(s)` : ""}.`,
  );
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error?.message ?? error);
    process.exit(1);
  });
}
