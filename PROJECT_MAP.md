# PROJECT_MAP: Harbor Master Architectural Reference & AI Developer Guide

> **TARGET AUDIENCE**: This document is the authoritative master reference and architectural map for any AI Agent or human developer modifying, auditing, or upgrading this repository (`harbor`). Read and adhere to every section before executing source code changes.

---

## 1. [PROJECT_OVERVIEW & FORK_MISSION]

**Harbor** is a high-performance, cross-platform **Stremio client** powered by **Tauri v2 (Rust)**, **React 19**, **TypeScript**, and **native `libmpv`**.

### 🌟 Our Fork's Strategic Mission (`2-sa/harbor`)

Unlike the upstream `harborstremio/harbor` repository, our fork is engineered around four non-negotiable pillars:

1. **Absolute Privacy & Direct Authentication (`No Proxies`)**: All third-party authentication relays/proxies (`harbor.site`, `bugs.harbor.site`) are strictly excised. The application communicates directly with official API endpoints (`Trakt`, `AniList`).
2. **Strict Security Hardening (`SSRF & Path Sandbox`)**: Native IPC commands enforce strict network bounds (`SSRF protection` blocking local loopback/private IPs) and filesystem sandbox boundaries.
3. **Windows x86_64 Optimization (`CI/CD Efficiency`)**: All automated build pipelines (`GitHub Actions`) and local builds are streamlined and restricted to target **Windows x86_64** exclusively (`x86_64-pc-windows-msvc`), eliminating wasted build minutes on macOS/Linux/Flatpak/ARM.
4. **Seamless Embedded Player Rendering (`Transparent WebView`)**: On Windows desktop, `mpv` renders directly inside a child window beneath the Tauri WebView2 DOM. The WebView background must maintain proper transparency so video surfaces remain visible without black screens.

---

## 2. [CRITICAL_AI_RULES & INVIOLABLE_MANDATES]

Any AI modifying this codebase **MUST STRICTLY ENFORCE AND PRESERVE** the following invariants:

### 🚫 Rule 1: NEVER Re-introduce Authentication Proxies or Telemetry

- **Trakt Auth (`src/lib/trakt/config.ts` & `src/lib/trakt/client.ts`)**:
  - `TRAKT_TOKEN_PROXY` **MUST** point to `${TRAKT_API_BASE}/oauth/token`.
  - `TRAKT_DEVICE_TOKEN_PROXY` **MUST** point to `${TRAKT_API_BASE}/oauth/device/token`.
  - Do **NOT** accept upstream merges that overwrite these with `https://harbor.site/api/trakt/...`.
- **AniList Auth (`src/lib/anilist/config.ts`)**:
  - `ANILIST_TOKEN_EXCHANGE_URL` **MUST** point to `https://anilist.co/api/v2/oauth/token`.
  - `ANILIST_CLIENT_ID` **MUST** use our direct client ID (`42941` or configured local ID). Do **NOT** revert to `https://bugs.harbor.site/v1/anilist/token`.
- **Telemetry & Phoning Home**: Ensure `src/lib/bug-report.ts`, `src/lib/build-feedback-submit.ts`, and `src/lib/updater/versions.ts` remain decoupled or safe from tracking.

### 🛡️ Rule 2: NEVER Bypass or Remove SSRF Protection (`http_fetch.rs`)

- In `src-tauri/src/http_fetch.rs`, the `harbor_fetch` Tauri command **MUST** always execute the block:
  ```rust
  if is_blocked_ssrf_url(&args.url) {
      return Err("fetch target blocked by SSRF protection".to_string());
  }
  ```
- `is_blocked_ssrf_url` protects the user's local network from malicious add-ons attempting to scan or fetch from `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, `169.254.169.254`, `192.168.x.x`, `10.x.x.x`, and `172.16.x.x-172.31.x.x`.

### 🪟 Rule 3: Maintain Windows Embedded MPV Transparency (`use-mpv-embed.ts`)

- In `src/views/player/hooks/use-mpv-embed.ts`, the check enabling `data-mpv-embed = "1"` on the root document element **MUST** include `isWindowsDesktop()`:
  ```ts
  const needsTransparentWebView = isLinuxDesktop() || isMacDesktop() || isWindowsDesktop();
  ```
- Without this, Windows WebView2 renders an opaque `#0d0f14` background, obscuring the native `mpv` video surface completely (`Black Screen Bug`).

### ⚡ Rule 4: Keep CI Workflows Restricted to Windows x86_64 & Apple Silicon (`tauri-build.yml`)

- In `.github/workflows/tauri-build.yml`, the build matrix **MUST** only contain:
  ```yaml
  platform:
    - name: Windows
      runner: windows-latest
      target: x86_64-pc-windows-msvc
      bundle: msi
    - name: macOS Apple Silicon
      runner: macos-14
      target: aarch64-apple-darwin
      bundle: dmg
  ```
