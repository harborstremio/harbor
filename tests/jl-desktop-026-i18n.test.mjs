import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// The 108 UI literals added by the desktop 0.9.26 work, compared with 33702fbe.
// Existing catalog gaps are intentionally outside this release regression test.
const keys = [
  "Sharing {name}'s addon setup",
  "Local JL profile",
  "Offline Room",
  "Your library and addons work locally. Sign in to use JL account features.",
  "Continue locally",
  "Choose your JL profile to sync supported preferences, favorites, library and progress. Device files and configured addon URLs stay on this device.",
  "Sign-out could not be saved. Free some storage and try again.",
  "Sign in to your JL Media Vision account, then choose the profile whose supported settings and library you want to sync.",
  "Library and addon sharing",
  "Use the primary profile's saved addon setup and watchlist.",
  "Keep this profile separate",
  "Library and addons stay separate. No additional account is needed.",
  "Addon install link copied",
  "Compatible addon, listed in JL Media Vision.",
  "Saving on this device",
  "Couldn't read your local addon collection. Nothing was written.",
  "Local storage didn't confirm the move. Your collection may be unchanged. Reload to see the current state.",
  "Moved 1 addon to this JL profile. It is saved on this device.",
  "Moved {n} addons to this JL profile. They are saved on this device.",
  "Couldn't load your local addon collection. Nothing can be reordered safely without it.",
  "This JL profile",
  "This order is saved on this device for the active JL profile.",
  "No addons are installed in this profile yet.",
  "Add every addon below to this JL profile",
  "Choose a JL profile to organize its installed addons.",
  "JL Media Vision reads the saved local collection back to verify the order.",
  "Your addon collection changed while the editor was open. Nothing was written.",
  "Local storage didn't confirm the save. Your collection may be unchanged. Retry will re-check before writing again.",
  "The local collection has a different order than was saved.",
  "Addon order saved in this JL profile",
  "Using a local JL profile.",
  "JL account (sign in on the TV)",
  "Your JL Media Vision password",
  "Skip this and JL Media Vision still works. Your library stays local.",
  "Interrupted. Retry to resume safely; sources without a validator restart.",
  "Play offline",
  "Choose a fresh download source",
  "Saved movies, episodes, music, and eBooks for offline use",
  "Saved files belong to this account and profile on this device. Only completed files play offline. Direct, unencrypted files are supported; streaming playlists and protected sources are not.",
  "Older downloads have no profile owner. Add them to this local profile only if they are yours.",
  "Add older downloads to this local profile",
  "Movies, episodes and books",
  "Choose Download on a movie, episode, music track, or eBook to keep an intentional offline copy. Queue progress and saved files appear here.",
  "Your playback history appears here. You can optionally connect Trakt.",
  "{n} in your JL library",
  "Your account or profile changed. Reopen this dialog to choose again.",
  "The conflict backup could not be saved. Try again.",
  "Save conflict backup",
  "Your JL account stays with you",
  "Sign in to JL Media Vision directly on your TV. This legacy phone setup step does not send account tokens. Your addons and library also work with a local profile.",
  "Live updates are unavailable. Retrying.",
  "Unnumbered",
  "No episodes were returned for this season.",
  "Episodes could not be loaded. Check the connection and retry.",
  "Reset to account avatar",
  "Sign in with your JL Media Vision account. Your local library and addons remain available.",
  "JL account ID",
  "Your stable JL account identifier.",
  "Sign out of JL Media Vision",
  "Stops account sync and returns to this device's local profiles.",
  "Choose a JL profile to manage installed addons.",
  "Checked {n}s ago.",
  "Installed in this JL profile.",
  "addon installed",
  "addons installed",
  "Refresh addons",
  "JL account",
  "Community account",
  "Each JL profile keeps its own settings, library, and PIN.",
  "Profiles on this device",
  "Your local library remains available without an account.",
  "Your addon configurations are kept on this device. Manage each installation in Addons.",
  "Addon install links",
  "JL Media Vision supports compatible manifests and stremio:// install links without an external account.",
  "Open compatible addon links in JL Media Vision",
  "Choose JL Media Vision when your operating system asks which app should open an addon link. You can also paste a manifest URL in Addons.",
  "{app} itself does not host, distribute, or index any media. All streams come from third-party addons, debrid services, or your own media sources that you configure yourself. You are responsible for what you choose to play and for complying with the laws of your jurisdiction.",
  "Select a JL profile first. The repair scans only its local library.",
  "Repairs malformed records in the active JL profile library. Existing provider IDs and playback progress are retained.",
  "Select a JL profile first. This scans its local library.",
  "Local library repair",
  "Checks the active JL profile library for malformed item records and repairs compatible fields locally.",
  "This browser stores your JL session and local settings. Signing in enables account sync for supported profile data and service credentials. Clearing browser data removes local copies, but does not delete data already synced to your JL account.",
  "Choose which parts of your setup to save in one backup file. Your account sign-in is excluded.",
  "Choose a Harbor backup and review what it contains before restoring. Your account sign-in stays on this device.",
  "Choose the sections to save in one file. Your account sign-in is excluded.",
  "Saved {when} from Harbor {app}. Your account sign-in stays as is.",
  "Signed in as {email} with your JL Media Vision account.",
  "Your library and addons work locally. Sign in to use JL account sync.",
  "On: only titles you bookmarked. Off: also keeps titles added when you hit play.",
  "Keep the Library Watchlist tab limited to titles you bookmarked. Turn this off to also include anything automatically added when you pressed play.",
  "Only show Continue Watching for the profile that's active. Each profile sees just its own progress, so what you watch stays hidden from the other profiles that share this device.",
  "Classic rows",
  "Classic button order.",
  "When you hit Play on something you've partly watched, show a prompt to resume from where you left off or start over. Also covers saved JL progress and connected Trakt history.",
  "This is a compatible addon manifest. Add it from the Addons page instead.",
  "Condensed shows a top pick, quality tiles, and a drawer. Addon list groups sources by addon, no scoring.",
  "Show complete addon descriptions in the addon list picker, downloads, and Big Picture.",
  "Addon list",
  "Harbor ranking puts the best-scoring sources first. Addon order keeps each addon's results in the order it returned them, in a flat list. Stream priority below decides which addon leads, in both modes.",
  "Show each addon's results in the order it returned them, grouped by your addon list. Keeps the original addon ordering.",
  "Any compatible subtitle addons you have installed are searched here too.",
  "Addon compatibility",
  "JL Media Vision uses the open addon protocol. Compatible manifests and configured addon links work without an external media account. Third-party notices are listed in Licenses.",
  "If you were going to send something, send it to ElfHosted above, or to one of the charities below. They all do more good with it.",
  "Support ElfHosted, or give to any charity below, and the badge lands on your profile.",
  "Choose a JL profile first so its watchlist can sync.",
  "Export your entire Harbor setup to a single file, then restore it on a new computer or keep it as a backup. Everything is included except your account sign-in.",
];
const languages = [
  "ar",
  "de",
  "es",
  "fr",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "pl",
  "pt",
  "ru",
  "tr",
  "vi",
  "zh",
];
const placeholders = (value) =>
  [...value.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)].map((match) => match[1]).sort();

