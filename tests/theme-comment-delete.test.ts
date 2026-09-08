// @ts-expect-error Node test types are outside browser config.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside browser config.
import { beforeEach, test } from "node:test";
// @ts-expect-error Node test types are outside browser config.
import { registerHooks } from "node:module";
// @ts-expect-error Node test types are outside browser config.
import { readFileSync } from "node:fs";
const endpoint = new URL("../src/lib/config/endpoints.ts", import.meta.url).href;
const themeAuth = new URL("../src/lib/theme-auth.ts", import.meta.url).href;
const unrelatedThemeModules = new Map([
  [
    new URL("../src/lib/custom-themes.ts", import.meta.url).href,
    ["getCustomThemes", "parseThemeJson", "saveCustomTheme"],
  ],
  [new URL("../src/lib/theme-scan.ts", import.meta.url).href, ["scanTheme"]],
  [
    new URL("../src/lib/theme-updates.ts", import.meta.url).href,
    ["getDownloadRecords", "recordDownloadedTheme"],
  ],
]);
const hook = registerHooks({
  load(url, context, nextLoad) {
    if (url === themeAuth)
      return {
        format: "module",
        shortCircuit: true,
        source: "export const authToken = () => globalThis.fixtureToken;",
      };
    const exports = unrelatedThemeModules.get(url);
    if (exports)
      return {
        format: "module",
        shortCircuit: true,
        source: exports
          .map(
            (name) =>
              `export function ${name}() { throw new Error('Unrelated theme operation in comment test'); }`,
          )
          .join("\n"),
      };
    return url === endpoint
      ? {
          format: "module-typescript",
          shortCircuit: true,
          source: `import.meta.env = {};\n${readFileSync(new URL(url), "utf8")}`,
        }
      : nextLoad(url, context);
  },
});
const comments = await import("../src/lib/theme-comment-actions.ts");
hook.deregister();
let values: Map<string, string>;
let canDelete = true;
let failDelete = false;
let beforeReply = () => {};
let deletions: string[];
const profile = { activeId: "a", settingsLinked: false };
beforeEach(() => {
  globalThis.fixtureToken = "fixture";
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { hostname: "fixture.invalid", origin: "https://fixture.invalid" } },
  });
  values = new Map([
    [
      "harbor.profiles.v1",
      JSON.stringify({ activeId: "a", profiles: [{ id: "a", settingsLinked: false }] }),
    ],
  ]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => values.get(key) ?? null },
  });
  canDelete = true;
  failDelete = false;
  beforeReply = () => {};
  deletions = [];
  globalThis.fetch = async (url, init) => {
    if (init?.method === "POST") {
      deletions.push(String(url));
      return new Response("", { status: failDelete ? 500 : 200 });
    }
    beforeReply();
    return new Response(
      JSON.stringify({ comments: [{ id: "comment", themeId: "theme", canDelete, body: "body" }] }),
    );
  };
});
const remove = () => {
  assert.equal(typeof comments.deleteThemeCommentAcknowledged, "function");
  return comments.deleteThemeCommentAcknowledged({
    themeId: "theme",
    commentId: "comment",
    profile,
    token: "fixture",
  });
};
test("theme comment deletion rechecks server permission and awaits its exact delete request", async () => {
  await remove();
  assert.equal(deletions.length, 1);
  assert.match(deletions[0], /\/themes\/theme\/comments\/comment\/delete$/);
  canDelete = false;
  await assert.rejects(remove(), /permission|allowed/i);
  assert.equal(deletions.length, 1);
});
test("theme comment deletion propagates failure and rejects a changed profile or account", async () => {
  failDelete = true;
  await assert.rejects(remove(), /delete/i);
  failDelete = false;
  beforeReply = () => {
    globalThis.fixtureToken = "other";
  };
  await assert.rejects(remove(), /account|profile/i);
  assert.equal(deletions.length, 1);
  globalThis.fixtureToken = "fixture";
  beforeReply = () =>
    values.set(
      "harbor.profiles.v1",
      JSON.stringify({ activeId: "b", profiles: [{ id: "b", settingsLinked: false }] }),
    );
  await assert.rejects(remove(), /account|profile/i);
  assert.equal(deletions.length, 1);
});
