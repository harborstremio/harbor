# AGENTS.md

## Task Completion Requirements

- Run `vp check` for files changed by the task before considering it complete.
- Run `vp run typecheck` after TypeScript changes.
- Run `cargo check --manifest-path src-tauri/Cargo.toml` after Rust changes.
- Test platform-specific changes on the affected platform when possible.
- Do not leave warnings or errors introduced by the task unresolved.
- If a repository-wide check fails on untouched files, record the baseline and do not reformat or refactor unrelated files.

## Project Snapshot

Harbor is a cross-platform Stremio client built with Tauri 2, React, TypeScript, Rust, and libmpv.

The frontend owns the interface and user interactions. Rust owns native integrations, playback, operating-system behavior, and performance-sensitive work.

## Core Priorities

- Correctness and reliability.
- Smooth playback and responsive navigation.
- Consistent behavior across Windows, macOS, Linux, and TV-style input.
- Simple and maintainable code.

When trade-offs are required, prefer predictable behavior over clever or temporary solutions.

## Maintainability

- Inspect existing code before adding new abstractions.
- Reuse shared logic instead of duplicating it.
- Keep components focused and reasonably small.
- Keep platform-specific behavior isolated.
- Fix root causes instead of adding local workarounds.
- Do not perform unrelated refactors.

## Architecture

- `src/`: React and TypeScript application.
- `src/components/`: Reusable interface components.
- `src/hooks/`: Shared React behavior.
- `src/lib/`: Framework-independent TypeScript utilities.
- `src/router/`: TanStack Router shell and view/path synchronization.
- `src-tauri/`: Tauri application and native Rust integrations.
- `src-tauri/src/`: Native commands, playback, window management, and platform-specific code.
- `harbor-core/`: Shared Rust stream parsing and ranking logic.

Keep business logic outside React components when it can be expressed as a reusable module.

## Playback

- Treat mpv as the source of truth for playback state.
- Keep the React interface synchronized through events rather than assumptions.
- Avoid blocking work inside mpv callbacks.
- Preserve playback behavior on every supported platform.
- Do not mix platform-specific window logic with general playback logic.

## Navigation and Input

- Focus and activation are separate actions.
- Keyboard, remote, and gamepad navigation must behave consistently.
- Focusing an input must not start editing it.
- Inputs become editable only after explicit activation.
- Preserve the user's configured hotkeys.

## Reference Repositories

Use these repositories as implementation references:

- Stremio protocol and application behavior: <https://github.com/Stremio/stremio-core>
- mpv lifecycle and desktop playback: <https://github.com/jellyfin/jellyfin-desktop>
- Tauri and libmpv integration: <https://github.com/MaxMB15/MaxVideoPlayer>

Use references to understand established patterns. Do not copy large implementations or introduce incompatible architecture.

## Working Rules

- Read the relevant files before making changes.
- Follow the existing naming and code style.
- Keep changes limited to the requested task.
- Preserve backward compatibility unless explicitly asked otherwise.
- Do not silently change user-facing behavior.
- Add comments only when they explain a non-obvious decision.
- Never expose secrets, tokens, private URLs, or user data.
