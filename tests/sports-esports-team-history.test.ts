import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchEsportsTeamHistory,
  mergeEsportsTeamHistory,
  parseBlastTeamHistory,
} from "../src/lib/sports/esports-team-history.ts";

const teamId = "57464286-ad6e-4685-bdb0-8217d1c9e677";
const otherId = "99db5c2b-6625-4a3e-b7e5-037d758bb4b0";
const now = Date.UTC(2026, 8, 14);
const match = {
  id: "87322d58-2ecb-4f23-ac76-a35985032e30",
  result: "L",
  scheduledAt: new Date("2026-08-10T14:30:00Z"),
  type: "BO5",
  tournament: {
    id: "esports-world-cup-2026-last-chance-qualifier",
    name: "Esports World Cup 2026 LCQ",
  },
  teamA: { id: otherId, name: "Team Stallions", shortName: "stallions" },
  teamB: { id: teamId, name: "Virtus.pro", shortName: "vp" },
  teamAScore: 3,
  teamBScore: 1,
};

// Mirrors the official page's JSON references and deferred promise chunks, not JavaScript execution.
function page(rows: unknown[], gameId = "rl") {
  const table: unknown[] = [];
  const encode = (value: unknown): number => {
    const index = table.length;
    table.push(null);
    if (value instanceof Date) table[index] = ["D", value.getTime()];
    else if (Array.isArray(value)) table[index] = value.map(encode);
    else if (value && typeof value === "object") {
      const record: Record<string, number> = {};
      for (const [key, child] of Object.entries(value)) record[`_${encode(key)}`] = encode(child);
      table[index] = record;
    } else table[index] = value;
    return index;
  };
  encode({ id: teamId, gameId, name: "Virtus.pro" });
  const initial = table.length;
  const chunk = (value: string) => `streamController.enqueue(${JSON.stringify(value)})`;
  const first = chunk(JSON.stringify(table));
  encode(rows);
  return first + chunk(`P0:${JSON.stringify(table.slice(initial))}`);
}

test("official deferred history retains older results with exact team identity and scores", () => {
  const rows = parseBlastTeamHistory(page([match, match]), teamId, now);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].startMs, match.scheduledAt.getTime());
  assert.equal(rows[0].teams[1].winner, false);
  assert.equal(rows[0].teams[1].score, 1);
  assert.equal(rows[0].event.name, match.tournament.name);
  assert.equal(rows[0].state, "recent");
});

test("upcoming, wrong squads, malformed scores and another game's identity cannot become results", () => {
  const source = page([
    { ...match, result: "-" },
    { ...match, scheduledAt: new Date(now + 86_400_000) },
    { ...match, teamAScore: null },
    { ...match, teamAScore: 1 },
    { ...match, teamB: { ...match.teamB, id: "11111111-1111-1111-1111-111111111111" } },
  ]);
  assert.deepEqual(parseBlastTeamHistory(source, teamId, now), []);
  assert.throws(() => parseBlastTeamHistory(page([match], "cs"), teamId, now), /identity/);
  assert.throws(
    () => parseBlastTeamHistory("<html>temporarily unavailable</html>", teamId, now),
    /format/,
  );
  assert.throws(() => parseBlastTeamHistory(page([match]), "../bad", now), /identity/);
});

test("history is bounded and merges without replacing current match records", () => {
  const rows = parseBlastTeamHistory(
    page(
      Array.from({ length: 30 }, (_, index) => ({
        ...match,
        id: `${String(index).padStart(8, "0")}-2ecb-4f23-ac76-a35985032e30`,
        scheduledAt: new Date(now - (index + 1) * 86_400_000),
      })),
    ),
    teamId,
    now,
  );
  assert.equal(rows.length, 24);
  const live = { ...rows[0], state: "live" as const };
  const upcoming = { ...rows[1], id: "current-upcoming", state: "upcoming" as const };
  const merged = mergeEsportsTeamHistory(
    "rocketleague",
    teamId,
    [live, upcoming],
    [...rows, { ...rows[2], id: "same-team-id-other-game", game: "cs2" }],
  );
  assert.equal(merged[0], live);
  assert.equal(merged[1], upcoming);
  assert.equal(merged.filter((row) => row.id === live.id).length, 1);
  assert.ok(merged.every((row) => row.game === "rocketleague"));
});

test("unsupported sources return an explicit status without network access", async () => {
  assert.deepEqual(await fetchEsportsTeamHistory("cs2", "123", new AbortController().signal), {
    status: "unsupported",
    matches: [],
  });
  assert.deepEqual(
    await fetchEsportsTeamHistory("rocketleague", "unknown", new AbortController().signal),
    { status: "unsupported", matches: [] },
  );
});
