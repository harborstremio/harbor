# Badge-gated experimental updates: server handoff

## Status

### September 5: beta handoff bootstrap merged and built

The app-side legacy NSIS bootstrap and managed recovery handoff are merged into
`beta-branch` through PR #1389. Signed `0.9.124` normal updater and managed
installer artifacts were built from merge commit
`5a55f9b812e91bac3ed452b4c9e75dba787090ec`; they remain local and unpublished.
The experimental publisher and delivery-edge changes are still local and
uncommitted, so no experimental upload, manifest publication or deployment has
occurred. `0.9.124` is not an approved return target until its required packaged
Windows tests pass.

### September 4: Harbor account badge gate

Experimental enrollment, update checks, downloads and installation now require
a signed-in Harbor account with at least one canonical badge named `tester`,
`moderator`, `admin` or `dev`. Badge names come from the Harbor identity response;
displayed profile badges and browser input are not accepted as authorization.
The app revalidates the current account through `/identity/api/me` before reading
the experimental feed, before downloading and again before installation. Missing
accounts or removed badges fail closed and restore the device's saved stable or
beta channel. A temporary identity-service or network failure blocks the action
without discarding the experimental preference.

The section and its settings-search result are hidden for other accounts. A user
who already has an experimental installation can still see the tested Return to
beta recovery control after losing access. This gate controls in-app discovery
and installation; it does not make already-published artifact URLs confidential.
Artifact confidentiality would additionally require authenticated delivery and
private object storage.

### September 3: explicit return-to-beta follow-up

The app now has **Return to beta** under Experimental builds. This is separate
from **Leave experimental builds**, which only changes the future update feed.
Normal stable/beta update discovery remains upgrade-only.

Automatic experimental installation and return are currently gated to Windows
x86_64 installations with a tested recovery path. A signed recoverable handoff
can bootstrap the recovery marker for a legacy NSIS installation immediately
before Harbor Setup starts; subsequent handoffs are managed normally. The
publisher/edge can still describe macOS, but this app will not install an
experimental build there. The earlier cross-platform experimental-install
descriptions below predate this safety gate and are not release-readiness claims.

See [RETURN-TO-BETA.md](RETURN-TO-BETA.md) for the new installer protocol,
publisher approval contract, recovery paths and required packaged tests. No beta
target is certified by this work yet.

Maintainers building a real beta or experimental candidate should follow
[RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md) for the artifact, signing, versioning,
publication and end-to-end test order.

The read-only live check on September 3 still finds a 404 at the dedicated URL
and a stable `0.9.20` response for `x-harbor-channel: experimental`. The app rejects
that fallback. Stable/default `0.9.20`, beta `0.9.122` and legacy `0.9.19` hashes
were unchanged before and after that check. The new feed is not deployed yet.

Implementation and the tomorrow checklist live in the sibling checkout
`../harbor-hosted-experimental/docs/20-experimental-updates.md`. Its manual CLI
stages uploads separately from publication and never builds or signs. A second
checkout, `../harbor-containers-experimental`, contains the delivery edge changes.
Both use branch `codex/experimental-feed`; neither has been pushed.

## Keep the feeds separate

| Requested channel         | Stored manifest                    | Change needed                         |
| ------------------------- | ---------------------------------- | ------------------------------------- |
| Stable / existing default | `updates/latest.json`              | None                                  |
| Beta                      | `updates/latest-beta.json`         | None                                  |
| Legacy                    | `updates/latest-legacy.json`       | None                                  |
| Experimental              | `updates/latest-experimental.json` | Add a new manifest and explicit route |

The app keeps the configured native Tauri URL,
`https://harbor.site/updates/latest.json`, with `x-harbor-channel: experimental`.
Its preliminary browser fetch instead uses `/updates/latest-experimental.json`
with no custom request header. This simple CORS GET avoids changing the normal
channels' preflight behavior. The compiled native endpoint and signing key stay
unchanged for existing stable/beta clients.

### 1. Review and deploy the explicit delivery branch

The `elfhosted/containers` harbor-site changes add an exact experimental branch
without modifying the existing stable/beta/legacy map. The dedicated URL and
native header path use one new njs validator. Backend deployment alone does not
install this route; review the active edge image and any private overlay too.

Pseudocode, not a deployment script:

```js
if (request.headers.get("x-harbor-channel") === "experimental") {
  const manifest = await readObject("updates/latest-experimental.json");
  if (!manifest) return noContentResponse(); // 204, never stable/beta fallback
  return experimentalManifestResponse(manifest);
}
return existingStableBetaLegacyHandler(request); // preserve existing behavior
```

