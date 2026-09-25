# Harbor desktop release runbook

This is the maintainer procedure for producing signed beta and experimental
desktop releases. It covers the current supported automatic handoff path:
Windows x86_64. Keep the signing key offline; the publisher only receives
artifacts and their public `.sig` files.

## Version lines

- Public beta uses the normal `0.9.x` sequence. After `0.9.124`, the next beta
  remains `0.9.125`.
- Experimental uses internal binary versions `0.999.x`, which are strictly
  newer than normal beta builds for installer ordering. The tester-facing
  sequence is separate: internal `0.999.1` displays as Experimental `0.0.1`,
  internal `0.999.2` displays as Experimental `0.0.2`, and so on.
- Never publish different bytes with the same internal version. A new build ID
  alone does not make a replacement installable.
- An experimental build never consumes a public beta version number.

## Artifact roles

| File                                  | Purpose                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `Harbor_<version>_x64-setup.exe`      | Normal Tauri/NSIS Windows updater                                     |
| `Harbor_<version>_x64-installer.exe`  | Managed Harbor Setup used for experimental handoff and Return to beta |
| `Harbor_<version>_aarch64.app.tar.gz` | Apple Silicon macOS updater                                           |
| `Harbor_<version>_aarch64.dmg`        | Apple Silicon manual installer                                        |

Every updater and Windows executable must be uploaded with the `.sig` produced
from those exact bytes. The DMG does not use a Tauri updater signature. Never
reuse a signature after rebuilding or renaming and re-signing an artifact.

## 1. Prepare the release commit

Update the version in all of these files in one reviewed pull request:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`
- `installer/package.json`
- `installer/src-tauri/Cargo.toml`
- `installer/src-tauri/Cargo.lock`
- `installer/src-tauri/tauri.conf.json`

Merge the tested changes and version bump into the intended release branch.
Record the exact merge SHA. Build from that SHA in a clean checkout or detached
worktree, never from a dirty development directory.

Before release, run the repository-required checks:

```powershell
pnpm install --frozen-lockfile
pnpm run check
pnpm run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
```

Run platform-specific packaged tests on each affected platform. A successful
mock or TypeScript test does not certify a packaged updater.

## 2. Build the normal Tauri packages

Dispatch `.github/workflows/tauri-build.yml` on the exact release branch or tag.
Confirm the workflow head SHA matches the recorded merge SHA before using any
artifact. Download at least:

- Windows: `nsis/Harbor_<version>_x64-setup.exe`
- Apple Silicon: `macos/Harbor.app.tar.gz` and
  `dmg/Harbor_<version>_aarch64.dmg`

Rename the macOS updater to
`Harbor_<version>_aarch64.app.tar.gz`. If CI did not emit adjacent signatures,
sign the Windows setup and renamed macOS updater locally with the private Tauri
updater key. Do not print, upload, commit, or send the key or its password.

## 3. Build the managed Windows installer

Run these commands from the clean release worktree on Windows:

```powershell
pnpm install --frozen-lockfile
pnpm run setup
pnpm tauri build --no-bundle

cargo build --manifest-path installer/src-tauri/Cargo.toml `
  --release --no-default-features --bin harbor-uninstall

node installer/scripts/make-payload.mjs

cargo build --manifest-path installer/src-tauri/Cargo.toml `
  --release --bin harbor-setup
```

The final source file is:

```text
installer/src-tauri/target/release/harbor-setup.exe
```

Copy it into a new release directory as
`Harbor_<version>_x64-installer.exe`, then sign that copied file. Do not
overwrite a prior release directory. Save SHA-256 hashes for every final file
and verify all required artifact/signature pairs are present.

## 4. Publish a beta

Upload all final files before publishing the beta manifest:

1. `Harbor_<version>_x64-setup.exe` and `.sig`
2. `Harbor_<version>_x64-installer.exe` and `.sig`
3. `Harbor_<version>_aarch64.app.tar.gz` and `.sig`
4. `Harbor_<version>_aarch64.dmg`

The normal updater continues to use `x64-setup.exe`. The separate managed
installer must also be present so a later experimental release can approve this
beta as a recoverable return target. Confirm the release dashboard reports each
required file as present and each required signature as valid, add release
notes, then publish the beta manifest last.

Test an in-app update from the previous beta. Confirm the new version launches
and preserves profiles, settings, addon order, watch progress, downloads, and
the latest selected subtitles. Do not approve this beta as a return target until
the managed installer and recovery behavior have also passed the disposable
Windows tests in `RETURN-TO-BETA.md`.

## 5. Build Experimental `0.0.x`

Start from the exact changes testers should receive and assign the next internal
`0.999.x` binary version in the eight version files listed above. Build and sign
the Windows `x64-setup.exe` and managed `x64-installer.exe` by the same process.
The first release is:

```text
Internal binary version: 0.999.1
Tester-facing version:   0.0.1
```

Choose a unique build ID. Prepare release notes that state the included pull
requests, credits, known issues, and exactly what testers should verify.

Create a return plan that names the exact experimental internal version and
build ID. Its beta target must use the already uploaded
`Harbor_<beta-version>_x64-installer.exe`, exact size and signature, payload
version, protocol `1`, a data-compatibility decision, and real test evidence.
For beta `0.9.124`, the payload version is `9124`.

Use the isolated experimental publisher described in
`EXPERIMENTAL-UPDATES.md`: offline plan, authenticated status, upload, read-only
preview, and explicit publish. Pass the same return-plan file to every step.
Uploading does not publish. Publish the experimental latest pointer last and
never modify stable, beta, or legacy pointers as part of this workflow.

## 6. Required end-to-end test

Use a disposable Windows installation that starts on the previous legacy NSIS
beta:

1. Update automatically to the new public beta and restart.
2. Sign in with a Harbor account carrying an approved `tester`, `moderator`,
   `admin`, or `dev` badge.
3. Enable Experimental builds, download the candidate, approve installation,
   and verify the app restarts into the displayed Experimental version.
4. Verify profiles, settings, addon order, watch progress, downloads, and the
   latest selected subtitles.
5. Choose **Return to beta**, select the approved beta, install, and verify the
   exact beta launches automatically with the same compatible data.
6. Exercise cancellation, interrupted download, bad signature, failed launch,
   paths containing spaces, and the recovery instructions from
   `RETURN-TO-BETA.md` before broadening access.

Leaving Experimental builds only changes future update checks. It does not
replace the installed experimental binary; testers must use **Return to beta**.

## Safety rules

- Never publish before every referenced artifact and signature is stored.
- Never overwrite immutable version/build artifact paths.
- Never copy the private updater key to CI, the hosted backend, or a release
  directory.
- Never put publisher tokens, key passwords, private URLs, or profile backups in
  commands, logs, screenshots, documents, or commits.
- Withdraw a bad experimental candidate; do not silently redirect it to beta or
  stable.
- Keep the last-known-good beta installer and experimental manifest available
  for recovery.
