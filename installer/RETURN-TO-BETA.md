# Experimental → beta: explicit, recoverable return

## Status and scope

The app implementation is merged into `beta-branch` through PR #1389 but is not
release-certified or published. Windows x86_64 only. A signed recoverable handoff
can bootstrap an existing legacy NSIS installation; future experimental installs
and returns then use the managed installer. Signed `0.9.124` artifacts were built
locally from merge commit `5a55f9b812e91bac3ed452b4c9e75dba787090ec`,
but no real installer round trip was run and no stable, beta or experimental
server object was changed. macOS and Linux remain unsupported for automatic
experimental installation and return.

## Tester flow

1. Enable experimental in Settings → Updates & backup → Experimental builds.
2. An experimental build is installable only when its manifest approves at least
   one compatible beta and declares recovery protocol 1 for Harbor Setup.
3. Download, then approve installation. Harbor saves a local `.harbx` backup and
   the source build's approved return choices. If this copy originally came from
   NSIS, Harbor creates its recovery marker only after verifying the signed Setup
   executable and immediately before launch. The installer keeps the previous
   application directory until the new main UI acknowledges successful startup.
4. To finish testing, choose **Return to beta**, select an approved version,
   download/verify, then **Install beta … and restart**.
5. The exact beta must launch. Experimental turns off and beta updates resume.
   This does not pin an old beta forever; a newer beta can be offered normally.

**Leave experimental builds** still only changes the feed. It never silently
installs or downgrades the app. Stable/beta background comparisons are unchanged.

## Approval contract and publishing

Use `deploy/scripts/experimental-release.mjs --return-plan FILE` in the sibling
`harbor-hosted-experimental` checkout, along with the existing command/options.
Pass the same file to plan/upload/preview/publish. Upload still never publishes.

The JSON file has this shape (illustrative only; none of these values approves
an actual build):

```json
{
  "sourceVersion": "0.9.123",
  "sourceBuildId": "EXACT_EXPERIMENTAL_BUILD_ID",
  "targets": [
    {
      "channel": "beta",
      "version": "0.9.122",
      "platformKey": "windows-x86_64",
      "dataCompatible": true,
      "recoveryProtocol": 1,
      "payloadVersion": 9122,
      "url": "https://downloads.example/updates/Harbor_0.9.122_x64-installer.exe",
      "signature": "REAL_SIGNATURE_FROM_THIS_EXACT_INSTALLER",
      "size": 123456789,
      "evidence": "Reference to the completed disposable-Windows return test"
    }
  ]
}
```

The server requires the exact source version/build ID, beta-history membership,
its own public artifact origin/name, earlier version, data-compatibility and
protocol attestations, test evidence, and a size/signature matching stored bytes'
metadata. It only READS normal-channel objects. Approved choices become
`returnToBeta` in the immutable experimental manifest; its Windows installer gets
`recoveryProtocol: 1`. Omitting the plan produces no installable experimental
candidate in this app. String/metadata checks do not prove a real signature or
compatibility; the app verifies bytes cryptographically and maintainers must run
the actual compatibility tests before approving a target.

**Do not label the existing 0.9.122 installer protocol 1.** A target must contain
both the new recoverable Setup implementation and the target app's startup
acknowledgement. Older packages ignore unknown flags and cannot provide this
contract. Publish a future, tested beta through the separately authorized normal
release process first; do not overwrite/repackage a public historical beta here.

The return action uses native HTTP to re-read the originating experimental
build's immutable manifest, not the current latest pointer. This does not depend
on browser CORS access to immutable artifact routes. Its version, build ID and target must
still match the saved choice. A newer experimental release therefore cannot
silently redirect the return. Existing immutable approvals currently have no
per-target revocation mechanism; security withdrawals need release-owner handling
before allowing affected experimental builds to ship.

## Installer and data recovery

- Opt-in `--recoverable` requires `--to-version` to exactly match the embedded
  payload and requires relaunch. Ordinary Setup/update mode is unchanged.
- Extract into a fresh sibling staging tree before replacing any current file.
  Stage failures leave the current app untouched. The directory swap keeps the
  complete previous app, including files not owned by the new payload.
- The target app acknowledges only after its main UI is ready. A crash, exit or
  missing acknowledgement within 90 seconds triggers restoration of the previous
  app files. Filesystem locks can prevent automatic restoration; retained files
  and a recovery executable remain available for manual recovery.
- A power cut between directory renames may leave the normal shortcut unusable.
  This is recoverable, **not guaranteed power-loss atomic**. Use the retained
  `Recover-Harbor.exe --recover-only --target-dir "FULL_INSTALL_DIRECTORY"`
  command documented in the transaction's `RECOVERY.txt`. Never substitute a
  broad directory, delete a recovery folder mid-install or run uninstall.
- The active transaction is the sibling `.Harbor.harbor-transition` for an
  installation named `Harbor` (custom directory names use the same pattern).
  Completed/failed transaction folders gain `-retained-<timestamp>`. These copies
  are deliberately not automatically deleted; account for their disk usage and
  inspect before manual cleanup. Extraction-failure folders may contain only a
  partial stage; the original app remains usable.
- Profile backups are under the app-data `update-recovery/<id>/profile.harbx`.
  They use the existing Harbor backup format, not a full browser/database image.
  They may contain service credentials and must remain private. Stremio sign-in
  remains excluded by the existing backup contract. Cloud changes are not undone.
- Never auto-import an older profile snapshot: that would lose testing-period
  settings/progress. Approved targets must accept the current data. Only updater
  channel flags are reverted if the beta fails to launch.

## Verification before any public use

Local automated coverage: updater state/approval/channel/backup failure tests,
real temporary-filesystem transaction tests, server metadata/isolation tests,
TypeScript and both Rust crate checks. These are not packaged install tests.

Observed locally on September 3: 22 updater tests, 5 filesystem transaction
tests, 19 publisher/delivery/safety tests, 8 edge/fixture tests, and 24 existing
subtitle regression tests passed. Two container integration tests remain skipped.
The full frontend suite still has its same four pre-existing failures (Arabic
coverage, CRLF fullscreen parser and two missing theme-store file references).
Scoped frontend formatting/lint, backend lint, TypeScript and both Cargo checks
passed; existing Vite notices and three unrelated Rust dead-code warnings remain.
Browser verification covered the unsupported web state, placement and Enter-key
open/close. Native packaged round trips, screen-reader testing, macOS and the
Linux full-binary build have not been performed.

Required disposable Windows tests, using real signed payloads when separately
authorized:

1. Install the proposed beta, enter experimental, select and return to that exact
   beta; confirm version, beta feed, addon order, profiles, settings, watch
   progress and latest selected subtitles. Repeat after leaving experimental.
2. Test fresh managed installs and legacy NSIS upgrades, paths with spaces,
   limited free space, locked files, non-writable directories, tampered downloads
   and signatures. Confirm a corrupt pre-existing marker is never overwritten.
3. Inject failure during extraction, each directory rename, registration,
   relaunch and pre-ack startup. Confirm automatic recovery or the documented
   manual recovery command; never mistake a newer running app for success.
4. Test slow startup, missing acknowledgement, storage-quota failure, offline
   approval recheck, cancellation, cross-window channel changes and retries.
5. Prove stable/beta discovery remains upgrade-only and normal manifest/artifact
   bytes stay unchanged. Run Linux binary/edge/storage CI on Linux and validate
   macOS separately before enabling it. Do not infer packaged safety from mocks.
