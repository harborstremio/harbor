import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("eBook cards label audiobook items", async () => {
  const [api, providers, view] = await Promise.all([
    readFile(new URL("../src/lib/ebook/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/ebook/providers.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/views/ebook.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(api, /audiobook\?: boolean/);
  assert.match(providers, /audiobook: book\.audioPaths\.length > 0/);
  assert.match(providers, /provider\.audiobook = methods\.has\("audiobookChapters"\)/);
  assert.match(providers, /provider\.audiobook/);
  assert.match(view, /ebook\.audiobook && <EBookAudiobookMark/);
  assert.match(view, /<div className="relative">\s*<EBookBook3D/);
  assert.match(view, /<\/EBookBook3D>\s*\{ebook\.audiobook/);
});
