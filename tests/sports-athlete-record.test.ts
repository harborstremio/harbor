import assert from "node:assert/strict";
import test from "node:test";
import { athleteRecordUrl, isEspnAthleteId, parseAthleteRecord } from "../src/lib/sports/athlete-record";

test("the overall career line is read, not the first row that happens to be there", () => {
  assert.equal(
    parseAthleteRecord({
      items: [
        { name: "last5", type: "last5", summary: "3-2-0" },
        { name: "overall", type: "total", summary: "19-6-0" },
      ],
    }),
    "19-6-0",
  );
});

test("a two part record is kept, ESPN omits draws for some fighters", () => {
  assert.equal(parseAthleteRecord({ items: [{ type: "total", summary: "12-0" }] }), "12-0");
});

test("displayValue stands in when summary is missing", () => {
  assert.equal(parseAthleteRecord({ items: [{ type: "total", displayValue: "7-5-0" }] }), "7-5-0");
});

test("anything that is not a record shape is refused rather than printed", () => {
  assert.equal(parseAthleteRecord({ items: [{ type: "total", summary: "Champion" }] }), "");
  assert.equal(parseAthleteRecord({ items: [{ type: "total", summary: "" }] }), "");
  assert.equal(parseAthleteRecord({ items: [{ type: "total", value: 0.58 }] }), "");
  assert.equal(parseAthleteRecord({ items: [] }), "");
  assert.equal(parseAthleteRecord({}), "");
  assert.equal(parseAthleteRecord(null), "");
});

test("only a numeric espn id is ever put in the url", () => {
  assert.ok(isEspnAthleteId("2085811"));
  assert.ok(!isEspnAthleteId("2085811/../../evil"));
  assert.ok(!isEspnAthleteId("abc"));
  assert.ok(!isEspnAthleteId(undefined));
  assert.equal(
    athleteRecordUrl("2085811"),
    "https://sports.core.api.espn.com/v2/sports/mma/athletes/2085811/records",
  );
});
