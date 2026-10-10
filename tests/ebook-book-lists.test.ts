import assert from "node:assert/strict";
import test from "node:test";
import {
  awardsForBook,
  awardListEntries,
  bookListById,
  BOOK_AWARD_LISTS,
  BOOK_SUBJECT_LISTS,
  normalizeBookTitle,
} from "../src/lib/ebook/book-lists";

test("every seeded list is addressable by its own id", () => {
  for (const list of [...BOOK_AWARD_LISTS, ...BOOK_SUBJECT_LISTS]) {
    assert.equal(bookListById(list.id)?.id, list.id, list.id);
  }
  assert.equal(bookListById("not-a-list"), undefined);
});

test("no two lists share an id", () => {
  const ids = [...BOOK_AWARD_LISTS, ...BOOK_SUBJECT_LISTS].map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("a seeded count matches the winners actually listed", () => {
  for (const list of BOOK_AWARD_LISTS) {
    assert.equal(list.expectedCount, list.entries.length, list.id);
    assert.ok(list.entries.length > 0, list.id);
  }
});

test("a book is credited with every prize it actually won", () => {
  assert.deepEqual(awardsForBook("Dune", ["Frank Herbert"]), ["Hugo Award for Best Novel (1966)"]);
  const demon = awardsForBook("Demon Copperhead", ["Barbara Kingsolver"]);
  assert.equal(demon.length, 2, "Pulitzer and Women's Prize");
  assert.ok(demon.some((a) => a.startsWith("Pulitzer")));
  assert.ok(demon.some((a) => a.startsWith("Women's Prize")));
});

test("a different author's same-titled book is not credited", () => {
  assert.deepEqual(awardsForBook("Dune", ["Someone Else"]), []);
});

test("a book that won nothing gets nothing", () => {
  assert.deepEqual(awardsForBook("A Book Nobody Wrote", ["Nobody"]), []);
});

test("subtitles, punctuation and accents do not lose a match", () => {
  assert.equal(normalizeBookTitle("Dune: Book One"), "dune");
  assert.equal(normalizeBookTitle("The Remains of the Day"), "the remains of the day");
  assert.equal(normalizeBookTitle("Hamnet  "), "hamnet");
  assert.deepEqual(awardsForBook("Hamnet (A Novel)", ["Maggie O'Farrell"]), [
    "Women's Prize for Fiction (2020)",
  ]);
});

test("an apostrophe spelled either way still matches", () => {
  assert.deepEqual(awardsForBook("Midnight's Children", ["Salman Rushdie"]), [
    "The Booker Prize (1981)",
  ]);
  assert.deepEqual(awardsForBook("Midnight’s Children", ["Salman Rushdie"]), [
    "The Booker Prize (1981)",
  ]);
});

test("entries are reachable per list and unknown ids stay empty", () => {
  assert.ok(awardListEntries("booker-prize").length > 10);
  assert.deepEqual(awardListEntries("classics"), []);
});
