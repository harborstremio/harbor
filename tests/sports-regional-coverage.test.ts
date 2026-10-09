import assert from "node:assert/strict";
import test from "node:test";
import { LEAGUES } from "../src/lib/sports/espn-leagues.ts";
import {
  REGIONAL_ESPN_LEAGUES,
  REGIONAL_DB_LEAGUES,
  REGIONAL_SOCCER_ALIASES,
  REGIONAL_PORTUGUESE_LABELS,
  regionalOfficialWebsite,
} from "../src/lib/sports/regional-sports-catalog.ts";

const regional = [...REGIONAL_ESPN_LEAGUES, ...REGIONAL_DB_LEAGUES];

test("regional leagues do not shadow existing feeds or duplicate the same competition", () => {
  for (const field of ["key", "tag", "path"] as const) {
    assert.equal(new Set(regional.map((l) => l[field])).size, regional.length);
  }
  for (const league of regional) {
    const current = LEAGUES.find(
      (l) => l.key === league.key || l.path === league.path || l.tag === league.tag,
    );
    if (current) {
      // The integrating root can already have inserted this exact definition.
      assert.equal(current.key, league.key);
      assert.equal(current.path, league.path);
      assert.equal(current.tag, league.tag);
    }
  }
  assert.ok(regional.length <= 20);
  assert.ok(!REGIONAL_DB_LEAGUES.some((l) => ["4351", "4404", "4668"].includes(l.path)));
});

test("ESPN name variants retain established Brazilian and Saudi game identities", () => {
  assert.equal(REGIONAL_SOCCER_ALIASES["Brazil Paulista"], "PAULISTA");
  assert.equal(REGIONAL_SOCCER_ALIASES["Brazilian Campeonato Carioca"], "CARIOCA");
  assert.equal(REGIONAL_SOCCER_ALIASES["Copa do Brazil"], "COPADOBRASIL");
  assert.equal(REGIONAL_SOCCER_ALIASES["Brazilian Serie A"], "BRASILEIRAO");
  assert.equal(REGIONAL_SOCCER_ALIASES["Saudi Pro League"], "ROSHN");
  assert.equal(REGIONAL_SOCCER_ALIASES["AFC Champions League Two"], "ACL2");
  const known = new Set([...LEAGUES, ...REGIONAL_ESPN_LEAGUES].map((l) => l.key));
  for (const key of Object.values(REGIONAL_SOCCER_ALIASES)) assert.ok(known.has(key), key);
});

test("MENA schedules keep real provider IDs separate from ESPN endpoint paths", () => {
  const ids = Object.fromEntries(REGIONAL_DB_LEAGUES.map((l) => [l.key, l.path]));
  assert.equal(ids.EGYPT, "4829");
  assert.equal(ids.MOROCCO, "4520");
  assert.equal(ids.ALGERIA, "4753");
  assert.equal(ids.TUNISIA, "4828");
  assert.equal(ids.UAE, "4678");
  assert.equal(ids.QATAR, "4663");
  for (const league of REGIONAL_DB_LEAGUES) assert.match(league.path, /^\d+$/);
  for (const league of REGIONAL_ESPN_LEAGUES) assert.match(league.path, /^soccer\//);
});

test("regional labels and public source links are available without credentials", () => {
  for (const league of regional) {
    assert.match(league.label, /[\u0600-\u06ff]/);
    assert.equal(league.group, "soccer");
    assert.equal(new URL(league.logo).protocol, "https:");
    assert.equal(new URL(regionalOfficialWebsite(league.tag)!).protocol, "https:");
  }
  assert.equal(REGIONAL_PORTUGUESE_LABELS.BRASILEIRAO, "Brasileirão Série A");
  assert.equal(REGIONAL_PORTUGUESE_LABELS.GAUCHO, "Campeonato Gaúcho");
  assert.equal(regionalOfficialWebsite("UNKNOWN"), undefined);
});
