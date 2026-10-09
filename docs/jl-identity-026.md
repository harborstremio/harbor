# JL identity and addon compatibility for 0.9.26

This change replaces the inherited external media account transport with JL identity and profile-local library storage. It does not publish a release or apply a database migration.

## Acceptance mapping

| Requirement | Implementation | Verification |
| --- | --- | --- |
| JL sign-in, no external media account gating | Shared AuthProvider uses the existing JL account client. Sidebar, account dialog, settings and desktop/TV onboarding use JL identity. A local library scope is available without signing in. | TypeScript and targeted identity tests. Live sign-in depends on the separately integrated JL account client/configuration. |
| No automatic external token transmission | Legacy auth storage is not read by AuthProvider. External login/link entrypoints reject without a request. Addon collection and library functions no longer call the external account API. | Network-free fixture tests and account-entrypoint source guard. |
| Preserve addon protocol/configuration compatibility | Manifest IDs, resource types, provider URLs, case-sensitive paths, configured queries, stremio:// links and persisted setting IDs remain supported. Distinct configurations with the same addon ID coexist; reconfiguration targets one URL. | Addon install/configuration tests, subtitle reach tests, existing addon tests. |
| Preserve local data and profile isolation | Existing addon installation/disabled keys remain usable, including legacy local migration. New library and retry queue are profile scoped. Addon order/backups migrate to the original primary profile without deleting the original bytes. Async addon completion cannot write into a newly selected profile. | Synthetic profile-switch, storage failure, queue, backup and history/bookmark tests. |
| Integrate JL profile sync | Library storage is `harbor.jl.library.v1.<profileId>` containing `LibraryItem[]`; `_id` and `_mtime` identify and order item updates. Writes emit `jl:library-changed`; library views also reload on `jl:profile-data-applied`. | Account/sync integration is owned separately; its serializer must exclude secret-bearing URLs and other local-only values. |
| Remove product account branding without breaking compatibility | JL account labels replace inherited account prompts. Product style labels use Classic/Addon list; persisted IDs remain unchanged. External-account promotion is removed. | Static UI review; legal notices and third-party addon directory attribution remain. |

## Deliberately preserved technical references

- Existing filenames, type/function exports and storage/setting IDs stay compatible with old consumers; `authKey` in the compatibility facade is now an opaque `jl-local:` routing scope, never a credential.
- Addon protocol schemes and manifest IDs (including third-party IDs), public addon directory addresses and metadata sources remain unchanged.
- Native streaming engine/server interfaces remain available. Renaming or removing them would break playback compatibility and is outside identity removal.
- License/trademark notices and attribution remain available in Licenses/About.

## Data coverage and limits

Existing local addon manifests, configured URLs, disabled flags, watchlist, favorites, resume data and history are retained. A collection that exists only in an external account and was never saved locally cannot be reconstructed without an explicitly supplied export. The app does not automatically fetch that account, use its saved tokens, or restore historical addon-order snapshots (which could resurrect intentionally removed addons). Legacy external-account storage and retry queue bytes are left untouched for recovery; they are not used by the new runtime.

New keys that the JL account workspace must park/purge per profile: `harbor.jl.library.v1.`, `harbor.jl.library-queue.v1.`, `harbor.addonOrder.`, `harbor.addonOrderBackups.`. Legacy unscoped order/backups must be parked on account switching as well. Configured URL backups are local-only and must never be exported by automatic account sync.

No live provider playback, provider downloads, auth/database mutation, installer launch, publishing, or credential rotation was performed for this change.

## Validation

- 57 targeted tests pass, covering the new local transport, credential rejection, storage failures, profile-scoped retry queues, configured addon instances, refresh races, subtitle reach, bookmark/history semantics and outgoing/incoming episode progress.
- Settings search passes all 47 query checks. Settings health reports the same nine failing groups as the unchanged `33702fbe` baseline; there are no added findings.
- The separate existing `addon-origin-persistence` failure was reproduced on the unchanged baseline: local metadata intentionally retains the addon base. JL cloud sync must sanitize it at its serialization boundary.
- `pnpm run check` cannot execute because `vp` is not installed in the repository environment. `pnpm tauri:build:linux-system` cannot execute because Cargo is unavailable. No Rust source changed.
- Final TypeScript and frontend build results are reported in the agent handoff; release/native verification belongs to the integrated EXE build.
