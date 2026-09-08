// @ts-expect-error Node test types are outside the browser config.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser config.
import { beforeEach, test } from "node:test";
// @ts-expect-error Node test types are outside the browser config.
import { registerHooks } from "node:module";

const replacements = new Map([
  [
    new URL("../src/lib/safe-fetch.ts", import.meta.url).href,
    "export const safeFetch = (...args) => globalThis.commentFetch(...args);",
  ],
  [
    new URL("../src/lib/theme-auth.ts", import.meta.url).href,
    "export const authToken = () => 'fixture'; export const currentAuthor = () => ({handle:'owner'}); export const refreshToken = async () => false;",
  ],
  [
    new URL("../src/lib/config/endpoints.ts", import.meta.url).href,
    "export const HARBOR_API_BASE = 'https://fixture.invalid';",
  ],
]);
const hook = registerHooks({
  load(url, context, next) {
    return replacements.has(url)
      ? { format: "module", shortCircuit: true, source: replacements.get(url) }
      : next(url, context);
  },
});
const { setCommentLike, deleteComment } = await import("../src/views/profile/profile-api.ts");
hook.deregister();
let status: number;
let body: unknown;
let requests: Array<{ url: string; method: string }>;
beforeEach(() => {
  status = 200;
  body = { liked: true, likeCount: 1 };
  requests = [];
  globalThis.commentFetch = async (url, init) => {
    requests.push({ url, method: init.method });
    return new Response(JSON.stringify(body), { status });
  };
});

test("comment liking accepts only an acknowledged state and targets the exact escaped comment", async () => {
  assert.deepEqual(await setCommentLike("profile/a", "comment/b", true), body);
  assert.match(requests[0].url, /\/u\/profile%2Fa\/comments\/comment%2Fb\/like$/);
  assert.equal(requests[0].method, "POST");
  for (const invalid of [
    { liked: false, likeCount: 1 },
    { liked: true, likeCount: -1 },
    { liked: true },
    null,
  ]) {
    body = invalid;
    await assert.rejects(setCommentLike("a", "b", true), /confirmed/);
  }
  body = { liked: false, likeCount: 0 };
  assert.deepEqual(await setCommentLike("a", "b", false), body);
  assert.equal(requests.at(-1)?.method, "DELETE");
});

test("failed comment deletion and liking propagate server rejection rather than acknowledge success", async () => {
  status = 403;
  await assert.rejects(deleteComment("owner", "comment/id"));
  assert.match(requests[0].url, /\/u\/owner\/comments\/comment%2Fid$/);
  assert.equal(requests[0].method, "DELETE");
  await assert.rejects(setCommentLike("owner", "comment/id", true));
});
