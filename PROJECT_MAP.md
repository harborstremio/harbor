# PROJECT_MAP: Harbor Security Hardening & Server Decoupling

## [TECH_STACK]
- **Core Framework**: Tauri v2 (Rust Backend + WebView Frontend)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend Languages**: Rust (`src-tauri/src/`), Node.js build scripts (`scripts/`)
- **Media Engine**: Native `libmpv` (`mpv.rs`), embedded `yt-dlp`, `ffmpeg`/`ffprobe`
- **P2P & Network**: `reqwest`, `tokio`, custom BitTorrent engine (`torrent_engine.rs`), local HTTP/Cast proxy servers

## [SYSTEM_FLOW]
1. **Addon & Stream Resolution**: User selects or queries Stremio add-ons (`stremio-addons.ts`) -> Streams resolved (HTTP, HLS, or BitTorrent magnet).
2. **Media Routing**:
   - HTTP/HLS: Proxied or played directly via `mpv.rs` (`libmpv`).
   - BitTorrent: Handled via `torrent_engine.rs` -> Local stream proxy (`stream_proxy.rs`).
3. **Application Storage & Subtitles**: Subtitles extracted/downloaded via `sub_download` or `download_start` -> Saved to app filesystem.
4. **IPC Security Boundary**: Frontend communicates with native OS capabilities strictly via Tauri v2 capabilities (`default.json`) and explicit `#[tauri::command]` handlers.

## [ARCHITECTURE]
- **Domain-Driven Hybrid Architecture**:
  - `src-tauri/tauri.conf.json` & `src-tauri/capabilities/default.json`: Define absolute permission boundaries for WebViews (`main`, `pip`, `modal-overlay`).
  - `src-tauri/src/lib.rs` & `download.rs`: Core utility and filesystem persistence handlers (`save_text_file`, `download_start`).
  - `src-tauri/src/http_fetch.rs`: Backend HTTP client (`harbor_fetch`) bypassing CORS/browser limits.
  - `src/lib/*`: Client-side providers, telemetry, external API adapters (`theme-store`, `updater`, `bug-report`, `safe-fetch`).

## [ORPHANS & PENDING]
- `[/]` **Milestone 1: Architectural Sandbox Hardening (Tauri Config & Capabilities)**
  - Goal: Eliminate `["**"]` wildcard access across all filesystem and shell capabilities so WebViews cannot touch system files or execute arbitrary shell arguments.
  - Targets:
    - `src-tauri/tauri.conf.json`: Restrict `assetProtocol.scope` to safe app data/cache directories (`$APPDATA/harbor/**`, `$APPCACHE/harbor/**`, `$LOCALAPPDATA/harbor/**`, `$TEMP/harbor/**`).
    - `src-tauri/capabilities/default.json`: Restrict `fs:allow-*` scope from `["**"]` to designated app directories and restrict `yt-dlp` shell execution args.
- `[ ]` **Milestone 2: Backend IPC Command Sanitization & Path Traversal Protection (Rust Backend)**
  - Goal: Ensure no frontend call (or XSS payload) can write files outside app sandbox via `save_text_file` or `download_start`, and prevent SSRF in `harbor_fetch`.
  - Targets:
    - `src-tauri/src/lib.rs` (`save_text_file`): Add strict path normalization and sandbox prefix verification.
    - `src-tauri/src/download.rs` (`download_start`): Add path validation on `dest` to block directory traversal (`../`) and unauthorized paths.
    - `src-tauri/src/http_fetch.rs` (`harbor_fetch`): Block SSRF requests targeting local network metadata/private IP ranges (`127.0.0.1`, `localhost`, `169.254.169.254`, `192.168.x.x`, `10.x.x.x`).
- `[ ]` **Milestone 3: Complete Server Decoupling (Severing `harbor.site` & Telemetry)**
  - Goal: Remove all hardcoded dependencies, telemetry, updater endpoints, and remote calls to developer servers (`harbor.site`, `harbir.site`, `auth.harbor.site`).
  - Targets:
    - Disable/clean remote updater config in `tauri.conf.json` (`endpoints: ["https://harbor.site/updates/..."]`).
    - Neutralize/decouple `src/lib/bug-report.ts`, `src/lib/build-feedback-submit.ts`, `src/lib/ad-report/submit.ts`, `src/lib/updater/versions.ts`, and `src/lib/theme-store.ts` so the application runs 100% autonomously without phoning home.
