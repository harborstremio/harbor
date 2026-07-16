#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

version="$(node -p "require('./package.json').version")"
tauri_version="$(node -p "require('./src-tauri/tauri.conf.json').version")"
package_manager="$(node -p "require('./package.json').packageManager")"
pnpm_version="${package_manager#pnpm@}"
metadata="flatpak/site.harbor.Harbor.metainfo.xml"
manifest="flatpak/site.harbor.Harbor.yml"

if [[ "$version" != "$tauri_version" ]]; then
  echo "package.json ($version) and tauri.conf.json ($tauri_version) disagree" >&2
  exit 1
fi

if [[ "$package_manager" != pnpm@11.* || ! "$pnpm_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "unsupported packageManager $package_manager; review the pnpm source and store version" >&2
  exit 1
fi

if [[ "${1:-}" == "--check" ]]; then
  grep -Fq "<release version=\"$version\"" "$metadata" || {
    echo "AppStream metadata does not contain release $version; run flatpak/update-flatpak.sh" >&2
    exit 1
  }
  grep -Fq "https://registry.npmjs.org/pnpm/-/pnpm-$pnpm_version.tgz" "$manifest" || {
    echo "Flatpak manifest does not pin $package_manager; run flatpak/update-flatpak.sh" >&2
    exit 1
  }
  exit 0
fi

read -r existing_version existing_date < <(python3 - "$metadata" <<'PY'
import re, sys
text = open(sys.argv[1], encoding="utf-8").read()
match = re.search(r'<release version="([^"]+)" date="([^"]+)"\s*/>', text)
if not match:
    raise SystemExit(f"release entry missing from {sys.argv[1]}")
print(*match.groups())
PY
)

if [[ -n "${RELEASE_DATE:-}" ]]; then
  release_date="$RELEASE_DATE"
elif [[ "$existing_version" == "$version" ]]; then
  release_date="$existing_date"
else
  release_date="$(date +%F)"
fi
[[ "$release_date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || {
  echo "invalid release date: $release_date" >&2
  exit 1
}

work=".flatpak-work/source-generator"
tools_dir="$work/flatpak-builder-tools"
venv="$work/venv"
tools_commit="737c0085912f9f7dabf9341d4608e2a77a51a73a"
node_output="$work/node-sources.json.tmp"
cargo_output="$work/cargo-sources.json.tmp"
pnpm_archive="$work/pnpm-$pnpm_version.tgz"
trap 'rm -f "$node_output" "$cargo_output" "$pnpm_archive"' EXIT

if [[ ! -d "$tools_dir/.git" ]]; then
  mkdir -p "$work"
  git clone https://github.com/flatpak/flatpak-builder-tools.git "$tools_dir"
fi
git -C "$tools_dir" fetch origin "$tools_commit"
git -C "$tools_dir" checkout --detach "$tools_commit"

if [[ ! -x "$venv/bin/flatpak-node-generator" ]]; then
  python3 -m venv "$venv"
  "$venv/bin/pip" install "$tools_dir/node" aiohttp PyYAML tomlkit
fi

curl -fsSL "https://registry.npmjs.org/pnpm/-/pnpm-$pnpm_version.tgz" -o "$pnpm_archive"
pnpm_sha256="$(sha256sum "$pnpm_archive" | cut -d' ' -f1)"

"$venv/bin/flatpak-node-generator" pnpm pnpm-lock.yaml \
  --pnpm-store-version v11 \
  --node-sdk-extension org.freedesktop.Sdk.Extension.node22//25.08 \
  -o "$node_output"
python3 - "$node_output" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as source:
    entries = json.load(source)

# Package downloads are generated concurrently and therefore arrive in a
# random order. Setup sources at the end are order-sensitive and stay intact.
split = next(
    (index for index, entry in enumerate(entries) if entry["type"] not in {"archive", "file"}),
    len(entries),
)
entries[:split] = sorted(
    entries[:split],
    key=lambda entry: json.dumps(entry, sort_keys=True, separators=(",", ":")),
)
with open(path, "w", encoding="utf-8") as output:
    json.dump(entries, output, indent=2)
    output.write("\n")
PY
"$venv/bin/python" "$tools_dir/cargo/flatpak-cargo-generator.py" \
  src-tauri/Cargo.lock -o "$cargo_output"

mv "$node_output" flatpak/node-sources.json
mv "$cargo_output" flatpak/cargo-sources.json
vp fmt flatpak/node-sources.json

python3 - "$metadata" "$manifest" "$version" "$release_date" "$pnpm_version" "$pnpm_sha256" <<'PY'
import os
import re
import sys

path, manifest, version, release_date, pnpm_version, pnpm_sha256 = sys.argv[1:]
text = open(path, encoding="utf-8").read()
replacement = f'<release version="{version}" date="{release_date}" />'
updated, count = re.subn(r'<release version="[^"]+" date="[^"]+"\s*/>', replacement, text, count=1)
if count != 1:
    raise SystemExit(f"expected one release entry in {path}")
temporary = f"{path}.tmp"
with open(temporary, "w", encoding="utf-8") as output:
    output.write(updated)
os.replace(temporary, path)

text = open(manifest, encoding="utf-8").read()
replacement = (
    f"url: https://registry.npmjs.org/pnpm/-/pnpm-{pnpm_version}.tgz\n"
    f"        sha256: {pnpm_sha256}"
)
updated, count = re.subn(
    r"url: https://registry\.npmjs\.org/pnpm/-/pnpm-[^\s/]+\.tgz\n\s+sha256: [0-9a-f]{64}",
    replacement,
    text,
    count=1,
)
if count != 1:
    raise SystemExit(f"expected one pnpm archive source in {manifest}")
temporary = f"{manifest}.tmp"
with open(temporary, "w", encoding="utf-8") as output:
    output.write(updated)
os.replace(temporary, manifest)
PY

desktop-file-validate flatpak/site.harbor.Harbor.desktop
appstreamcli validate --no-net "$metadata"
flatpak-builder --show-manifest "$manifest" >/dev/null

echo "Flatpak sources and metadata refreshed for Harbor $version ($release_date)."
