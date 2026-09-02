// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import "./_localstorage-stub.ts";

// profile-import's only dependency is four storage-key helpers. Loading that
// dependency normally pulls image assets through settings defaults, which the
// lightweight Node test loader intentionally does not transform. Compile the
// real module with equivalent key helpers so these remain behavioral tests.
const profileImportSource = readFileSync(
  new URL("../src/lib/profile-import.ts", import.meta.url),
  "utf8",
).replace(
  /^import[^\n]+profile-store";\r?\n/,
  `const MIRROR_KEY = "harbor.settings";
const SHARED_KEY = "harbor.settings.shared";
const profileKey = (id: string) => \`harbor.settings.\${id}\`;
const sourceKeyFor = (id: string, linked: boolean) => linked ? SHARED_KEY : profileKey(id);
`,
);
const compiledProfileImport = ts.transpileModule(profileImportSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const profileImportModule = await import(
  `data:text/javascript;charset=utf-8,${encodeURIComponent(compiledProfileImport)}`
);
const importDomains = profileImportModule.importDomains as (
  fromProfileId: string,
  toProfileId: string,
  domains: string[],
  opts?: {
    addonTransportUrls?: string[] | null;
    choices?: Record<string, "merge" | "replace">;
  },
) => void;

const installedKey = (profileId: string) => `harbor.installed-addons.${profileId}`;
const disabledKey = (profileId: string) => `harbor.addons.disabled.${profileId}`;

type Addon = { id: string; transportUrl: string };

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function read<T>(key: string): T {
  const value = localStorage.getItem(key);
  assert.notEqual(value, null, `${key} should have been written`);
  return JSON.parse(value as string) as T;
}

function addon(id: string, transportUrl: string): Addon {
  return { id, transportUrl };
}

test("addon subset merge preserves legacy disabled IDs and URLs", () => {
  const source = "pr1347-merge-source";
  const target = "pr1347-merge-target";
  const idUrl = "https://addons.test/source-disabled-by-id/manifest.json";
  const directUrl = "https://addons.test/source-disabled-by-url/manifest.json";
  const skippedUrl = "https://addons.test/source-unselected/manifest.json";
  const targetIdUrl = "https://addons.test/target-disabled-by-id/manifest.json";
  const targetDirectUrl = "https://addons.test/target-disabled-by-url/manifest.json";

  write(installedKey(source), [
    addon("source-disabled-by-id", idUrl),
    addon("source-disabled-by-url", directUrl),
    addon("source-unselected", skippedUrl),
  ]);
  write(disabledKey(source), ["source-disabled-by-id", directUrl, "source-unselected"]);
  write(installedKey(target), [
    addon("target-disabled-by-id", targetIdUrl),
    addon("target-disabled-by-url", targetDirectUrl),
  ]);
  write(disabledKey(target), ["target-disabled-by-id", targetDirectUrl]);

  importDomains(source, target, ["addons"], {
    addonTransportUrls: [idUrl, directUrl],
    choices: { addons: "merge" },
  });

  assert.deepEqual(
    read<Addon[]>(installedKey(target)).map((entry) => entry.transportUrl),
    [targetIdUrl, targetDirectUrl, idUrl, directUrl],
  );
  assert.deepEqual(read<unknown[]>(disabledKey(target)), [
    "target-disabled-by-id",
    targetDirectUrl,
    "source-disabled-by-id",
    directUrl,
  ]);
});

test("addon subset replace preserves selected legacy disabled IDs and URLs", () => {
  const source = "pr1347-replace-source";
  const target = "pr1347-replace-target";
  const sharedUrl = "https://addons.test/shared/manifest.json";
  const idUrl = "https://addons.test/replacement-disabled-by-id/manifest.json";
  const directUrl = "https://addons.test/replacement-disabled-by-url/manifest.json";
  const skippedUrl = "https://addons.test/replacement-unselected/manifest.json";

  write(installedKey(source), [
    addon("shared-source", sharedUrl),
    addon("replacement-disabled-by-id", idUrl),
    addon("replacement-disabled-by-url", directUrl),
    addon("replacement-unselected", skippedUrl),
  ]);
  write(disabledKey(source), ["replacement-disabled-by-id", directUrl, "replacement-unselected"]);
  write(installedKey(target), [
    addon("shared-target", sharedUrl),
    addon("target-only", "https://addons.test/target-only/manifest.json"),
  ]);
  write(disabledKey(target), ["target-only"]);

  importDomains(source, target, ["addons"], {
    addonTransportUrls: [sharedUrl, idUrl, directUrl],
    choices: { addons: "replace" },
  });

  assert.deepEqual(
    read<Addon[]>(installedKey(target)).map((entry) => entry.transportUrl),
    [sharedUrl, idUrl, directUrl],
  );
  assert.deepEqual(read<unknown[]>(disabledKey(target)), ["replacement-disabled-by-id", directUrl]);
});

test("replace becomes a non-destructive merge when the selected addon subset has no overlap", () => {
  const source = "pr1347-zero-overlap-source";
  const target = "pr1347-zero-overlap-target";
  const sourceUrl = "https://addons.test/new-source/manifest.json";
  const targetUrl = "https://addons.test/existing-target/manifest.json";

  write(installedKey(source), [addon("new-source", sourceUrl)]);
  write(disabledKey(source), ["new-source"]);
  write(installedKey(target), [addon("existing-target", targetUrl)]);
  write(disabledKey(target), ["existing-target"]);

  importDomains(source, target, ["addons"], {
    addonTransportUrls: [sourceUrl],
    choices: { addons: "replace" },
  });

  assert.deepEqual(
    read<Addon[]>(installedKey(target)).map((entry) => entry.transportUrl),
    [targetUrl, sourceUrl],
    "a replace choice should not erase unrelated target addons",
  );
  assert.deepEqual(read<unknown[]>(disabledKey(target)), ["existing-target", "new-source"]);
});
