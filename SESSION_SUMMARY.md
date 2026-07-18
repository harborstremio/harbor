# Session Summary — Harbor Tizen TV Adaptation

## Overview
Adapted the Harbor Stremio desktop client fork for Samsung Tizen TVs. Three commits so far, app is functional with login, playback, metadata, and subtitles working. UI has been significantly scaled for 10-foot viewing.

---

## Commit 1: `568cd77` — "app funcionando mas sem legendas..."
**Bug fixes to get the app booting and running:**

| File | Fix |
|------|-----|
| `src/lib/onboarding.tsx:21` | `localStorage.getItem()` wrapped in try/catch |
| `src/lib/settings/load.ts:77` | `localStorage.getItem()` wrapped in try/catch |
| `src/lib/settings/profile-store.ts:33-35` | `localStorage.getItem()` in `loadEffective()` wrapped in try/catch |
| `src/lib/settings.tsx:73` | `setTmdbLanguage()` moved from render phase to `useEffect` |
| `src/lib/platform.ts:13` | try/catch on `nativePlatform()` call |
| `vite.config.ts` | Added `define: { __APP_VERSION__, __IS_BETA_BUILD__ }` — missing globals caused `error-view.tsx` crash |
| `vite.config.ts` | Plugin `stripCrossorigin()` + `modulePreload: false` — removes `crossorigin` attr for Tizen compat |
| `public/config.xml` | Moved from root, added CSP with `'unsafe-inline'` `'unsafe-eval'` `worker-src blob:` |
| `src/lib/safe-fetch.ts` | Added `api.strem.io` to DIRECT_HOSTS (was proxying through non-existent `/api-proxy/`) |
| `src/lib/stremio.ts` | Defensive `res.json()` with try/catch for better error messages |
| `index.html` | Error capture scripts that show JS errors ON the boot screen |
| `src/main.tsx` | try/catch around `createRoot().render()`, MutationObserver fallback, 5s safety timeout |

---

## Commit 2: `808b29d` — "feat: adaptacao completa da UI para controle remoto (d-pad) em TVs"
**Full TV remote UI adaptation — 50 files changed, 768 insertions:**

### Critical Fixes
| # | What | Files |
|---|------|-------|
| 1 | `playerTvNavigation: true` default | `settings/defaults.ts:256` |
| 2 | Volume stepper default (dpad-friendly) | `player-chrome.ts` |
| 3 | Seek bar via dpad (ArrowLeft/Right ±5s, Enter to seek) | `seek-bar.tsx` |
| 4 | Horizontal scroll on rows via dpad Left/Right | `row.tsx` |
| 5 | Hover-hidden buttons visible on TV focus | `index.css` (CSS `:has([data-tv-focused])`) |
| 6 | Context menu via remote Menu key | `tizen/keys.js`, `keyboard-navigation.ts` |

### High Priority
| # | What | Files |
|---|------|-------|
| 7 | `data-tv-focus-scope` on 12+ modals | `add-source-modal`, `auth-modal`, `age-gate-modal`, `anchored-menu`, `award-detail-modal`, `critics-pick/*`, `featured-banner/*`, `unsaved-changes`, `cheat-sheet`, `library-browser`, `beta-themes-modal` |
| 8 | Backdrop divs → focusable (role=button+tabIndex+onKeyDown) | Same 12 files |
| 9 | `data-tv-content-zone` on 23 content pages | All views: `home`, `movies`, `shows`, `anime`, `discover`, `library`, `live`, `calendar`, `downloads`, `catalogs`, `collections`, `collection`, `grid`, `filter`, `person`, `episode-detail`, `queue`, `service`, `wrapped`, `kids`, `kids-detail`, `award`, `anime-award` |
| 10 | Hero carousels via dpad Left/Right | `hero-carousel`, `cinema-hero`, `peek-hero` |

### Medium Priority
| # | What | Files |
|---|------|-------|
| 11 | Virtual keyboard for text inputs on TV | `virtual-keyboard.tsx` (new) + `App.tsx` integration |
| 12 | Sliders (color picker, jump bar, build-feedback) via dpad | `color-picker`, `jump-bar`, `build-feedback` |