test("changed English keys keep JL branding without changing their meaning or placeholders", () => {
  const source = readFileSync(
    new URL("../src/lib/i18n/locales/en/jl-desktop-026.ts", import.meta.url),
    "utf8",
  );
  const exports = {};
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("exports", code)(exports);
  const expected = keys.filter((key) => key.includes("Harbor"));
  assert.deepEqual(Object.keys(exports.default).sort(), expected.sort());
  for (const key of expected)
    assert.equal(exports.default[key], key.replaceAll("Harbor", "JL Media Vision"));
  const barrel = readFileSync(new URL("../src/lib/i18n/locales/en.ts", import.meta.url), "utf8");
  assert.ok(barrel.includes('import jlDesktop026 from "./en/jl-desktop-026";'));
  assert.ok(barrel.lastIndexOf("...jlDesktop026,") > barrel.lastIndexOf("...jlMediaVision,"));
});

for (const language of languages) {
  test(language + " covers only the new desktop strings with real localized values", () => {
    const source = readFileSync(
      new URL("../src/lib/i18n/locales/" + language + "/jl-desktop-026.ts", import.meta.url),
      "utf8",
    );
    const exports = {};
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function("exports", code)(exports);
    const catalog = exports.default;
    assert.deepEqual(
      Object.keys(catalog).sort(),
      [...keys].sort(),
      "Only the audited release additions belong in this layer",
    );
    for (const key of keys) {
      const value = catalog[key];
      assert.equal(typeof value, "string");
      assert.ok(value.trim(), language + ": empty translation for " + key);
      assert.doesNotMatch(value, /\uFFFD|\?{3,}/, language + ": damaged text encoding for " + key);
      assert.notEqual(value, key, language + ": English source copied as a translation for " + key);
      assert.deepEqual(
        placeholders(value),
        placeholders(key),
        language + ": placeholders differ for " + key,
      );
      if (key.includes("Harbor")) {
        assert.ok(value.includes("JL Media Vision"), language + ": current product name missing");
        assert.ok(!value.includes("Harbor"), language + ": inherited product name retained");
      }
      if (key.includes("stremio://"))
        assert.ok(value.includes("stremio://"), language + ": addon scheme changed");
    }
    const barrel = readFileSync(
      new URL("../src/lib/i18n/locales/" + language + ".ts", import.meta.url),
      "utf8",
    );
    assert.ok(
      barrel.includes('import jlDesktop026 from "./' + language + '/jl-desktop-026";'),
      "The runtime locale must import its layer",
    );
    assert.ok(barrel.includes("...jlDesktop026,"), "The runtime locale must register its layer");
    assert.ok(
      barrel.lastIndexOf("...jlDesktop026,") > barrel.lastIndexOf("...jlMediaVision,"),
      "Release translations must win over older branding values",
    );
  });
}
