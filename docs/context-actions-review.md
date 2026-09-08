# Context actions: implementation and verification

Review snapshot: 9 September 2026, `feat/context-actions`, compared with base
`7e4f0773971fd279e5b88e71cfecd4398c391b8b`. This records the implemented scope and
evidence available during review. The final isolated Windows application is built
and smoke-tested, and the final browser bundle passed a guest-mode watched-state
round trip. It is ready for user testing. The final test run retains nine baseline
failures; typecheck and changed-file checks pass. Remaining manual checks and the
user's trial are still required before merge or release.
The coordinator rechecked `origin/beta-branch` with `git ls-remote`; it still
matched the exact base commit above at this review snapshot.

The [implementation plan](superpowers/plans/2026-09-08-context-actions.md) describes
the agreed scope. The source links below are the primary implementation evidence.
Source coverage does not imply every surface has been exercised interactively.

## Surface coverage

| Surface                                            | Implemented scope                                                                                                                                                                                                                                                                                                           | Primary sources                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titles, posters, heroes, search and continue cards | Shared title actions composed with the image or link actually clicked; registered primary actions preserve the surface's existing navigation/play behavior.                                                                                                                                                                 | [Target registry](../src/lib/context-menu.tsx), [menu composition](../src/components/context-menu.tsx), [PickCard](../src/components/pick-card.tsx), [TV card](../src/components/tv-card.tsx), [continue card](../src/components/continue-card.tsx), [search poster](../src/components/search/result-poster.tsx)                         |
| Episodes and watched state                         | Explicit episode/season/title scope; the shared executor checks current account and provider capabilities before writing.                                                                                                                                                                                                   | [Episode menu](../src/components/episode-watched-menu.tsx), [media commands](../src/lib/media-context-actions.ts), [provider adapters](../src/lib/media-provider-actions.ts)                                                                                                                                                             |
| Collections, custom lists and their members        | Add, same-family Move and explicit source Remove; cover actions use actual Open/Edit/Add to page/Share/Delete callbacks and distinguish authored collections from saved copies.                                                                                                                                             | [Membership actions](../src/lib/membership-actions.ts), [destination chooser](../src/components/context-menu/my-list-submenu.tsx), [collection card](../src/views/collections/community-collection-card.tsx), [list settings](../src/views/library/list-detail/list-settings-menu.tsx)                                                   |
| Library history                                    | Source-aware removal with the actual supported scope; Stremio clearing explicitly names the whole title, including all episodes.                                                                                                                                                                                            | [History UI](../src/views/library/history-tab.tsx), [Stremio history service](../src/lib/stremio-history.ts)                                                                                                                                                                                                                             |
| Local library and home servers                     | Exact local file playback/reveal; library-entry removal keeps files. Multiple episodes, versions or server sources have an explicit chooser.                                                                                                                                                                                | [Local actions](../src/views/library/local-tab/card-actions.tsx), [local file validation](../src/lib/local-library/file-actions.ts), [server UI](../src/views/library/media-servers-tab.tsx), [version chooser](../src/components/player/local-versions-modal.tsx), [episode chooser](../src/components/player/local-episodes-modal.tsx) |
| Downloads                                          | Shared row/menu actions for play, pause, resume, cancel, retry, reveal and confirmed deletion; batch actions freeze exact eligible IDs for the selected scope.                                                                                                                                                              | [Download actions](../src/views/downloads/download-actions.tsx), [download store](../src/lib/download/downloads-store.ts), [native file commands](../src-tauri/src/download_files.rs)                                                                                                                                                    |
| People, profiles, friends, posts and comments      | Profile/copy actions, real relationship transitions, and permission-backed post/comment commands. Destructive operations require confirmation and acknowledged completion.                                                                                                                                                  | [Profile targets](../src/views/profile/context-targets.tsx), [friend command mapping](../src/lib/social/friend-command.ts), [group posts](../src/views/group/post-item.tsx), [profile comments](../src/views/profile/comment-item.tsx), [theme comments](../src/lib/theme-comment-actions.ts)                                            |
| Profile favorites: games, music and books          | Open/copy the item's actual page link when present (game-specific labels), image actions, and additive Add to my profile. Known duplicates are disabled; the command freshly validates ownership, capacity and account identity, preserves other sections/order/metadata, and requires the server to confirm the saved IDs. | [Favorite tiles](../src/views/profile/favorites-showcase.tsx), [profile mutation](../src/views/profile/use-favorites.ts), [strict snapshot policy](../src/lib/profile-favorite-actions.ts), [mutation tests](../tests/profile-favorite-mutation.test.ts)                                                                                 |
| Books, manga and reader pages                      | Reader-specific actions and actual page images; explicit collection/list membership remains available without exposing film-only watched/favorite actions.                                                                                                                                                                  | [Book menu](../src/views/ebook/ebook-wheel-menu.tsx), [manga reader context](../src/views/manga/manga-reader/reader-context.ts), [menu composition](../src/components/context-menu.tsx)                                                                                                                                                  |
| Live channels                                      | Existing channel tune/favorite actions and current program context are bound to the channel surface.                                                                                                                                                                                                                        | [Channel card](../src/views/live/channel-card.tsx), [live search row](../src/components/search/live-tv-row.tsx)                                                                                                                                                                                                                          |
| Page background and navigation                     | Current-page refresh through registered handlers, shared navigation choices and supported sidebar pinning; no universal cross-tab Back implementation.                                                                                                                                                                      | [Page navigation](../src/chrome/context-page-navigation.tsx), [page registry](../src/lib/context-page-store.ts), [navigation policy](../src/chrome/navigation-policy.ts)                                                                                                                                                                 |
| Rendered text, BBCode/HTML, images and Canvas      | Actual selected text, links and images; inner content can remain separate from a parent entity. Sandboxed frame image handling uses a Windows native bridge with a native fallback.                                                                                                                                         | [Content inspection](../src/lib/context-content.ts), [rendered content binding](../src/components/context-menu/rendered-content-context.tsx), [image actions](../src/components/context-menu/content-actions.tsx), [Windows bridge](../src-tauri/src/native_context_menu.rs)                                                             |

