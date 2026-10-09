# JL desktop account and profile sync

This implementation uses the existing JL Supabase `media` schema. It does not use a Stremio account or the separate Harbor theme-account sync server. It requires the JL account configured by `JL_SUPABASE_URL` and `JL_SUPABASE_ANON_KEY` in the existing release workflow. No database migration, key rotation, provider request or live authentication test was performed for this change.

## Runtime wiring

- Mount `JlAccountWorkspaceBoundary` above settings/profile providers and pass the window's `onReady` callback. A failed startup account reconciliation renders a recovery notice and preserves data.
- Keep `JlAccountSync` mounted inside settings/profile providers. It registers the profile metadata port and runs profile/favorites/key sync.
- Identity changes stage and persist a separate local roster/settings workspace before publishing the JL session. A session-storage failure rolls back the workspace. Actual user-ID changes reload providers/caches; same-user refresh does not.
- Offline/download scope uses `JSON.stringify([currentJlSession()?.userId ?? "local", activeProfileId()])`. Consumers can subscribe to `subscribeJlSession`, `jl:account-changed`, and `harbor:active-profile-changed`.

## Data contract

Each local profile explicitly links to a JL profile UUID and account owner. Empty accounts bootstrap once; newly created local profiles create a new UUID automatically. A new device chooses an existing account profile by UUID rather than guessing by display name. Retryable creation IDs prevent duplicate profiles when a response is lost. Rebinding an already-owned local profile to a different remote profile is refused to preserve its data; create/select a separate local profile instead.

The existing `media.profiles.settings.jl_harbor_v1` document carries allowlisted profile data and a revision. Every PATCH compares the exact existing server `updated_at` plus document revision, preserving other consumers' settings. A conflict re-pulls at most three times. Item-level three-way merge preserves independent additions/deletions and chooses the account version for a same-item conflict; losing local edits remain in a local conflict backup, with a visible notice and user-initiated JSON export.

Synced now:

- Profile name and color.
- UI/metadata region and language, preferred media/audio/subtitle languages, subtitle defaults, next-episode autoplay, playback speed, trailer autoplay and streaming-service selections (14 explicit preference fields).
- Media favorites, watchlists, the JL local library, watch history and public/private continue-watching progress, preserving provider/episode IDs.
- Sports team/player membership through existing `media.favorites` rows.
- Enabled selections for locally installed addons with an unambiguous manifest ID. Multiple configured instances keep independent local flags.
- The existing encrypted service-key/IPTV setting whitelist, now guarded by account ownership and stale-account checks. The whitelist was not expanded.

Preserved locally and intentionally not exported:

- Configured addon transport URLs, addon-origin URLs, stream URLs, request headers, signed artwork URLs, local paths and profile PIN/password hashes.
- Addon installation/configuration bytes, including multiple instances with the same manifest ID.
- Device-specific preferences and custom profile artwork; unknown future settings fields are excluded by default.
- Existing legacy sharing aliases are respected for addon/watchlist/shared-progress stores; new profiles default to independent libraries.

Local persisted data is the offline queue. Network failure does not acknowledge it. Sync retries on reconnection, visibility, library/favorite changes and a 30-second interval. Edits made during an in-flight request remain local and are compared with the acknowledged base on the next run. Storage failures do not discard the pending base.

## Verification and remaining prerequisites

Mock tests cover session races, 401 refresh, sign-out, selective storage failure and rollback, cold-start recovery, legacy ownership quarantine, stale account responses, profile UUID ownership, compare-and-swap retries, merge/deletion conflicts, concurrent local edits, local-only metadata preservation, duplicate addon configurations and credential-free serialization. This is not proof of a successful real user login or provider playback.

Production requires the existing `media` schema to be exposed to PostgREST, the existing profile ownership policies/grants and `profiles_touch` trigger, and existing `get_secrets`/`set_secret` functions for the already supported key sync. Their live state has not been inspected or changed. If absent, source SQL is `supabase/jl-vision/0001_media_schema.sql`; applying it or changing auth/RLS requires specific approval.

The Watch frontend's public profiles schema differs from this desktop media schema. Cross-product mapping is not implemented or claimed here. This local desktop change must be integrated with the identity/offline work, built and assessed before any 0.9.26 publication.
