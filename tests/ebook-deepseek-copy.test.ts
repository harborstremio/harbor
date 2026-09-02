import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile(
  new URL("../src/views/ebook/ebook-sources-panel.tsx", import.meta.url),
  "utf8",
);
const capabilities = await readFile(
  new URL("../src-tauri/capabilities/default.json", import.meta.url),
  "utf8",
);

test("DeepSeek settings explain API-key translation and link the platform", () => {
  assert.match(panel, /Use your API key to Translate Chapters to Your Language/);
  assert.match(panel, /href="https:\/\/platform\.deepseek\.com\/"/);
  assert.match(panel, />\s*DeepSeek Platform\s*</);
  assert.doesNotMatch(panel, /Uses your DeepSeek account and the selected DeepSeek model/);
});

test("desktop capabilities permit the DeepSeek external link", () => {
  assert.match(capabilities, /"opener:allow-open-url"/);
  assert.match(capabilities, /"shell:allow-open"/);
});
