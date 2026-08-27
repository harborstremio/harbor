// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { generateCsmSlugs, parseCsmHtml } from "../src/lib/providers/csm-parser.ts";

test("CSM parser rejects an HTML page without advisory evidence", () => {
  assert.equal(parseCsmHtml("<html><body>This is not a review page.</body></html>"), null);
});

test("CSM parser preserves explicit zero category scores", () => {
  const advisory = parseCsmHtml(`
    <script>
      {"amplitude_props":{"csm_review_rating_age":8,"csm_review_rating_details_violence":0,"csm_review_rating_details_sex":1,"csm_review_rating_details_language":2,"csm_review_rating_details_drugs":3,"csm_user_member_type":"guest"}}
    </script>
  `);

  assert.equal(advisory?.ageRating, "8+");
  assert.deepEqual(
    advisory?.categories.map(({ severity }) => severity),
    ["None", "Mild", "Mild", "Moderate"],
  );
});

test("CSM slug candidates are unique and include title/year variants", () => {
  const slugs = generateCsmSlugs("The Rock & Roll: Story", 2024);

  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(slugs.includes("the-rock-and-roll-story"));
  assert.ok(slugs.includes("the-rock-and-roll-story-2024"));
  assert.ok(slugs.includes("rock-and-roll-story"));
});
