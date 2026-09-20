# Older macOS support status

Checked 2026-09-17. "Older Mac" has been used for two independent compatibility problems in Harbor: older macOS versions on Apple Silicon, and Intel (`x86_64`) Macs. The result is different for each, but neither is fully resolved for ordinary users.

## Verdict

| Concern                      | Status                                                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intel Mac builds             | **CI build restored; release delivery still pending**     | PR [#1145](https://github.com/harborstremio/harbor/pull/1145) restored the Intel runner, entitlements, and initial libmpv redraw; its author tested an `x86_64` build on a 2020 Intel Mac running macOS 15.7.7. Later CI runs, including [2026-09-05](https://github.com/harborstremio/harbor/actions/runs/33987921188), completed the `macOS-Intel (x86_64-apple-darwin)` job successfully and retained an Intel artifact. This change additionally makes the Intel native dependency build deterministic and verifies the finished bundle. However, the open user issue [#601](https://github.com/harborstremio/harbor/issues/601) still has no installable resolution, the latest stable release has only an `aarch64` DMG, and both current stable and beta updater manifests expose only `darwin-aarch64`. |
| macOS 11–15 on Apple Silicon | **Broken in published builds; remediated in this change** | Harbor declares macOS 11, but the currently published beta bundle contains libmpv/FFmpeg dylibs built with a macOS 26.0 deployment target. This recreates the previously confirmed launch-crash class on pre-26 systems. This change replaces those dependencies with source-built macOS 11 artifacts and makes CI reject a bundle containing a newer deployment target.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## What "older Mac" referred to

The original reports show that the term covered both axes:

- Issue [#59](https://github.com/harborstremio/harbor/issues/59) reported that an ARM build crashed on an M1 Mac running Ventura 13.7.8. The crash log says bundled `libmpv.2.dylib` was built for macOS 26.0 and referenced an AppKit symbol unavailable on Ventura. Maintainers identified the libmpv dependency version as the cause in [this comment](https://github.com/harborstremio/harbor/issues/59#issuecomment-4665814847). A later "legacy" build launched, but its catalog/poster experience remained broken; maintainers acknowledged both the old-hardware test gap and mpv/API incompatibility [here](https://github.com/harborstremio/harbor/issues/59#issuecomment-4682122853).
- Issue [#177](https://github.com/harborstremio/harbor/issues/177) and issue [#181](https://github.com/harborstremio/harbor/issues/181) established that files named `aarch64_legacy-macos.dmg` were still ARM-only and therefore could not run on Intel Macs. The maintainer clarified that this variant merely bundled an older mpv in [#181](https://github.com/harborstremio/harbor/issues/181#issuecomment-4721404376).
- Stable releases [0.9.20](https://github.com/harborstremio/harbor/releases/tag/v0.9.20) and [0.9.21](https://github.com/harborstremio/harbor/releases/tag/V0.9.21) removed the legacy artifact and explicitly said it would return only after crashes on older Macs were addressed. Release 0.9.21 then had a confirmed macOS 15.7.7 launch crash because bundled `libplacebo.360.dylib` was built for macOS 26.0 ([#980](https://github.com/harborstremio/harbor/issues/980)).

## Current intended and effective support

- Intended OS floor: `macOS 11.0`. It is stated in [README.md](https://github.com/harborstremio/harbor/blob/0117755855d3f43960bad3f9f62b69ef851d5991/README.md#L382-L388) and configured as `bundle.macOS.minimumSystemVersion` in [`src-tauri/tauri.conf.json`](https://github.com/harborstremio/harbor/blob/0117755855d3f43960bad3f9f62b69ef851d5991/src-tauri/tauri.conf.json#L92-L95).
- Build architectures: the workflow has both `aarch64-apple-darwin` and `x86_64-apple-darwin` jobs ([workflow at the current main commit](https://github.com/harborstremio/harbor/blob/0117755855d3f43960bad3f9f62b69ef851d5991/.github/workflows/tauri-build.yml#L22-L31)).
- Publicly installed architecture: ARM64 only. The latest stable release [0.9.21](https://github.com/harborstremio/harbor/releases/tag/V0.9.21) contains `Harbor_0.9.21_aarch64.dmg`, not an Intel or universal DMG. The official [stable updater manifest](https://harbor.site/updates/latest.json) and the same endpoint with the beta channel header currently expose `darwin-aarch64` but no `darwin-x86_64` entry. PR #1145's post-merge hardware test also calls out this missing updater artifact in [its follow-up](https://github.com/harborstremio/harbor/pull/1145#issuecomment-5184695956).

The two most relevant fixes therefore address narrower problems:

1. Commit [`587abb12`](https://github.com/harborstremio/harbor/commit/587abb121d83c3f2e901d4e836242647a3c8cb4c) / PR [#1145](https://github.com/harborstremio/harbor/pull/1145) made Intel builds viable by replacing the retired runner, adding libmpv/LuaJIT entitlements, and forcing the initial render redraw.
2. Commit [`32ae8e35`](https://github.com/harborstremio/harbor/commit/32ae8e35625b053bc19985bc7c65614e2cf1815d) / PR [#1302](https://github.com/harborstremio/harbor/pull/1302) fixed missing Homebrew library packaging by copying the dependency closure into the app and rejecting absolute Homebrew paths. Its verifier checks load paths, presence, and signing; it does **not** check each Mach-O deployment target. It therefore fixed self-containment, not old-OS compatibility.

## Current beta bundle audit

The official beta updater returned version `0.9.127` on 2026-09-17. I downloaded its official [`Harbor_0.9.127_aarch64.app.tar.gz`](https://harbor.site/updates/Harbor_0.9.127_aarch64.app.tar.gz) artifact and inspected the extracted app with macOS `plutil`, `file`, and `otool -l`:

- `Info.plist` reports `LSMinimumSystemVersion = 11.0`.
- Harbor itself is ARM64 and reports `minos 11.0`.
- `ffmpeg` and `ffprobe` are ARM64 and report `minos 12.0`, so even the sidecars exceed the declared macOS 11 floor.
- 47 of 48 bundled dylibs report `minos 26.0`, including `libmpv.2.dylib`, `libplacebo.360.dylib`, and the bundled FFmpeg libraries. Only `librubberband.3.dylib` reports `minos 11.0`.

This is direct evidence that the current ARM beta cannot be treated as compatible with macOS 11–15 even though its bundle metadata says 11.0. It repeats the exact mismatch documented in issues #59 and #980.

## Remediation implemented in this change

- Build libmpv, FFmpeg, ffprobe, and their native dependency closure from a pinned IINA dependency-builder revision for both Apple Silicon and Intel, with `MACOSX_DEPLOYMENT_TARGET=11.0`.
- Recursively bundle the native dependency closure and rewrite non-system load commands to app-relative `@rpath` paths.
- Reject finished apps containing missing dependencies, machine-local paths, invalid signatures, missing hardened-runtime entitlements, or any Mach-O deployment target newer than macOS 11.
- Bundle the source-built FFmpeg tools as Tauri sidecars and resolve the bundled `ffmpeg` before optional package-manager installations at runtime.

## Upstream constraints

- Rust supports Intel macOS from 10.12 and ARM64 macOS from 11.0; CPU architecture and deployment target are separate concerns ([official rustc target documentation](https://doc.rust-lang.org/rustc/platform-support/apple-darwin.html)).
- Current mpv requires macOS 10.15 or newer, and mpv 0.37 removed compatibility for older releases ([mpv requirements](https://github.com/mpv-player/mpv/blob/master/README.md#system-requirements), [mpv 0.37 release](https://github.com/mpv-player/mpv/releases/tag/v0.37.0)). This makes pre-Catalina support unrealistic with current mpv, but does not explain Harbor's current macOS 26 dependency floor.
- Tauri advertises macOS 10.15+, but has an open Catalina crash report against Tauri 2.11.2 ([tauri#15431](https://github.com/tauri-apps/tauri/issues/15431)). Harbor's own intended floor of 11.0 is therefore reasonable only after all bundled native dependencies are built and tested against that floor.

## What remains before this can be called resolved for users

1. Test launch and playback on real or virtualized macOS 11/12/13/14 systems in addition to the local macOS 15 validation; deployment-target checks prove binary compatibility but do not replace runtime coverage.
2. Publish Intel DMGs/updater archives and add `darwin-x86_64` to stable and beta manifests.
3. Keep the macOS 11 claim only if release testing continues to cover it; otherwise raise the documented and configured floor to the oldest supported version.