## Execution and data rules

- **Identity and permissions:** trusted React registrations supply entity identity,
  explicit membership and current action callbacks. Arbitrary HTML attributes do
  not grant entity identity, ownership or native privileges. Independent inner
  controls stop ancestor targets from taking over. Inputs, textareas and editable
  content retain their native editing menu and selection behavior.
- **Fresh execution:** [the action executor](../src/lib/context-actions.ts)
  re-resolves commands, rejects invalid/disabled targets and blocks duplicate
  in-flight execution. Menu sessions bind asynchronous close/focus work to their
  original opening. [MenuSurface](../src/components/context-menu/menu-surface.tsx)
  and [ActionItems](../src/components/context-menu/action-items.tsx) manage keyboard
  navigation, dynamic focus recovery, pending state and measured placement.
- **Membership:** [membership operations](../src/lib/membership-operations.ts)
  implement additive, idempotent Add. An existing destination item succeeds as an
  unchanged result even at capacity. Move requires an explicit source, item and
  active profile, and supports collection-to-collection or list-to-list only.
  Both containers are revalidated; moving to the source is a no-op. A fresh
  validated snapshot is replaced with one non-destructive `localStorage.setItem`.
  Failed writes preserve the source; unrelated item order and metadata survive.
  The new checked path does not report memory fallback as persistence. This is
  storage API acknowledgement, not a disk-flush guarantee.
- **Collection publication:** [publication commands](../src/lib/collection-publication.ts)
  and the [account write queue](../src/lib/collection-publication-queue.ts) serialize
  mirror updates and validate account/profile provenance. Deleting an authored
  collection checks the owner's complete server mirror; removing a published
  copy precedes local deletion and partial outcomes are reported. When the
  account mirror cannot be verified, an explicit local-copy-only route explains
  the limitation. Deleting a saved community copy never deletes its source.
