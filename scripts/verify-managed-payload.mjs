import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const version = JSON.parse(read("src-tauri/tauri.conf.json")).version;
assert.equal(read("installer/src-tauri/payload/version.txt").toString().trim(), version);
const payload = read("installer/src-tauri/payload/harbor-payload.zip");
const entries = unzipSync(payload, {
  filter: ({ name }) => name === "harbor.exe" || name === "uninstall.exe",
});
for (const [name, path] of [
  ["harbor.exe", "src-tauri/target/release/harbor.exe"],
  ["uninstall.exe", "installer/src-tauri/target/release/harbor-uninstall.exe"],
]) {
  assert.ok(entries[name], "Missing payload entry: " + name);
  assert.equal(hash(entries[name]), hash(read(path)), "Stale payload entry: " + name);
}
if (process.argv.includes("--embedded")) {
  const installer = read("installer/src-tauri/target/release/harbor-setup.exe");
  assert.ok(installer.indexOf(payload) >= 0, "Installer does not embed the verified payload");
}
console.log("Managed payload verified for " + version + "; SHA-256 " + hash(payload));
