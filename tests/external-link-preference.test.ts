import assert from "node:assert/strict";
import test from "node:test";
import {
  readExternalLinkDestinationPreference,
  resolveExternalLinkActionLayout,
  writeExternalLinkDestinationPreference,
  type ExternalLinkPreferenceStorage,
} from "../src/lib/social/external-link-preference.ts";

function memoryStorage(initial: string | null = null): ExternalLinkPreferenceStorage {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}

test("defaults invalid or unavailable storage to browser", () => {
  assert.equal(readExternalLinkDestinationPreference(null), "browser");
  assert.equal(readExternalLinkDestinationPreference(memoryStorage("unknown")), "browser");
  assert.equal(
    readExternalLinkDestinationPreference({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    }),
    "browser",
  );
});

test("round-trips browser and Harbor without throwing on write failure", () => {
  for (const preference of ["browser", "harbor"] as const) {
    const storage = memoryStorage();
    writeExternalLinkDestinationPreference(preference, storage);
    assert.equal(readExternalLinkDestinationPreference(storage), preference);
  }
  assert.doesNotThrow(() =>
    writeExternalLinkDestinationPreference("harbor", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    }),
  );
});

test("resolves one direct action and one eligible alternate", () => {
  assert.deepEqual(resolveExternalLinkActionLayout("browser", true), {
    main: "browser",
    alternate: "harbor",
  });
  assert.deepEqual(resolveExternalLinkActionLayout("harbor", true), {
    main: "harbor",
    alternate: "browser",
  });
  assert.deepEqual(resolveExternalLinkActionLayout("harbor", false), {
    main: "browser",
    alternate: null,
  });
});

test("HTTP fallback does not overwrite a stored Harbor preference", () => {
  const storage = memoryStorage("harbor");
  const preference = readExternalLinkDestinationPreference(storage);
  assert.deepEqual(resolveExternalLinkActionLayout(preference, false), {
    main: "browser",
    alternate: null,
  });
  assert.equal(readExternalLinkDestinationPreference(storage), "harbor");
});

test("alternate selections become the next main action in both directions", () => {
  const storage = memoryStorage();
  assert.deepEqual(
    resolveExternalLinkActionLayout(readExternalLinkDestinationPreference(storage), true),
    {
      main: "browser",
      alternate: "harbor",
    },
  );
  writeExternalLinkDestinationPreference("harbor", storage);
  assert.deepEqual(
    resolveExternalLinkActionLayout(readExternalLinkDestinationPreference(storage), true),
    {
      main: "harbor",
      alternate: "browser",
    },
  );
  writeExternalLinkDestinationPreference("browser", storage);
  assert.deepEqual(
    resolveExternalLinkActionLayout(readExternalLinkDestinationPreference(storage), true),
    {
      main: "browser",
      alternate: "harbor",
    },
  );
});
