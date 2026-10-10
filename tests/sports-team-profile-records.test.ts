import assert from "node:assert/strict";
import test from "node:test";
import { parseEspnTeamProfile } from "../src/lib/sports/team-profile";

const identity = { id: "28", name: "Toronto Raptors", league: "nba", sport: "basketball" };

function payload(records: { description: string; summary: string }[]) {
  return {
    team: {
      id: "28",
      displayName: "Toronto Raptors",
      location: "Toronto",
      standingSummary: "1st in Atlantic Division",
      venue: { fullName: "Scotiabank Arena" },
      record: { items: records.map((r) => ({ ...r, type: "total", stats: [] })) },
      links: [],
      logos: [],
    },
  };
}

const labels = (profile: ReturnType<typeof parseEspnTeamProfile>) =>
  (profile?.facts ?? []).map((fact) => fact.label);

test("a season that has not started publishes no records and no standing", () => {
  // Exactly what ESPN returns for the Raptors before tip-off.
  const profile = parseEspnTeamProfile(
    payload([
      { description: "Overall Record", summary: "0-0" },
      { description: "Home Record", summary: "0-0" },
      { description: "Away Record", summary: "0-0" },
    ]),
    identity as never,
  );
  assert.ok(profile, "the profile still parses");
  const shown = labels(profile);
  assert.ok(!shown.includes("Overall Record"), "0-0 carries no information");
  assert.ok(!shown.includes("Home Record"));
  assert.ok(!shown.includes("Away Record"));
  assert.ok(
    !shown.includes("Standing"),
    "a standing between teams that have all played nothing is an arbitrary tiebreak",
  );
  assert.ok(shown.includes("Venue"), "the rest of the profile is untouched");
});

test("once games are played the records and standing come back", () => {
  const profile = parseEspnTeamProfile(
    payload([
      { description: "Overall Record", summary: "12-5" },
      { description: "Home Record", summary: "7-1" },
      { description: "Away Record", summary: "5-4" },
    ]),
    identity as never,
  );
  const shown = labels(profile);
  assert.ok(shown.includes("Overall Record"));
  assert.ok(shown.includes("Home Record"));
  assert.ok(shown.includes("Standing"));
});

test("a single result is enough to publish, including a drawn record", () => {
  for (const summary of ["0-1", "1-0", "0-0-1"]) {
    const profile = parseEspnTeamProfile(
      payload([{ description: "Overall Record", summary }]),
      identity as never,
    );
    assert.ok(labels(profile).includes("Overall Record"), `${summary} is a real result`);
    assert.ok(labels(profile).includes("Standing"), `${summary} means games were played`);
  }
});
