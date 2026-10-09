import assert from "node:assert/strict";
import test from "node:test";
import { toSide } from "../src/lib/sports/espn-parse";

// The exact shape ESPN publishes for a doubles pair: type "team", NO team object, a roster.
const pair = {
  id: "16562-854",
  type: "team",
  order: 2,
  winner: true,
  score: "2",
  roster: {
    displayName: "Sander Gille / Sem Verbeek",
    shortDisplayName: "S. Gille / S. Verbeek",
    athletes: [
      { id: "4433", displayName: "Sander Gille", flag: { href: "https://a.espncdn.com/be.png" } },
      { id: "4711", displayName: "Sem Verbeek", flag: { href: "https://a.espncdn.com/nl.png" } },
    ],
  },
  linescores: [{ value: "6", winner: true }, { value: "4" }, { value: "7", winner: true }],
};

const singles = {
  id: "999",
  type: "athlete",
  score: "2",
  athlete: { id: "5001", displayName: "Carlos Alcaraz", shortName: "C. Alcaraz" },
};

test("a doubles pair is named, so the blank-name guard can no longer eat the match", () => {
  const side = toSide(pair, "tennis");
  assert.equal(side.name, "Sander Gille / Sem Verbeek");
  assert.ok(side.name.trim().length > 0, "an unnamed side is discarded downstream");
  assert.equal(side.abbr, "S. Gille / S. Verbeek");
  assert.equal(side.id, "16562-854");
  assert.equal(side.winner, true);
});

test("both players survive as addressable people, not one flattened string", () => {
  const side = toSide(pair, "tennis");
  assert.equal(side.members?.length, 2);
  assert.deepEqual(
    side.members?.map((m) => m.name),
    ["Sander Gille", "Sem Verbeek"],
  );
  assert.deepEqual(
    side.members?.map((m) => m.id),
    ["4433", "4711"],
  );
  assert.ok(
    side.members?.every((m) => m.flag.startsWith("https://")),
    "each member keeps its own flag so the pair can render two",
  );
});

test("the doubles set line is preserved, not dropped with the match", () => {
  const side = toSide(pair, "tennis");
  assert.ok((side.periods?.length ?? 0) >= 3, "three sets were played");
});

test("singles is untouched by the new branch", () => {
  const side = toSide(singles, "tennis");
  assert.equal(side.name, "Carlos Alcaraz");
  assert.equal(side.id, "5001");
  assert.equal(side.members, undefined, "a singles player is not a squad");
});

test("a real team with no roster still uses the team branch", () => {
  const side = toSide(
    { id: "1", type: "team", team: { id: "5", displayName: "Toronto Raptors", abbreviation: "TOR", logo: "x.png" } },
    "basketball",
  );
  assert.equal(side.name, "Toronto Raptors");
  assert.equal(side.abbr, "TOR");
  assert.equal(side.members, undefined);
});
