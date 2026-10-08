import assert from "node:assert/strict";
import test from "node:test";
import {
  conferencesFor,
  filterColleges,
  isCollege,
  mapNcaaSchool,
  monogram,
  normalizeSite,
  parseNcaaDirectory,
  type College,
} from "../src/lib/jl/sports/colleges.ts";

const entry = (over: Record<string, unknown> = {}) => ({
  orgId: 245,
  nameOfficial: "  Gallaudet   University ",
  division: 3,
  subdivision: null,
  conferenceName: "United East Conference",
  memberOrgAddress: { state: "DC" },
  athleticWebUrl: "https://www.GallaudetBison.com/landing/index",
  historicallyBlackFlag: "N",
  deactive: "N",
  ...over,
});

test("maps an NCAA directory entry to a school", () => {
  assert.deepEqual(mapNcaaSchool(entry()), {
    id: "ncaa:245",
    name: "Gallaudet University",
    division: "III",
    subdivision: null,
    conference: "United East Conference",
    state: "DC",
    site: "gallaudetbison.com",
    hbcu: false,
  });
});

test("keeps the football level only for Division I and drops inactive members", () => {
  assert.equal(mapNcaaSchool(entry({ division: 1, subdivision: 1 }))?.subdivision, "FBS");
  assert.equal(mapNcaaSchool(entry({ division: 2, subdivision: 2 }))?.subdivision, null);
  assert.equal(mapNcaaSchool(entry({ deactive: "Y" })), null);
  assert.equal(mapNcaaSchool(entry({ nameOfficial: "" })), null);
  assert.equal(mapNcaaSchool(entry({ memberOrgAddress: { state: "Texas" } }))?.state, null);
});

test("parses the directory sorted by name, once per school", () => {
  const list = parseNcaaDirectory([
    entry({ orgId: 2, nameOfficial: "Zeta College" }),
    entry({ orgId: 1, nameOfficial: "Alpha University" }),
    entry({ orgId: 1, nameOfficial: "Alpha University" }),
    null,
  ]);
  assert.deepEqual(
    list.map((c) => c.name),
    ["Alpha University", "Zeta College"],
  );
  assert.ok(list.every(isCollege));
  assert.deepEqual(parseNcaaDirectory({ error: true }), []);
});

test("normalizes athletics sites to bare hosts", () => {
  assert.equal(normalizeSite("HTTP://www.Example-Bears.com/sports"), "example-bears.com");
  assert.equal(normalizeSite("not a host"), null);
  assert.equal(normalizeSite(null), null);
});

const schools: College[] = [
  {
    id: "a",
    name: "Ohio State University",
    division: "I",
    subdivision: "FBS",
    conference: "Big Ten",
    state: "OH",
    site: null,
    hbcu: false,
  },
  {
    id: "b",
    name: "Howard University",
    division: "I",
    subdivision: "FCS",
    conference: "MEAC",
    state: "DC",
    site: null,
    hbcu: true,
  },
  {
    id: "c",
    name: "Gallaudet University",
    division: "III",
    subdivision: null,
    conference: "United East",
    state: "DC",
    site: "gallaudetbison.com",
    hbcu: false,
  },
];

test("filters by name words, division, football level and conference", () => {
  assert.deepEqual(
    filterColleges(schools, { q: "state ohio" }).map((c) => c.id),
    ["a"],
  );
  assert.deepEqual(
    filterColleges(schools, { q: "bison" }).map((c) => c.id),
    ["c"],
  );
  assert.deepEqual(
    filterColleges(schools, { division: "I", subdivision: "FCS" }).map((c) => c.id),
    ["b"],
  );
  assert.deepEqual(
    filterColleges(schools, { conference: "Big Ten" }).map((c) => c.id),
    ["a"],
  );
  assert.equal(filterColleges(schools, {}).length, 3);
});

test("lists conferences with counts per division", () => {
  assert.deepEqual(conferencesFor(schools, "I"), [
    { name: "Big Ten", schools: 1 },
    { name: "MEAC", schools: 1 },
  ]);
  assert.equal(conferencesFor(schools, null).length, 3);
});

test("monograms skip small words", () => {
  assert.equal(monogram("Gallaudet University"), "GU");
  assert.equal(monogram("University of North Carolina at Pembroke"), "UNCP");
  assert.equal(monogram("Bowdoin"), "BOW");
});
