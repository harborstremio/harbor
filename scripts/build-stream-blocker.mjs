import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import ts from "typescript";

const blocklistUrl = new URL("../src/lib/privacy/blocklist.ts", import.meta.url);
const rulesUrl = new URL("../src-tauri/resources/harbor-stream-blocker/rules.json", import.meta.url);
const PROVIDERS = ["twitch.tv", "kick.com"];
// Preserve the provider-specific ad host in the original bundled rules.
const PROVIDER_AD_HOSTS = ["amazon-adsystem.com"];
// The broadcast bundle excludes broad service/authentication hosts from the app blocklist.
const PROVIDER_EXCLUSIONS = new Set(["graph.facebook.com", "yandex.ru"]);
const PLAYER_HOSTS = [...PROVIDERS, "ttvnw.net", "jtvnw.net", "twitchcdn.net", "live-video.net", "kickstatic.com", "cloudfront.net"];

/** Compile literal domains only; do not execute the application's privacy module. */
export function buildStreamBlockerRules(source) {
  const file = ts.createSourceFile("blocklist.ts", source, ts.ScriptTarget.Latest, true);
  const domains = new Set(PROVIDER_AD_HOSTS);
  const found = new Set();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
      && ["BLOCKED_HOSTS", "BLOCKED_SUFFIXES"].includes(node.name.text)) {
      const init = node.initializer;
      const values = init && ts.isNewExpression(init) ? init.arguments?.[0] : init;
      if (!values || !ts.isArrayLiteralExpression(values)) throw new Error(`Expected literal ${node.name.text}`);
      found.add(node.name.text);
      for (const entry of values.elements) {
        if (!ts.isStringLiteral(entry)) throw new Error("Blocker domains must be string literals");
        const domain = entry.text.replace(/^\./, "").toLowerCase();
        if (PROVIDER_EXCLUSIONS.has(domain)) continue;
        if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) || !domain.includes(".")) {
          throw new Error(`Invalid blocker domain: ${entry.text}`);
        }
        if (PLAYER_HOSTS.some((host) => host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`))) {
          throw new Error(`Refusing to block a player or media host: ${domain}`);
        }
        domains.add(domain);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (found.size !== 2 || !domains.size) throw new Error("Harbor privacy domain lists were not found");
  return [...domains].sort().map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `||${domain}^`,
      initiatorDomains: [...PROVIDERS],
      excludedResourceTypes: ["main_frame"],
    },
  }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rules = buildStreamBlockerRules(readFileSync(blocklistUrl, "utf8"));
  if (process.argv.includes("--check")) {
    const bundled = JSON.parse(readFileSync(rulesUrl, "utf8"));
    if (JSON.stringify(bundled) !== JSON.stringify(rules)) {
      throw new Error("Bundled stream-blocker rules are stale. Run node scripts/build-stream-blocker.mjs");
    }
    console.log(`Stream-blocker rules verified: ${rules.length} provider-scoped domains`);
  } else {
    writeFileSync(rulesUrl, `${JSON.stringify(rules, null, 2)}\n`);
    console.log(`Generated ${rules.length} provider-scoped stream-blocker rules`);
  }
}
