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
    "export const authToken = () => globalThis.commentAuth.token; export const currentAuthor = () => ({id:globalThis.commentAuth.author,handle:'owner'}); export const refreshToken = () => globalThis.commentRefresh();",
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
  globalThis.commentAuth = { token: "fixture-old", author: "owner" };
  globalThis.commentRefresh = async () => false;
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

test("comment deletion refreshes a rejected session once and retries the same target with the new credentials", async () => {
  let refreshes = 0;
  const seen = [];
  globalThis.commentRefresh = async () => {
    refreshes++;
    globalThis.commentAuth.token = "fixture-new";
    return true;
  };
  globalThis.commentFetch = async (url, init) => {
    seen.push({ url, method: init.method, auth: init.headers.authorization });
    return new Response(null, { status: seen.length === 1 ? 401 : 204 });
  };
  await deleteComment("owner", "comment/id");
  assert.equal(refreshes, 1);
  assert.deepEqual(
    seen.map((entry) => entry.method),
    ["DELETE", "DELETE"],
  );
  assert.equal(seen[0].url, seen[1].url);
  assert.deepEqual(
    seen.map((entry) => entry.auth),
    ["Bearer fixture-old", "Bearer fixture-new"],
  );
});

test("repeated 401 and 403 responses remain actionable failures and cannot loop refresh", async () => {
  let refreshes = 0;
  globalThis.commentRefresh = async () => {
    refreshes++;
    return true;
  };
  status = 401;
  await assert.rejects(deleteComment("owner", "comment/id"), /sign in/i);
  assert.equal(requests.length, 2);
  assert.equal(refreshes, 1);
  status = 403;
  await assert.rejects(deleteComment("owner", "comment/id"), /permission/i);
  assert.equal(refreshes, 1);
});

test("changing account before or during 401 refresh never sends a retry as the new actor", async () => {
  for (const phase of ["request", "refresh"]) {
    globalThis.commentAuth = { token: "fixture-old", author: "owner" };
    let calls = 0;
    globalThis.commentFetch = async () => {
      calls++;
      if (phase === "request") globalThis.commentAuth.author = "different";
      return new Response(null, { status: 401 });
    };
    globalThis.commentRefresh = async () => {
      globalThis.commentAuth.author = "different";
      return true;
    };
    await assert.rejects(deleteComment("owner", "comment/id"), /profile changed/i);
    assert.equal(calls, 1);
  }
});
