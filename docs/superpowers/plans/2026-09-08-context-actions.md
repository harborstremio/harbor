# Context actions implementation plan

> For agentic workers: use subagent-driven-development for independently owned service changes, then review integration and the whole branch.

Goal: a shared Harbor menu interaction that composes trusted entity, explicit membership and clicked content actions, with truthful execution and an isolated test build.

Architecture: explicit component targets and a limited content resolver feed small action providers. A shared measured, focused menu renders actions; domain stores and native adapters execute them. Preserve player, reader and Big Picture special input contracts.

Tech stack: existing React/TypeScript, Node test runner, Tauri 2/Rust, Windows WebView2. No new runtime dependency by default.

## Constraints

- Independent branch `feat/context-actions`, base `7e4f0773971fd279e5b88e71cfecd4398c391b8b`; no ElegantFin modifications.
- Native fixtures and the review build use their own identifier/storage and test-only files. Never import the user's account or operate on their media.
- No arbitrary HTML attributes confer entity identity, permissions, credentials or native file access.
- Keep native editing deliberate, iframe sandbox intact, source-aware removal, exact file IDs, and shared row/menu services.
- Deferred by agreement: cross-family Move, universal cross-tab back history, icon-only menu toolbar. Unfollow stays unverified until its source is known.
- AniList/MyAnimeList anime progress can inform the watched reader, but context-menu watched writes do not sync to them. Explicit unsupported-provider outcomes disclose this boundary; no new write adapter is claimed.

## Implementation deliverables

Completed implementation is separate from the remaining manual checks below.
The [review record](../../context-actions-review.md) contains the source coverage
matrix, test results and platform limitations.

- [x] Foundation: typed command composition, trusted targets, actual clicked content, measured menu placement, fresh execution guards and session-bound focus behavior; focused tests added.
- [x] Native/content: validated image loading/view/copy/save services, isolated review configuration/runtime and Windows native editable/Canvas integration. Image policy/resource tests and native fixture probes pass; other platforms are not claimed equivalent.
- [x] Membership: typed additive Add, same-family Move and explicit source Remove with fresh snapshots and non-destructive acknowledged persistence. Tests cover capacity, duplicates, source/profile validation, failure preservation and metadata/order.
- [x] Entity bindings: shared posters and independent library/search/collection surfaces; people/profile/game/comment/BBCode bindings; semantic book/manga/channel actions and permission/source guards.
- [x] Background: shared effective sidebar destinations, PIN dispatcher and icon configuration, plus opt-in active-page refresh and focused route/profile tests.
- [x] Downloads/files: exact job/file targets, writer settlement, ownership validation, truthful recovery, confirmed file deletion and partial outcomes; isolated tests cover failure and changing-state cases.
- [x] Shared domain correctness: explicit watched/history scope, additive memberships, current-account guards, acknowledged writes and translated partial failures. The provider-aware reader now distinguishes watched/unwatched/partial/unknown state and tests cover unreadable history, session changes, cancellation and verified anime mappings. AniList/MyAnimeList unsupported writes are disclosed; Simkl's unsafe operation remains blocked pending the user's safe-skip reply.
- [x] Final integration verification and testing artifact: final typecheck passed; 213 files passed formatting, with 205 linted and one existing warning. Final suite: 1,283 tests, 1,253 passes, 9 unchanged baseline failures and 21 skips. Cargo check passed with existing warnings. The final isolated Windows application built after the watched-status correction and passed startup/shutdown smoke testing; its size/hash are in the review record. Linux build was attempted and blocked by the missing Linux Rust target on this Windows host.

## Completed interactive and native-fixture observations

- [x] Browser poster right-click, Image submenu arrow/focus, Shift+F10 placement and viewer Escape returning focus to the poster.
- [x] Browser Create list, additive Add preserving the source, disabled duplicate destination, and Move into an existing destination without duplication. A fresh same-origin tab retained lists A = 0 and B = 1.
- [x] Arabic RTL direction and 961 × 600 main/submenu viewport clamping; ArrowLeft entered the Image submenu. Earlier 1,278 × 800 keyboard opening also passed.
- [x] Browser CORS image failure displayed as failure; separate native fixture copy and loopback HTTP image loading passed. Final native fixture rerun passed 8/8 with the same native Rust code, but its own frontend does not exercise the full application's final asynchronous frame guard.
- [x] Final Windows `HarborContextReview.exe` launch from the exact artifact path (PID 23232) responded, logged clean native initialization and exited after graceful main-window close. This is smoke evidence, not full native UI command coverage.
- [x] An outside left-click on the visible Home sidebar control dismissed a visible poster menu without leaving QA list B detail.
- [x] A fresh final production-browser tab in guest mode completed Mark watched → reopen Mark unwatched → execute reverse → reopen Mark watched, with no alerts/errors. Escape returned focus to the original card; no real provider accounts were used.

## Remaining manual validation and limits

- [ ] Full native Save dialog/cancellation, visible editor-menu appearance, actual reveal/play commands and final full-app asynchronous frame sequencing.
- [ ] Physical remote/gamepad input and the remaining full-app keyboard/session/dynamic focus, submenu scroll/resize and second-right-click cases across entity surfaces. Background navigation/refresh was not manually exercised.
- [ ] User trial of the isolated full application, including connected-account behavior and provider-backed partial/unavailable watched-state UI. Social/provider mutations were tested only with mocks; no real account data was changed.
- [ ] Simkl safe-skip policy decision from the user; current behavior remains `block` without destructive fallback.
- [ ] Linux binary/runtime validation on a suitable toolchain. The frontend built during the required attempt, but the Linux target was absent; no Linux binary was produced.

The final isolated Windows application is ready for user testing. Build, smoke,
guest watched-state UI and source-check evidence is recorded with the documented
baseline failures/warnings. User trial and the manual checks above remain open;
the implementation is not declared ready to merge or release.

## Work log

- Dependencies installed from frozen lockfile. Baseline test suite started before production changes.
- Parallel ownership: membership stores; native/image adapters and isolation; downloads lifecycle/UI; root menu framework and broad entity integration.
- Root owns integration commits and final review/build; agents do not commit overlapping work.
