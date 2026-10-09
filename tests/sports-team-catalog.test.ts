import assert from "node:assert/strict";
import test from "node:test";
import { createTeamCatalog, parseCatalogTeams } from "../src/lib/sports/team-catalog.ts";

const league = { key: "EPL", group: "soccer", path: "soccer/eng.1" };
const team = (id = "359", name = "Arsenal") => ({
  id,
  displayName: name,
  shortDisplayName: name,
  abbreviation: "ARS",
  logos: [{ href: `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png` }],
});
const envelope = (teams = [team()]) => ({
  sports: [{ leagues: [{ teams: teams.map((team) => ({ team })) }] }],
});
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("parses ESPN's catalog and nested conference standings without duplicate teams", () => {
  assert.equal(parseCatalogTeams(envelope(), league)[0].abbr, "ARS");
  const data = {
    children: [
      {
        children: [
          { standings: { entries: [{ team: team() }, { team: team("360", "Chelsea") }] } },
        ],
      },
      { standings: { entries: [{ team: team() }] } },
    ],
  };
  assert.deepEqual(
    parseCatalogTeams(data, league).map((t) => t.name),
    ["Arsenal", "Chelsea"],
  );
  assert.equal(parseCatalogTeams({ teams: [team()] }, league)[0].id, "359");
  assert.deepEqual(
    parseCatalogTeams(
      {
        sports: [
          { leagues: [{ teams: [{ team: { id: "1" } }, { team: { displayName: "No ID" } }] }] },
        ],
      },
      league,
    ),
    [],
  );
});

test("requests the complete college catalog and shares concurrent requests", async () => {
  let count = 0;
  const catalog = createTeamCatalog({
    request: async (url) => {
      count++;
      assert.equal(new URL(url).searchParams.get("limit"), "1000");
      return envelope(Array.from({ length: 762 }, (_, n) => team(String(n), `College ${n}`)));
    },
  });
  const first = catalog.fetch(league);
  assert.equal(first, catalog.fetch(league));
  assert.equal((await first).length, 762);
  assert.equal((await catalog.fetch(league)).length, 762);
  assert.equal(count, 1);
});

test("an unavailable teams endpoint falls back to standings, while empty failures remain retryable", async () => {
  let good = false;
  let count = 0;
  const catalog = createTeamCatalog({
    request: async (url) => {
      count++;
      if (url.includes("/teams") || !good) throw new Error("HTTP503");
      return { children: [{ standings: { entries: [{ team: team() }] } }] };
    },
  });
  assert.deepEqual(await catalog.fetch(league), []);
  assert.equal(catalog.status(league.key), "unavailable");
  good = true;
  assert.equal((await catalog.fetch(league, true)).length, 1);
  assert.equal(count, 4);
  assert.equal(catalog.status(league.key), "ready");
});

test("cricket uses standings then the series roster and distinguishes unpublished from request failures", async () => {
  const cricket = { key: "ASHES", group: "cricket", path: "cricket/22975" };
  const calls: string[] = [];
  const catalog = createTeamCatalog({
    request: async (url) => {
      calls.push(url);
      return url.includes("standings")
        ? { children: [] }
        : { teams: [team("2", "Australia"), team("1", "England")] };
    },
  });
  assert.equal((await catalog.fetch(cricket)).length, 2);
  assert.equal(
    calls.some((url) => url.includes("/teams")),
    false,
  );
  const empty = createTeamCatalog({ request: async () => ({ children: [], teams: [] }) });
  assert.deepEqual(await empty.fetch(cricket), []);
  assert.equal(empty.status(cricket.key), "not-published");
  const failed = createTeamCatalog({
    request: async (url) => {
      if (url.includes("standings")) throw new Error("timeout");
      return { teams: [] };
    },
  });
  await failed.fetch(cricket);
  assert.equal(failed.status(cricket.key), "unavailable");
});

test("persisted stale teams survive failed refresh and force bypasses fresh cache without deleting it", async () => {
  const saved = parseCatalogTeams(envelope(), league);
  let now = 7 * 60 * 60 * 1000;
  let output = "";
  let count = 0;
  const catalog = createTeamCatalog({
    now: () => now,
    readAsync: async () => JSON.stringify([{ key: league.key, at: 0, teams: saved }]),
    write: (json) => {
      output = json;
    },
    request: async () => {
      count++;
      throw new Error("offline");
    },
  });
  assert.equal((await catalog.fetch(league))[0].name, "Arsenal");
  assert.equal(catalog.cached(league.key).length, 1);
  assert.equal(count, 2);
  assert.equal(output, "");
  now = 100;
  await catalog.fetch(league);
  assert.equal(count, 2);
  await catalog.fetch(league, true);
  assert.equal(count, 4);
  assert.equal(catalog.cached(league.key).length, 1);
});

test("disk hydration avoids a new request and persistence failure does not discard loaded teams", async () => {
  const saved = parseCatalogTeams(envelope(), league);
  const disk = createTeamCatalog({
    now: () => 10,
    readAsync: async () => JSON.stringify([{ key: league.key, at: 1, teams: saved }]),
    request: async () => {
      throw new Error("Should use persisted teams");
    },
  });
  assert.equal((await disk.fetch(league)).length, 1);
  const full = createTeamCatalog({
    write: () => {
      throw new Error("quota");
    },
    request: async () => envelope(),
  });
  assert.equal((await full.fetch(league)).length, 1);
  assert.equal(full.cached(league.key).length, 1);
});