### UI Scale-Up (10-foot TV)
| Area | Files |
|------|-------|
| Sidebar (6 themes) | `sidebar.tsx`, `dracula-sidebar.tsx`, `nord-sidebar.tsx`, `forest-sidebar.tsx`, `stremio-rail.tsx`, `siderail.tsx` — 1.4x-1.5x icon/text/profile scaling |
| Sidebar scroll fix | All 6 themes: added `data-tv-scroll-focus` |
| Topbar | `topbar.tsx` — larger logo, search, profile icons |
| Cards | `row.tsx` (min 144→210), `pick-card.tsx` (ratings), `continue-card.tsx` |
| Focus ring | `keyboard-navigation.ts`: white→blue (#3b82f6), 4px→5px; `index.css`: static CSS rule |
| Settings UI | `settings/nav.tsx`, `shared.tsx`, `settings.tsx`, `account.tsx`, `hotkeys-panel.tsx`, `basics-panel.tsx`, `jump-bar.tsx` |
| TV CSS vars | `index.css`: `[data-tv-navigation]` class — text selection disabled, base font-size 18px |

### Subtitle Fix (post-commit)
| File | Fix |
|------|-----|
| `src/lib/safe-fetch.ts` | Removed proxy entirely — `rewriteForWeb` now returns direct URLs. All subtitle/addon/cinemeta domains fetch directly. |

### Row Header Fix (post-commit)
| File | Fix |
|------|-----|
| `src/components/row.tsx` | "View All" button moved from far-right to next to title; invisible by default (`max-w-0 opacity-0`), appears on focus (`group-focus-within/row-header:max-w-[200px] opacity-100`); title is `<h3>` not focusable |

---

## Commit 3: `737ca94` — "feat: configurable CORS proxy for debrid/addon APIs on Tizen/web"
**Proxy infrastructure to unblock CORS-less domains on Tizen/web (9 files, +232):**

| File | What |
|------|------|
| `scripts/proxy-server.mjs` | **New.** Lightweight HTTP proxy server on port 3141. Routes `GET/POST /proxy/{hostname}/{path}` → `https://{hostname}{path}`. Forwards `Authorization` header as `X-Harbor-Auth`. CORS headers on all responses. No external dependencies. |
| `src/lib/safe-fetch.ts` | Added `setProxyUrl(url)` export (module-level var). Added `PROXY_HOSTS` (debrid APIs: real-debrid, alldebrid, premiumize, debrid-link, torbox) and `PROXY_SUFFIXES` (addon hosts: .elfhosted.com, .strem.fun, .fly.dev, .vercel.app, etc.). `DIRECT_HOSTS` kept for domains with CORS (torrentio, stremio, cinemeta). When `proxyUrl` is set, `rewriteForWeb` routes proxiable domains through `{proxyUrl}/proxy/{hostname}{path}`. |
| `src/lib/settings/types.ts:74` | Added `proxyUrl: string` to Settings type |
| `src/lib/settings/defaults.ts:22` | Default `proxyUrl: ""` |
| `src/lib/settings.tsx:8,156-159` | Imports `setProxyUrl`, `useEffect` calls it on `settings.proxyUrl` change |
| `src/views/settings/streaming-sources-panel.tsx` | New "CORS Proxy" section with URL input and description |
| `.npmrc` | **New.** `block-exotic-subdeps=false` — required for pnpm to install `mpegts.js` (depends on `webworkify-webpack` from git) |
| `package.json` | Added `"proxy": "node scripts/proxy-server.mjs"` script |

**How to use the proxy:**
```bash
# 1. Start the proxy server (on your home server/VPS, or same machine)
npm run proxy
# or: PORT=3141 node scripts/proxy-server.mjs

# 2. In Harbor Settings → CORS Proxy, enter the proxy URL:
#    http://192.168.1.100:3141
```

---

## Pending
- Remover cursor quando `tvNavigation` ativo (adiado — usuário ainda polindo interface)
- Testar na TV Samsung real com emulador Tizen
- Sliders (color picker, jump bar, build-feedback) via dpad

---

## Build & Deploy
```bash
npm run build          # Vite production build → dist/
npm run wgt            # Build + package .wgt
npm run proxy          # Start CORS proxy server (port 3141)
# Output: harbor-tizen.wgt (~123 MB)
# Deploy: sdb push harbor-tizen.wgt /opt/usr/apps/
```

## Remote
- **origin:** `https://github.com/DaviAndreiDev/harbor-tizen.git`
- **upstream:** `https://github.com/harborstremio/harbor.git`
