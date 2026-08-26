import assert from "node:assert/strict";
import test from "node:test";
import {
  advisoryCategoryLabel,
  normalizeAdvisorySeverity,
  normalizeContentAdvisories,
  parseImdbParentsGuideResponse,
} from "../src/lib/content-advisory.ts";

test("content advisory accepts severity values regardless of API casing", () => {
  assert.equal(normalizeAdvisorySeverity(" severe "), "Severe");
  assert.equal(normalizeAdvisorySeverity("MODERATE"), "Moderate");
  assert.equal(normalizeAdvisorySeverity("none"), null);
});

test("content advisory sorts accepted categories by severity", () => {
  const advisories = normalizeContentAdvisories([
    { category: "Profanity", severity: "moderate" },
    { category: "Violence", severity: "SEVERE" },
    { category: "Alcohol & Drugs", severity: "mild" },
    { category: "Nudity", severity: "None" },
  ]);
  assert.deepEqual(
    advisories.map((advisory) => [advisory.category, advisory.severity]),
    [
      ["Violence", "Severe"],
      ["Profanity", "Moderate"],
      ["Alcohol & Drugs", "Mild"],
    ],
  );
});

test("content advisory uses one label taxonomy everywhere", () => {
  assert.equal(advisoryCategoryLabel("Nudity"), "Sex & Nudity");
  assert.equal(advisoryCategoryLabel("Drug use"), "Alcohol & Drugs");
  assert.equal(advisoryCategoryLabel("Unknown category"), "Unknown category");
});

test("content advisory parses IMDb GraphQL parents guide responses", () => {
  assert.deepEqual(
    parseImdbParentsGuideResponse({
      data: {
        title: {
          parentsGuide: {
            categories: [
              { category: { text: "Violence & Gore" }, severity: { text: "Moderate" } },
              { category: { text: "Profanity" }, severity: { text: "Mild" } },
              { category: { text: "Broken" }, severity: null },
            ],
          },
        },
      },
    }),
    [
      { category: "Violence & Gore", severity: "Moderate" },
      { category: "Profanity", severity: "Mild" },
    ],
  );
  assert.deepEqual(parseImdbParentsGuideResponse({ data: { title: null } }), []);
});