test("only three catalogs run at once, invalid provider paths never issue requests", async () => {
  let active = 0;
  let peak = 0;
  const releases: Array<() => void> = [];
  const catalog = createTeamCatalog({
    request: async () => {
      peak = Math.max(peak, ++active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
      return envelope();
    },
  });
  const pending = Array.from({ length: 8 }, (_, n) => catalog.fetch({ ...league, key: `L${n}` }));
  await flush();
  assert.equal(releases.length, 3);
  while (releases.length) {
    releases.splice(0).forEach((resolve) => resolve());
    await flush();
  }
  await Promise.all(pending);
  assert.equal(peak, 3);
  assert.deepEqual(await catalog.fetch({ ...league, path: "official-one" }), []);
});

test("numeric leagues merge only matching directory and current-season teams and persist partial status", async () => {
  const def = { key: "EGY", labelEn: "Egyptian Premier League", group: "soccer", path: "4829" };
  let saved = "";
  const calls: string[] = [];
  const catalog = createTeamCatalog({
    write: (value) => {
      saved = value;
    },
    request: async (url) => {
      calls.push(url);
      if (url.includes("search_all_teams"))
        return {
          teams: [
            {
              idTeam: "138995",
              idLeague: "4829",
              strTeam: "Al Ahly",
              strTeamShort: "AHL",
              strAlternate: "الأهلي,Al Ahly SC",
            },
            { idTeam: "133607", idLeague: "4396", strTeam: "Wigan Athletic" },
          ],
        };
      if (url.includes("lookupleague"))
        return { leagues: [{ idLeague: "4829", strCurrentSeason: "2026-2027" }] };
      return {
        table: [
          { idTeam: "138997", idLeague: "4829", strSeason: "2026-2027", strTeam: "Zamalek" },
          {
            idTeam: "139838",
            idLeague: "4829",
            strSeason: "2024-2025",
            strTeam: "Old season club",
          },
          {
            idTeam: "133607",
            idLeague: "4396",
            strSeason: "2026-2027",
            strTeam: "Wrong league club",
          },
        ],
      };
    },
  });
  const teams = await catalog.fetch(def);
  assert.deepEqual(
    teams.map((team) => team.name),
    ["Al Ahly", "Zamalek"],
  );
  assert.deepEqual(teams[0].aliases, ["الأهلي", "Al Ahly SC"]);
  assert.equal(catalog.isPartial(def.key), true);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((url) => new URL(url).hostname === "www.thesportsdb.com"));
  const restored = createTeamCatalog({
    read: () => saved,
    request: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(restored.isPartial(def.key), true);
  assert.deepEqual(restored.cached(def.key)[0].aliases, ["الأهلي", "Al Ahly SC"]);
});

test("HTTP200 demonstration rosters never become real teams or unpublished success", async () => {
  const catalog = createTeamCatalog({
    request: async (url) =>
      url.includes("lookup_all_teams")
        ? { teams: [{ idTeam: "133607", idLeague: "4396", strTeam: "Wigan Athletic" }] }
        : { leagues: [{ idLeague: "4396", strCurrentSeason: "2026-2027" }] },
  });
  const def = { key: "EGY", path: "4829", group: "soccer" };
  assert.deepEqual(await catalog.fetch(def), []);
  assert.equal(catalog.status(def.key), "unavailable");
});

test("a connected but stalled JSON body is bounded and releases its queue slot", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const signals: AbortSignal[] = [];
  const catalog = createTeamCatalog({
    request: async (_url, signal) => {
      signals.push(signal);
      return new Promise(() => {});
    },
  });
  const pending = catalog.fetch(league);
  await flush();
  t.mock.timers.tick(10_000);
  await flush();
  assert.equal(signals[0].aborted, true);
  t.mock.timers.tick(10_000);
  await flush();
  assert.deepEqual(await pending, []);
  assert.equal(signals[1].aborted, true);
  assert.equal(catalog.status(league.key), "unavailable");
});

test("cache size stays bounded and expired, future, or malformed entries cannot hide a fresh catalog", async () => {
  let json = "";
  let now = 40 * 86400_000;
  const saved = parseCatalogTeams(envelope(), league);
  const catalog = createTeamCatalog({
    now: () => now,
    read: () =>
      JSON.stringify([
        { key: "OLD", at: 0, teams: saved.map((t) => ({ ...t, leagueKey: "OLD" })) },
        { key: "FUTURE", at: now + 1, teams: saved.map((t) => ({ ...t, leagueKey: "FUTURE" })) },
        { key: "BAD", at: now, teams: [{ leagueKey: "BAD", id: "1" }] },
      ]),
    write: (value) => {
      json = value;
    },
    request: async () => envelope(),
  });
  assert.deepEqual(catalog.cached("OLD"), []);
  assert.deepEqual(catalog.cached("FUTURE"), []);
  assert.deepEqual(catalog.cached("BAD"), []);
  for (let i = 0; i < 100; i++) {
    now++;
    await catalog.fetch({ ...league, key: `L${i}` });
  }
  assert.equal(JSON.parse(json).length, 96);
  assert.ok(json.length <= 1_000_000);
  assert.deepEqual(catalog.cached("L0"), []);
  assert.equal(catalog.cached("L99").length, 1);
});
