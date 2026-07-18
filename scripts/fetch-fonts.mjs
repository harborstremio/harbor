import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE =
  process.env.HARBOR_FONTS_BASE ??
  "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/JP";

const FONTS = [
  {
    file: "NotoSansJP-Regular.otf",
    url: `${BASE}/NotoSansJP-Regular.otf`,
    sha256: "dff723ba59d57d136764a04b9b2d03205544f7cd785a711442d6d2d085ac5073",
  },
  {
    file: "NotoSansJP-Bold.otf",
    url: `${BASE}/NotoSansJP-Bold.otf`,
    sha256: "1b0edfb500b73a4fa8a4fcaae1bbbd403994e08e73e3e0da37e70d3853f42c5f",
  },
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "src-tauri", "fonts");
const digest = (buf) => createHash("sha256").update(buf).digest("hex");

mkdirSync(dest, { recursive: true });
for (const f of FONTS) {
  const out = join(dest, f.file);
  if (existsSync(out) && digest(readFileSync(out)) === f.sha256) {
    console.log(`[fonts] ${f.file} already present and verified`);
    continue;
  }
  console.log(`[fonts] fetching ${f.url}`);
  const res = await fetch(f.url, { redirect: "follow" });
  if (!res.ok) {
    console.error(`[fonts] download failed (${res.status} ${res.statusText}) for ${f.file}`);
    console.error(
      "[fonts] set HARBOR_FONTS_BASE to a mirror, or drop the .otf into src-tauri/fonts/ by hand",
    );
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const got = digest(buf);
  if (got !== f.sha256) {
    console.error(`[fonts] checksum mismatch for ${f.file} (expected ${f.sha256}, got ${got})`);
    process.exit(1);
  }
  writeFileSync(out, buf);
  console.log(`[fonts] wrote ${out} (${(buf.length / 1048576).toFixed(1)} MB)`);
}
