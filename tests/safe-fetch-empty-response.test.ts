import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function nativeFetch(status: number, body = "") {
  const source = readFileSync("src/lib/safe-fetch.ts", "utf8");
  const ast = ts.createSourceFile("safe-fetch.ts", source, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(
    (node) =>
      ts.isFunctionDeclaration(node) &&
      ["tauriHarborFetch", "base64ToBytes"].includes(node.name?.text ?? ""),
  );
  assert.equal(functions.length, 2);
  const code = ts.transpileModule(functions.map((node) => node.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function("invokeHarborFetch", "FINAL_URL_HEADER", `${code}; return tauriHarborFetch;`)(
    async () => ({ status, body, headers: { "x-fixture": "native" }, url: "https://example.com" }),
    "x-harbor-final-url",
  );
}

test("native bodyless responses preserve success and cache statuses without throwing", async () => {
  for (const status of [204, 205, 304]) {
    for (const type of [undefined, "base64"]) {
      const response = await nativeFetch(status)("https://example.com", undefined, type);
      assert.equal(response.status, status);
      assert.equal(response.body, null);
      assert.equal(await response.text(), "");
      assert.equal(response.headers.get("x-fixture"), "native");
    }
  }
});

test("native HEAD responses have no body, and regular response bytes are retained", async () => {
  const head = await nativeFetch(200)("https://example.com", { method: "HEAD" });
  assert.equal(head.body, null);
  const get = await nativeFetch(200, "fixture")("https://example.com");
  assert.equal(await get.text(), "fixture");
  const binary = await nativeFetch(200, "Zml4dHVyZQ==")("https://example.com", undefined, "base64");
  assert.equal(await binary.text(), "fixture");
});
