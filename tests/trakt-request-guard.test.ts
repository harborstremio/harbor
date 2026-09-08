// @ts-expect-error Node types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node types are outside the browser tsconfig.
import test from "node:test";
import ts from "typescript";

for (const refreshStatus of [200, 400])
  test(`a Trakt ${refreshStatus} token refresh cannot replace a newer session`, async () => {
    const original = { accessToken: "old", refreshToken: "old-refresh", username: "old" };
    const newer = { accessToken: "new", refreshToken: "new-refresh", username: "new" };
    let session = original;
    let requests = 0;
    let sessionWrites = 0;
    const module = { exports: {} };
    const output = ts.transpileModule(
      readFileSync(new URL("../src/lib/trakt/client.ts", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    ).outputText;
    new Function("require", "module", "exports", "fetch", output)(
      (name: string) =>
        name === "./config"
          ? {
              TRAKT_API_BASE: "https://fixture.invalid",
              TRAKT_TOKEN_PROXY: "https://fixture.invalid/token",
            }
          : {
              getSession: () => session,
              setSession: () => {
                sessionWrites++;
              },
            },
      module,
      module.exports,
      async () => {
        requests++;
        if (requests === 1) return new Response("{}", { status: 401 });
        session = newer;
        return new Response(
          JSON.stringify({
            access_token: "refreshed-old",
            refresh_token: "refreshed-old",
            created_at: 1,
            expires_in: 100,
          }),
          { status: refreshStatus },
        );
      },
    );
    const { traktRequest } = module.exports as typeof import("../src/lib/trakt/client.ts");
    await assert.rejects(() =>
      traktRequest("/sync/history", {
        method: "POST",
        body: { movies: [] },
        assertCurrent: () => {
          if (session !== original) throw new Error("account changed");
        },
      }),
    );
    assert.equal(sessionWrites, 0);
    assert.equal(session, newer);
  });

for (const status of [401, 429])
  test(`a Trakt ${status} retry cannot switch to the current account`, async () => {
    let current = true;
    let requests = 0;
    const module = { exports: {} };
    const output = ts.transpileModule(
      readFileSync(new URL("../src/lib/trakt/client.ts", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    ).outputText;
    new Function("require", "module", "exports", "fetch", "setTimeout", output)(
      (name: string) =>
        name === "./config"
          ? {
              TRAKT_API_BASE: "https://fixture.invalid",
              TRAKT_TOKEN_PROXY: "https://fixture.invalid/token",
            }
          : {
              getSession: () => ({
                accessToken: "fixture",
                refreshToken: "fixture",
                username: "fixture",
              }),
              setSession: () => {},
            },
      module,
      module.exports,
      async () => {
        requests++;
        current = false;
        return new Response("{}", { status: requests === 1 ? status : 200 });
      },
      (callback: () => void) => queueMicrotask(callback),
    );
    const { traktRequest } = module.exports as typeof import("../src/lib/trakt/client.ts");
    await assert.rejects(
      () =>
        traktRequest("/sync/history", {
          method: "POST",
          body: { movies: [] },
          assertCurrent: () => {
            if (!current) throw new Error("account changed");
          },
        }),
      /account changed/,
    );
    assert.equal(requests, 1);
  });