- `tauri-build.yml` is configured with `on: push (branches: [main])` and `concurrency: cancel-in-progress: true` so standalone installer builds (`.msi` + `.dmg`) run automatically upon pushing or merging code to `main`.
- Do **NOT** add back `macOS Intel (x86_64)`, `Linux`, or `ARM64 Windows` runners unless explicitly instructed by the user.

### 👤 Rule 5: Git Author Identity

- When committing any changes, the local git configuration **MUST** be set to `Harbor Dev <dev@harbor.local>` (`git config user.name "Harbor Dev" && git config user.email "dev@harbor.local"`).

---

## 3. [TECHNICAL_STACK & DIRECTORY_MAP]

```
harbor/
├── src/                               # Frontend (React 19 + TypeScript + Vite + Tailwind CSS)
│   ├── components/                    # Reusable UI components (LottieLoader, Transport, SubtitleMenu)
│   ├── views/                         # Main application views
│   │   ├── home/                      # Catalog grids, hero banners, continue-watching rows
│   │   ├── player/                    # Video playback interface, subtitle menu, HUD, trickplay
│   │   │   ├── hooks/                 # Playback hooks (`use-mpv-embed.ts`, `use-track-autoload.ts`)
│   │   │   └── shell-layer.tsx        # UI controls floating over video surface
│   │   └── settings/                  # Application configuration (`advanced-panel.tsx`, `language-panel.tsx`)
│   ├── lib/                           # Framework-independent services & external API adapters
│   │   ├── trakt/                     # Direct Trakt API client & scrobbling (`config.ts`, `client.ts`)
│   │   ├── anilist/                   # Direct AniList GraphQL client (`config.ts`, `auth.ts`)
│   │   ├── subtitles/                 # Subtitle parsing, encoding, auto-loading, search (`parser.ts`)
│   │   ├── player/                    # Bridge between React UI and native libmpv / HTML5 engines
│   │   └── request-scheduler.ts       # Rate-limited HTTP request scheduler for providers/addons
│   └── index.css                      # Global design system tokens & `.data-mpv-embed` transparency rules
├── src-tauri/                         # Backend (Rust Tauri v2 Application & Native Capabilities)
│   ├── src/                           # Rust source modules
│   │   ├── lib.rs                     # Core application entrypoint & filesystem commands (`save_text_file`)
│   │   ├── mpv.rs                     # Native libmpv integration, window management, Z-order positioning
│   │   ├── http_fetch.rs              # High-concurrency HTTP client (`harbor_fetch`) with SSRF blocking
│   │   ├── download.rs                # Background file download manager (`download_start`)
│   │   ├── torrent_engine/            # Custom embedded BitTorrent engine (`netcheck.rs`, `stream_proxy.rs`)
│   │   └── thumbs.rs                  # Thumbnail extraction worker and cache manager
│   ├── capabilities/default.json      # Strict security capability definitions (`fs:allow`, `shell:allow`)
│   └── tauri.conf.json                # Tauri v2 application configuration, permissions, window properties
├── harbor-core/                       # Standalone Rust library crate shared across targets
│   └── src/                           # Stream extraction, ranking, sorting, and protocol parsing logic
├── tests/                             # Vitest automated test suites (`subtitle-autoload`, `keyboard-focus`)
└── .github/workflows/                 # Automated CI/CD pipelines (`tauri-build.yml`, `app-build.yml`)
```

---

## 4. [CORE_SYSTEM_FLOWS]

### 📡 A. Addon Query & Stream Resolution Flow

1. **User Request**: User selects a movie/episode or opens the catalog.
2. **Addon Execution**: `stremio-addons.ts` dispatches parallel HTTP queries via `request-scheduler.ts` to installed Stremio community/official add-on endpoints.
3. **Rust Proxying (`harbor_fetch`)**: If an add-on requires CORS bypass or custom headers, the query routes through `#[tauri::command] harbor_fetch` (`http_fetch.rs`). The request is verified against `is_blocked_ssrf_url` before transmission.
4. **Ranking & Filtering**: Raw stream outputs are sent to `harbor-core` where they are sorted by resolution, seeders, audio formats (TrueHD/DTS-HD), and HDR tags.

### 🎬 B. Media Engine & Windows MPV Embedding Lifecycle

