import test from "node:test";
import assert from "node:assert/strict";
import { boxingRecord } from "../src/lib/sports/boxing-record.ts";

test("published boxing records retain zeroes and put both fighters' metrics in the same order", () => {
  assert.deepEqual(boxingRecord("W 7 · KO 4 · L 0 · D 0"), [
    { label: "sports.boxing.wins", value: "7" },
    { label: "sports.boxing.losses", value: "0" },
    { label: "sports.boxing.draws", value: "0" },
    { label: "sports.boxing.knockouts", value: "4" },
  ]);
  assert.equal(boxingRecord("W 24 · KO 14 · L 7 · D 1")?.[1].value, "7");
});

test("unknown, partial and duplicate records stay unparsed rather than inventing statistics", () => {
  for (const value of [undefined, "", "24-7-1", "W 7 · L 0", "W 7 · L 0 · D 0 · W 8", "W 7 · L 0 · D 0 · NC 1"])
    assert.equal(boxingRecord(value), null);
  assert.equal(boxingRecord("W 7 · L 0 · D 0")?.length, 3);
});
