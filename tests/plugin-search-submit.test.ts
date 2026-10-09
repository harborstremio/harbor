import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const VIEW = readFileSync("src/views/plugins.tsx", "utf8");

test("a search runs when it is submitted, not as the box is typed in", () => {
  assert.match(
    VIEW,
    /const submitSearch = \(\) => \{[\s\S]{0,80}?setAsked\(query\.trim\(\)\);/,
    "the submitted term is taken from the box at the moment it is asked for",
  );
  assert.match(
    VIEW,
    /onSubmit=\{\(e\) => \{[\s\S]{0,80}?e\.preventDefault\(\);[\s\S]{0,40}?submitSearch\(\);/,
    "the box is a form, so Enter submits it",
  );
  assert.match(VIEW, /\}, \[asked, askRun\]\);/, "an ask, not the text, drives the search");
  assert.ok(
    !/SEARCH_DEBOUNCE_MS/.test(VIEW),
    "nothing searches on a typing pause any more, which is what made an unanswered search " +
      "look like an answered one",
  );
});

test("the box's text is not what was asked for", () => {
  assert.match(VIEW, /const \[asked, setAsked\] = useState\(""\)/);
  assert.match(VIEW, /const \[askRun, setAskRun\] = useState\(0\)/);
  assert.match(
    VIEW,
    /title: t\("Results for \{q\}", \{ q: asked \}\)/,
    "the heading names the title that was searched, not the one being typed",
  );
  assert.match(VIEW, /\{asked \? \(/, "the results view is the submitted ask");
  assert.match(
    VIEW,
    /\{!loading && catalogs\.length > 0 && !asked && \(/,
    "the hero returns once nothing has been asked for",
  );
});

test("the last title's rows are dropped as a new search starts", () => {
  assert.match(
    VIEW,
    /const gen = \+\+searchGen\.current;[\s\S]{0,40}?setResults\(null\);/,
    "the previous title's rows are not an answer to this one",
  );
});

test("the clear button does not submit the form it now sits in", () => {
  assert.match(
    VIEW,
    /type="button"[\s\S]{0,60}?onClick=\{clearSearch\}/,
    "a bare button inside a form submits it",
  );
  assert.match(
    VIEW,
    /const clearSearch = \(\) => \{[\s\S]{0,60}?setQuery\(""\);[\s\S]{0,40}?setAsked\(""\);/,
    "clearing the box clears the search with it",
  );
});