- **History and provider state:** Stremio history clearing preserves watchlist
  membership and unrelated metadata. A profile/account switch after an accepted
  write reports that the previous account was changed and leaves the current
  view intact. Provider adapters report partial outcomes with provider details.
  Trakt mark-watched reads fresh paginated progress and writes only the unwatched
  subset, avoiding duplicate play events. Failed/malformed reads fail closed;
  account guards cover request retries and token-refresh settlement. The
  [official Trakt pagination/progress announcement](https://github.com/trakt/trakt-api/discussions/775)
  is the API basis for that read path.
- **Watched-status display:** [the shared reader](../src/lib/context-watched-state.ts)
  combines explicit local episode choices with provider evidence. It distinguishes
  watched, unwatched, partial and unknown state; loading or unreadable history
  does not become an unwatched assertion. Partial/unknown state offers explicit
  watched and unwatched actions. Provider/account changes invalidate snapshots,
  and cancellation stops subsequent reads. Anime reads require native catalog
  identity, verified episode order or an explicit provider episode mapping;
  a title-level IMDb alias alone does not prove TV episode coordinates.
- **Local files and downloads:** file operations revalidate the current record,
  exact path and native file state. Deletion waits for an active writer to settle,
  protects the active playback file, and never deletes a containing folder.
  Cancel keeps partial files. File deletion and record persistence failures are
  reported separately. PDF print receipts do not claim Harbor saved a PDF file.
  Retry requires a recoverable source; session-only request credentials are not
  persisted to make a restarted download appear retryable.
- **Images:** [the image service](../src/lib/context-image.ts) uses explicit
  original-image metadata rather than inventing a full-size URL. It validates
  protocols, bytes and image type, limits transfers to 32 MiB, bounds clipboard
  rasterization, and releases native clipboard resources. Public link actions
  pass [a separate URL policy](../src/lib/context-image-policy.ts). Browser fetch
  or clipboard failures remain visible failures; they are not success toasts.
- **Localization:** [context-only English fallbacks](../src/lib/i18n/locales/context-actions-fallback.ts)
  are included in the sixteen locale catalogs, with
  [Arabic translations](../src/lib/i18n/locales/ar/context-actions.ts) overriding
  that layer. This does not claim the new actions were translated into all
  sixteen languages. Existing unrelated fallback coverage was not broadened.

## Deliberate boundaries and current exceptions

- **Simkl remains blocked for an unsafe operation.** The current menu policy is
  `block`: a known unsupported membership-only removal/unwatch operation does
  not fall back to deleting the whole Simkl library entry and its history. The
  proposed safe-skip policy is pending the user's reply and is not the current
  behavior.
- **Canvas native interception is Windows/WebView2 only.** The native bridge
  reads frame context from WebView2, retains native editing commands, and uses a
  timed acknowledgement before replacing the native menu. Sandboxed blob URLs
  that cannot transfer to the main frame retain native image tools. This is not
  evidence of equivalent macOS, Linux, mobile or ordinary browser interception.
- **No invented Unfollow command.** The application exposes actual friend
  request/accept/cancel/remove transitions. An unsupported relationship command
  was not inferred from a label or added without a backing service.
- **AniList/MyAnimeList reads and writes have different support.** The watched
  reader can use their anime progress when identity and episode order are
  verified. Context-menu watched changes do not have write adapters for those
  providers. Results name each unsupported provider and tell the user to manage
  progress there, alongside any acknowledged local or other-provider changes.
  This disclosure does not claim new anime progress synchronization.
- Cross-family Move, universal cross-tab Back history and an icon-only menu
  toolbar remain outside the agreed implementation.

## Verification recorded so far

### Source checks and isolated tests

| Check                          | Recorded result                                                                                                                                                                             | Evidence                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Full frontend test suite       | 1,283 tests: 1,253 passed, 9 known baseline failures, 21 skipped. The suite is not wholly green.                                                                                            | Local `.diag/context-final-sweep-tests.log`                                                                       |
| Changed-files `pnpm run check` | 213 files formatted and 205 linted; 0 errors and 1 existing `unicorn/no-useless-spread` warning in `src/lib/gamepad/use-gamepad.ts`. Existing Vite tooling deprecation notices also remain. | Local `.diag/context-final-sweep-check.log`                                                                       |
| Final `pnpm run typecheck`     | Passed; coordinator confirmed final sweep exit 0.                                                                                                                                           | Local `.diag/context-final-sweep-typecheck.log`                                                                   |
| Git diff checks                | Clean; coordinator verified no whitespace errors.                                                                                                                                           | Coordinator's final sweep                                                                                         |
| Final Windows `cargo check`    | Passed with 3 existing dead-code warnings in `settings_store.rs`, `mpv.rs` and `svp.rs`.                                                                                                    | Local `.diag/context-final-cargo-check.log`                                                                       |
| Native policy unit tests       | Combined 4/4 passed: 3 file-policy tests and 1 native editing-menu policy test.                                                                                                             | [File policy](../src-tauri/src/download_file_policy.rs), [menu policy](../src-tauri/src/native_context_policy.rs) |
| New-string locale checks       | Source-delta scan found no missing effective catalog keys; the existing Arabic regex-coverage baseline remained exactly 410 missing keys, with none newly missing or repaired incidentally. | [Context i18n tests](../tests/context-i18n.test.ts); local `.diag/context-i18n-baseline.json`                     |

The nine baseline failures are in `i18n-coverage`, `p2p-torrent-lifecycle`,
`player-fullscreen-modes`, `stream-mode-controls`, `subtitle-font-selection`,
`subtitle-offset-indicator`, `subtitle-player-lifecycle`, and two
`theme-author-navigation` cases. They were retained rather than fixed through
unrelated changes.

Focused tests cover membership capacity/duplicates/transaction failure,
publication concurrency and provenance, source-aware history preservation,
provider partial results and request guards, download writer settlement and
file safety, trusted target/content selection, menu focus policy, image limits,
page navigation and reader context. Storage/account tests use isolated in-memory
fixtures or mocked requests, not real user accounts or saved library data.
The final sweep includes [watched-summary tests](../tests/context-watched-summary.test.ts)
and [watched-reader tests](../tests/context-watched-reader.test.ts) for provider-only
history, manual overrides, unreadable providers, partial progress, account
switches, cancellation and verified anime mappings. AniList/MyAnimeList
unsupported-write outcomes and their translated disclosure are also covered.
Regression tests observed failures before the corresponding fixes for focus
recovery, post-write account switches, translated partial errors, Trakt watched
preflight and retry/token-refresh guards.

Final source inspection also confirms explicit Remove from source appears in the
last separate group, after Watched and Image actions.

### Native fixture execution

The final isolated Windows native fixture rerun passed 8/8 checks, recorded in
local `.diag/context-delivery-native-fixture.log`. Its
[entry point](../src/context-review-main.tsx),
[configuration](../src-tauri/tauri.context-fixture.conf.json) and
[runner](../scripts/run-context-fixture.mjs) use a separate application identity,
test storage and test files. Native Copy image round-tripped the fixture pixels,
and native HTTP image loading passed against isolated loopback content. The
fixture also checked native editor filtering and sandboxed Canvas HTTP/blob
metadata and fallback behavior. Popup display was suppressed during autorun;
native editing-menu appearance and the Save dialog were not automated.

The fixture uses the same native Rust implementation but its own frontend entry
point. It does **not** exercise the full application's final asynchronous frame
event sequencing guard. Its results do not establish full native UI command
coverage or platform parity.

### Full Windows application build and smoke test

The final full-application build exited 0 after the watched-status correction;
evidence is in local `.diag/context-delivery-windows-build.log`. Native compilation
took 3 minutes 7 seconds and retained the three baseline warnings recorded above.
The isolated application artifact is
`src-tauri/target/context-artifacts/full/HarborContextReview.exe`, not the fixture
executable. Its independently checked size is 127,221,248 bytes and SHA-256 is:

`abaa0d1f0be8d63323542aede5a842aefffa3be54f7d5f6f05b2c26714991374`

The coordinator launched that exact path as its own process (PID 23232), observed
`Responding: true` and clean native initialization logs, then received `true` from
`CloseMainWindow` and confirmed process exit. Local evidence is in
`.diag/context-delivery-smoke.stdout.log`, `.diag/context-delivery-smoke.stderr.log`
and the corresponding PID record. This establishes final build/startup/shutdown
evidence, not full native menu, playback or file-operation coverage.

### Full-application browser observations

Earlier isolated browser checks exercised the following:

- Home poster right-click opened the composed title/content menu.
- ArrowRight opened the Image submenu and moved focus into it.
- An image fetch blocked by browser CORS was shown truthfully as a failure.
- Escape from the image viewer returned focus to the original poster.
- Shift+F10 opened a menu clamped within a 1,278 × 800 viewport.
- Creating a list from a movie persisted one item, visible in My Lists.
- Adding that movie from QA list A to list B preserved A's item. The already-added
  destination became disabled. Moving from A into the already-populated B then
  produced A = 0 items and B = 1 item, without a duplicate. A fresh tab at the
  same origin retained both lists and those counts, checking persisted state
  beyond the original page's memory.
- Arabic set the document to RTL. At 961 × 600, both the main menu and Image
  submenu stayed inside the viewport; ArrowLeft opened the submenu and focused
  View image.
- With a menu opened from a visible poster, an outside left-click on the visible
  Home sidebar control dismissed the menu while leaving QA list B detail open.
  The click did not navigate through the dismissed menu.

After the final build, a fresh production-browser tab in guest mode completed a
Home movie's watched-state round trip: Mark watched, reopen to find Mark unwatched,
execute that reverse action, then reopen to find Mark watched again. No alerts or
errors appeared, and Escape returned focus to the original card. The viewport was
reset afterward. This final-bundle check used no real provider accounts.

Browser observations and native fixture results are separate evidence. They do
not establish native Save-dialog behavior, every entity menu, real provider
writes or all keyboard/RTL/dynamic-layout cases.

## Remaining manual checks and limits

- **Full native interaction:** the Save dialog and cancellation, actual reveal
  and playback commands, visible native editing menu, and the full application's
  final asynchronous frame event sequencing guard remain manually unverified.
- **Broader input and surface coverage:** physical remote/gamepad input, every
  entity surface, second-right-click/session interactions and all dynamic
  focus/scroll/resize cases have not been completed as full-app manual tests.
  Background navigation/refresh was not manually exercised. Existing focused
  tests are not a substitute for those observations.
- **Connected-account behavior:** social and provider writes were tested with
  mocks only; no real account data was mutated. The user's connected-account
  trial, including provider-backed partial/unavailable watched-state UI, remains
  outstanding.
- **Linux binary:** `pnpm tauri:build:linux-system` was attempted. The frontend
  built; native build exited 1 because `x86_64-unknown-linux-gnu` is not installed
  on this Windows host (only `x86_64-pc-windows-msvc` is installed). No Linux
  binary or Linux runtime verification is claimed. Evidence: local
  `.diag/context-final-linux-system-build.log`.
- **Simkl policy decision:** await the user's reply before replacing the current
  block policy with safe-skip behavior.
- **User trial:** the final isolated application is ready for testing. Record the
  user's results and unresolved limitations before treating a draft review as
  ready to merge or release.
