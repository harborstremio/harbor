import { readFile, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";

const localesDir = resolve("src/lib/i18n/locales");
const languages = (await readdir(localesDir))
  .filter((file) => extname(file) === ".json")
  .map((file) => file.slice(0, -".json".length))
  .sort((a, b) => (a === "en" ? -1 : b === "en" ? 1 : a.localeCompare(b)));
const catalogs = Object.fromEntries(
  await Promise.all(
    languages.map(async (language) => {
      const json = await readFile(resolve(localesDir, `${language}.json`), "utf8");
      return [language, JSON.parse(json)];
    }),
  ),
);

function placeholders(value) {
  return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]).sort();
}

const errors = [];
if (!("en" in catalogs)) errors.push("locales/en.json is required as the source catalog");
for (const [language, catalog] of Object.entries(catalogs)) {
  if (!catalog || Array.isArray(catalog) || typeof catalog !== "object") {
    errors.push(`${language}.json must contain one object`);
    continue;
  }
  for (const [key, value] of Object.entries(catalog)) {
    if (typeof value !== "string") {
      errors.push(`${language}.json: ${JSON.stringify(key)} must map to a string`);
      continue;
    }
    if (language === "en") continue;
    if (!catalogs.en) continue;
    if (!(key in catalogs.en)) {
      errors.push(`${language}.json: ${JSON.stringify(key)} is missing from en.json`);
      continue;
    }
    const expected = placeholders(catalogs.en[key]);
    const actual = placeholders(value);
    if (expected.join("\0") !== actual.join("\0")) {
      errors.push(
        `${language}.json: ${JSON.stringify(key)} placeholders [${actual}] do not match English [${expected}]`,
      );
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const counts = Object.entries(catalogs)
    .map(([language, catalog]) => `${language} ${Object.keys(catalog).length}`)
    .join(", ");
  console.log(`Valid catalogs: ${counts} strings.`);
}