1. **Engine Selection**: If `settings.playerMpvEmbed` is active (`mpv` engine), `useMpvEmbed` (`use-mpv-embed.ts`) sets `document.documentElement.dataset.mpvEmbed = "1"`.
2. **CSS Transparency**: `index.css` applies `background: transparent !important;` to `html[data-mpv-embed="1"]`, `body`, `#root`, and main view containers (`stageBg`).
3. **Native Window Attachment (`mpv.rs`)**:
   - Rust initializes `libmpv` and creates/positions a native OS child window (`position_embedded_mpv_child`) matching the coordinates of the video placeholder DOM node.
   - On Windows (`HWND`), the `mpv` window is ordered precisely at the bottom (`HWND_BOTTOM`) or directly beneath the `WebView2` window (`parent_hwnd`).
4. **UI Overlay**: Player controls (`transport.tsx`), subtitle menus (`subtitle-menu.tsx`), and memory HUDs render inside the transparent React `WebView2` layer directly above the hardware-accelerated video surface.

### 💬 C. Subtitle Download & Autoloading Flow

1. **Track Discovery**: `use-track-autoload.ts` and `subtitle-load.ts` scan available tracks from Stremio add-ons, local files, and OpenSubtitles.
2. **File Extraction (`download.rs`)**: When an external `.srt` or `.ass` subtitle track is selected, `#[tauri::command] download_start` fetches the file securely and writes it to the application data cache.
3. **Engine Injection**: For `mpv`, the file path is passed via IPC command (`sub-add`) directly to the `libmpv` instance. For `HTML5`, subtitles are converted to UTF-8 (`encoding.ts`) and injected via Blob URLs or VTT cues.

---

## 5. [SECURITY_HARDENING_MILESTONES & STATUS_TRACKER]

| Milestone                                            |      Status       | Description & Target Files                                                                                                                                                                                                 |
| :--------------------------------------------------- | :---------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Direct Authentication & Proxy Decoupling**      |  `[x] COMPLETED`  | Eliminated `harbor.site` / `bugs.harbor.site` proxies from `src/lib/trakt/config.ts`, `src/lib/trakt/client.ts`, and `src/lib/anilist/config.ts`. All OAuth tokens exchange directly with official servers (`f42f713`).    |
| **2. SSRF Protection & Network Sandbox**             |  `[x] COMPLETED`  | Implemented `is_blocked_ssrf_url` inside `src-tauri/src/http_fetch.rs` (`harbor_fetch`) to block local network scanning and private IP fetches (`127.0.0.1`, `192.168.x.x`, `10.x.x.x`).                                   |
| **3. CI/CD Windows & Apple Silicon Optimization**    |  `[x] COMPLETED`  | Stripped `macOS Intel`, `Linux`, and `Flatpak` build matrices (`4ee4f5c`, `dd8ec4d`), ensuring automated builds run exclusively for Windows x86_64 (`msi`) and macOS Apple Silicon (`dmg`).                                |
| **4. Windows MPV Embed Webview Transparency**        |  `[x] COMPLETED`  | Enabled `isWindowsDesktop()` inside `use-mpv-embed.ts` (`dd8ec4d`) and synchronized with `index.css` rules so native video renders cleanly behind `WebView2`.                                                              |
| **5. Sandbox Capability Hardening (`default.json`)** | `[/] IN PROGRESS` | Eliminate `["**"]` wildcard access across all filesystem and shell capabilities in `src-tauri/capabilities/default.json` and restrict `assetProtocol.scope` in `tauri.conf.json` to safe `$APPDATA/harbor/**` directories. |
| **6. Backend IPC Path Traversal Protection**         |   `[ ] PENDING`   | Add explicit path normalization and sandbox verification inside `src-tauri/src/lib.rs` (`save_text_file`) and `src-tauri/src/download.rs` (`download_start`) to block `../` directory traversal vulnerabilities.           |
| **7. Complete Telemetry Neutralization**             |   `[ ] PENDING`   | Decouple or neutralize `src/lib/bug-report.ts`, `src/lib/build-feedback-submit.ts`, and `src/lib/updater/versions.ts` so the application runs 100% autonomously without any remote telemetry calls.                        |

---

## 6. [AI_VERIFICATION & CHECKLIST_MANDATES]

Before completing any task or ending your turn, you **MUST** run the appropriate checks to verify that your changes did not introduce regressions:

1. **TypeScript / Frontend Changes**:
   ```powershell
   pnpm run typecheck
   ```
2. **Automated Unit / Vitest Checks**:
   ```powershell
   pnpm test
   ```
3. **Rust Backend (`src-tauri` / `harbor-core`) Changes**:
   ```powershell
   cargo check --manifest-path src-tauri/Cargo.toml
   cargo check --manifest-path harbor-core/Cargo.toml
   ```
4. **Working Tree Hygiene**:
   Always check `git status` before finishing. Do **NOT** leave untracked temporary scripts, build debris (`node_modules` modifications), or unresolved warnings in your commits.