The experimental response validates its channel and artifact namespace, returns
JSON with `Access-Control-Allow-Origin: *`, and does not require browser OPTIONS.
Missing or withdrawn candidates return 204; invalid candidates return 503.
An unavailable platform is omitted from `platforms`; do not substitute another
OS or architecture. Unknown/malformed experimental content must not become a
stable response.

Because multiple channels share one public URL, isolate caches too. Include the
normalized channel in every proxy/CDN cache key and send
`Vary: x-harbor-channel`. `Vary` alone is insufficient if a CDN ignores it.
Prefer bypassing shared manifest caches (`Cache-Control: no-store`) until the
channel-aware cache behavior is proven. Keep artifact caching immutable.

### 2. Review the isolated publisher and manual workflow

New source: `services/harbor-themes/src/lib/experimental-updates.js` in the hosted
repository. The old `updates-publisher.js`, release routes and release admin UI
remain unchanged. Authenticated `/themes/api/ops/releases/experimental/*` routes
and `deploy/scripts/experimental-release.mjs` handle only this channel. There is
no channel selector that could accidentally default to stable or beta.

An experimental publish must:

- Require the existing authorized maintainer approval and signing process.
  Public downloading does not grant anyone publishing access.
- Upload to unique version/build-specific artifact paths; never overwrite a
  stable/beta installer, signature, download alias or existing versioned object.
- Validate all required artifacts and signatures before publishing the manifest.
- Write artifacts and immutable history under
  `updates/experimental/<version>/<buildId>/`, then update
  `updates/latest-experimental.json` **last**. No other latest pointer is written.
- Not modify `updates/latest.json`, `updates/latest-beta.json`,
  `updates/latest-legacy.json`, existing stable/beta release histories, website
  latest-download links, or promotion pointers. Promotion is a separate action.
- Preserve a last-known-good manifest and installer for recovery. Withdrawing a
  candidate should make the experimental feed unavailable, not serve stable.

The actual workflow is offline plan, authenticated status, explicit upload,
read-only preview, then a separate explicit publish with the expected current
version AND build ID. A first publication uses the separate `--expect-empty`
option; literal build IDs such as `none` are not special values. Stale or incomplete
expectations are refused before writes, including withdrawals across reused IDs.
Uploading alone does not publish. Each mutation uses the existing
writer-lease fence. S3 and Postgres are not a single transaction; Linux CI and
staging still need to prove the ownership and failure cases before deployment.

### 3. Use this manifest contract

Illustrative values only. These URLs and signatures are placeholders, not builds.

```json
{
  "channel": "experimental",
  "version": "0.9.123",
  "buildId": "abc1234",
  "pub_date": "2026-09-03T00:00:00Z",
  "notes": "Included PRs and credits; changes; known issues; what to test.",
  "platforms": {
    "windows-x86_64": {
      "url": "https://downloads.example/updates/experimental/0.9.123/abc1234/Harbor_0.9.123_x64-setup.exe",
      "signature": "REPLACE_WITH_REAL_NSIS_SIGNATURE"
    },
    "darwin-aarch64": {
      "url": "https://downloads.example/updates/experimental/0.9.123/abc1234/Harbor_0.9.123_aarch64.app.tar.gz",
      "signature": "REPLACE_WITH_REAL_MACOS_SIGNATURE"
    }
  },
  "installer": {
    "windows-x86_64": {
      "url": "https://downloads.example/updates/experimental/0.9.123/abc1234/Harbor_0.9.123_x64-installer.exe",
      "signature": "REPLACE_WITH_REAL_HARBOR_SETUP_SIGNATURE",
      "size": 123456789,
      "payloadVersion": 9123
    }
  }
}
```

Requirements enforced by the app:

- `channel` is exactly `experimental`; `buildId` is 1–80 letters, digits,
  underscores, dots or hyphens.
- A `withdrawn: true` manifest is rejected independently of the edge response.
- `version` is a unique numeric `major.minor.patch` triplet. Minor and patch are
  below 1000. The payload value must fit safely in a JavaScript integer.
- Each supported exact OS/architecture has an HTTPS URL with no embedded
  credentials/fragment and a nonempty signature. Do not include top-level
  dynamic `url` or `signature` fields alongside `platforms`.
- A Windows recoverable handoff requires the separate `installer` entry, with a
  positive integer byte size and the unchanged payload formula:
  `major * 1_000_000 + minor * 1_000 + patch`.
