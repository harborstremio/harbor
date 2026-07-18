import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SHA256 = "e9c87d19055bc5a82771b2b48e9fbae047bd5180603f5a1aaae10c90ca690467";
const TAG = process.env.HARBOR_LIBMPV_TAG ?? "mpvdll";
const url =
  process.env.HARBOR_LIBMPV_URL ??
  `https://github.com/harborstremio/harbor/releases/download/${TAG}/libmpv-2.dll`;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "src-tauri", "libmpv", "libmpv-2.dll");
const digest = (buf) => createHash("sha256").update(buf).digest("hex");

if (process.platform !== "win32" && !process.env.HARBOR_LIBMPV_FORCE) {
  console.log("[libmpv] not Windows, skipping (mac and linux link system libmpv)");
  process.exit(0);
}

if (existsSync(dest) && digest(readFileSync(dest)) === SHA256) {
  console.log("[libmpv] libmpv-2.dll already present and verified");
  process.exit(0);
}

console.log(`[libmpv] fetching ${url}`);
const res = await fetch(url, { redirect: "follow" });
if (!res.ok) {
  console.error(`[libmpv] download failed (${res.status} ${res.statusText})`);
  console.error(
    "[libmpv] set HARBOR_LIBMPV_URL to a mirror, or drop libmpv-2.dll into src-tauri/libmpv/ by hand",
  );
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
const got = digest(buf);
if (got !== SHA256) {
  console.error(`[libmpv] checksum mismatch (expected ${SHA256}, got ${got})`);
  process.exit(1);
}
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, buf);
console.log(`[libmpv] wrote ${dest} (${(buf.length / 1048576).toFixed(1)} MB)`);
