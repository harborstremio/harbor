# Context menus

Harbor composes one menu from the clicked entity, its explicit membership or page context, and useful content beneath the pointer. A title poster can expose title actions and image tools; a comment author or embedded link owns its own target instead of inheriting unrelated actions from the surrounding card.

## Ownership and lifecycle

- `src/lib/context-menu.tsx` owns menu instances, target registration and invocation. Semantic validity is separate from the optional element used to restore focus. A harmless rerender or a disappearing hover trigger does not invalidate an otherwise valid target.
- `src/components/context-menu.tsx` composes the target's actions. `src/components/context-menu/menu-surface.tsx` owns measurement, focus, keyboard navigation, nested surfaces and dismissal. The popout helper anchors motion to resolved geometry and respects reduced motion.
- Targets capture account/profile, source and item identity where necessary. Commands recheck those boundaries before applying delayed work. Replacing a menu cannot let an older callback close or mutate its successor.
- Native input editing remains native. Readable selections, images and links have explicit payloads. Isolated frame content cannot declare trusted account identities or native file commands; Windows uses a limited WebView2 bridge with acknowledgement and native fallback.

## Commands and existing workflows

| Area                  | Behavior                                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation            | The quick strip has available Back, an explicitly named copy action, and Settings. Go to uses the real navigation catalog, customization and PIN flow. Refresh uses Harbor's existing reload operation.                                                                                                                                                              |
| Player                | Uses player quick actions, conditional Copy magnet, Settings, subtitle export and the same Live sync session as the subtitle UI. Page navigation and global continuation are absent. Existing player exit, progress saving and cleanup remain in charge.                                                                                                             |
| Continuation          | Global Continue last watched is a normal root row outside the player. It targets the last actual playback and saved tracks. A Continue Watching card independently targets its own entry. Guest local-card dismissal preserves its file and saved position. Signed-in and external-provider dismissal retain Harbor's existing history and progress-reset semantics. |
| Add to                | Lists and Collections are grouped. Each destination applies and persists its own membership change immediately while the submenu remains open. Creating a list retains the selected item. There is no Move to or Save/Apply step. Manga uses its own list store.                                                                                                     |
| Collections           | Opening, saving a source copy, editing an owned copy, removing membership and publishing have different targets and checks. Destination artwork comes from the designated cover/background, with Harbor's Collections icon as fallback.                                                                                                                              |
| Watched state         | Episode, season and title scopes stay explicit. Provider and actor checks guard writes, partial results remain visible, and unknown state is not treated as unwatched.                                                                                                                                                                                               |
| Downloads and files   | Contextual download preparation shares the current source-selection operations. A download task differs from its completed file. Confirmation captures the exact scope; cancellation waits for native writers, and deletion rejects folders, links and the active playback file.                                                                                     |
| Manga                 | Favorites, saved chapter/page continuation and downloads use current provider capabilities and source-qualified identities. Official library, chapter, bookmark, scanlator and reader behavior remains available.                                                                                                                                                    |
| Images                | Browsing thumbnails remain efficient. Viewing and saving resolve full-quality artwork without changing its identity or eagerly fetching originals across a catalog. Copy Image copies image data; Copy image link copies a URL.                                                                                                                                      |
| Profiles and comments | Account/author identity and permission checks are shared with the existing actions. Copy Text copies the intended content, separately from any selected text or embedded link.                                                                                                                                                                                       |

## Extending the system

Register an explicit semantic target on a meaningful component; do not infer a media ID from an arbitrary image URL or from the page behind an overlay. Use action metadata for labels, icons, groups, state and execution. Keep domain operations in their existing services or small domain helpers, rather than adding persistence logic to the menu renderer.

Supply stable source identity and a current-validity check for operations whose owner can change. A temporary visual trigger is not itself the semantic owner. Internal buttons, links, author images and native editors must retain their own context priority.

Reuse the shared menu surface for layering and interaction. Commands are available during opening; ordinary state updates do not replay the entrance. Keyboard/remote activation is separate from focus, and Escape closes the nearest owning layer.

## Integration with the official beta baseline

This contribution integrates official 0.9.127 through `e28bc25df122ef5b6a5b102a8ecc369ddb2d11fe`. It retains upstream dependency versions, routing and playback generations, music/sports navigation, manga stores and source handling, profile-authentication refresh, and the Capstan integration. The additional development dependency is `jsdom` for actual React/DOM interaction tests.

The independent Windows evaluation binary at contribution commit `203997fa3d0b21e9914ad7b39d9a830d0630fd7d` was built and tested on the preceding official base `770ca0bd4beec9584494bf5059e2314008c6bd41`. It does not include the subsequent Capstan update. Build and runtime verification must identify the source commit; that earlier binary is not evidence of a successful native build of the later merge.

The Node loader supports the same SVG and stylesheet import boundaries used by those tests. DOM tests do not establish visual rendering or native clipboard/file behavior; those require browser and native verification respectively.

## Optional independent desktop evaluation

`context-review` is an opt-in Cargo feature with `src-tauri/tauri.context-review.conf.json`. Production defaults are unchanged. It uses a separate application identifier and temporary directory, avoids registering file/deep-link ownership, and disables the updater and production orphan/temp cleanup for that evaluation instance.

A local configuration may set an identifier of the form `app.harbor.context-review.<run-id>` for fresh storage; `<run-id>` accepts lowercase ASCII letters, digits and hyphens. Keep the product name `Harbor Context Review`. A release identifier cannot be used with the feature.

```sh
pnpm install --frozen-lockfile
pnpm tauri build --config src-tauri/tauri.context-review.conf.json --features context-review --no-bundle
```

Use a fresh run identifier when previous evaluation storage may contain imported personal data. Separate application storage is **not** a filesystem sandbox: file commands still use the files the user selects, so mutation checks must use disposable files and controlled accounts. Local diagnostic harnesses, recordings and account snapshots are not part of this contribution.

## Verification boundaries

Run changed-file `pnpm run check`, `pnpm run typecheck`, applicable Node tests, and `cargo check --manifest-path src-tauri/Cargo.toml`. Native policy modules also contain isolated Rust tests. Follow the repository's full build instructions on the affected platforms.

Review target replacement, actor changes, hover-trigger removal, nested content, immediate membership persistence, global versus per-card continuation, native editing, file identity, and keyboard/remote focus. Repeat image/clipboard, isolated-frame and playback scenarios in the actual Tauri runtime. A browser preview or successful compilation alone does not verify these native operations.