- `platforms.windows-x86_64` stays the legacy Tauri/NSIS artifact. Never replace
  it with the new Harbor Setup executable. Normal beta updates use this artifact;
  experimental installation and return use `installer`, including the first
  automatic handoff from an existing NSIS installation. macOS uses the native
  Tauri updater only after its own return path is implemented and certified.
- Native updater metadata must match the app's preflight version, build ID,
  platform URL and signature. If publishing changes between those checks, the
  user is asked to check again. Actual bytes still require native signature
  verification; a nonempty signature string is not proof of validity.

Coordinate version allocation across maintainers before publishing. Changing
only `buildId` or appending `-experimental.2` cannot identify successive Windows
payloads with the existing installer. Do not change the payload formula here.

The prepared publisher/edge support Windows x86_64 (both installer paths are
required) and Apple Silicon macOS only. Omit unbuilt platforms; Intel Mac, Linux,
ARM Windows and legacy macOS are not emitted yet. Publisher build IDs must also
start alphanumeric and must not contain `..`. No version was allocated here.

Leaving experimental restores the saved normal channel, not the old binary.
Ordinary update checks do not allow downgrades: normal updates resume only once that channel
offers a numerically newer version. Stable currently uses a lower number range
than beta; maintainers must communicate the wait or provide a separately tested,
manual recovery procedure. Back up data before testing; a backup is not
a guarantee of downgrade compatibility.

## Prove stable and beta are unaffected before release

1. Save hashes/bytes of all existing stable, beta and legacy manifests and
   latest/history pointers, plus the URLs and hashes of their referenced assets.
2. Publish a candidate in an isolated staging environment first. Assert the
   publisher writes only experimental keys and rejects invalid channel names.
3. Compare the normal manifests, assets and pointers byte-for-byte afterward.
4. Request the shared endpoint with no header, `stable`, `beta`, `legacy` and
   `experimental`, in alternating orders with warm and cold caches. Each must
   return only its own channel; experimental must never populate normal caches.
5. Remove the experimental manifest in staging. Its request must return 204 or
   an explicit unavailable error; normal feeds must remain unchanged.
6. Test missing platforms, malformed metadata, altered URLs and bad signatures.
   None may install, fall back to a normal feed or launch an unsigned download.
7. Smoke-test packaged legacy Windows, managed Windows and each published macOS
   architecture. Keep the existing macOS dylib, signing/notarization and launch
   checks. A Windows TypeScript test cannot certify a macOS package.
8. Test opt-in, cancel, restart, profile changes, backup import, rapid channel
   changes, interrupted download/install, decline/retry and normal-channel exit.

Do not publish or label this release-ready until the backend contract and real
packaged installation/recovery checks have been reviewed by the release owner.

## Local app verification

- 17 focused updater/settings tests pass after the dedicated preflight URL and
  withdrawn-candidate guard. Backend workflow: 13 publisher/HTTP/CLI tests plus
  4 read-only delivery-check tests pass; existing publisher/auth/mount tests pass.
  One additional real-storage destination-safety check passes. Edge validation,
  routing and origin-fixture behavior: 8 tests pass. See the sibling runbook.
- The internal experimental fetch now strips client range/conditional headers,
  keeping explicit origin authentication. Normal manifests and installer range
  handling are unchanged.
- Prepared non-publishing CI now covers real PostgreSQL/MinIO multipart bytes,
  authenticated HTTP/CLI publication/withdrawal and lease loss, plus a running
  nginx/njs image against isolated HTTPS fixtures. The two integration cases
  explicitly skip locally because Docker/WSL are unavailable. Those Linux runs,
  staging/CDN verification and real packaged install/recovery remain pending.

- Settings > Updates & backup > Experimental builds, between Updates and Backup & restore;
  settings search also opens it here.
- Off by default, explicit confirmation, approved Harbor badge required, separate
  manual download and install actions, local-only consent, no backup enrollment.
- Frontend unit command: `node --experimental-loader ./scripts/node-test-loader.mjs --test tests/updater-experimental.test.ts`.
- TypeScript check and changed-file lint pass. Existing formatting differences
  in seven touched legacy files were also reproduced on the untouched baseline;
  they were not reformatted as part of this task.
- Full-suite baseline still has four failures: Arabic coverage (122 missing
  existing strings), fullscreen source parsing on CRLF, and two missing
  theme-store source references. No new updater failures were found.
- Browser preview verified search navigation and the unsupported web-build state.
  Native installer tests use mocks; Windows/macOS packaged testing is pending.
- Linux full-binary validation cannot run on this Windows host because WSL is not
  installed. The earlier feed preparation did not change Rust; the return-to-beta
  follow-up does. No signing key or Tauri endpoint configuration changed.
