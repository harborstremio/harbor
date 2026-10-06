# JL Network roadmap

JL Network is a branded fork of Harbor that adds JL's own features: onboarding, the IPTV Live Hub and Sports Hub, the sports data layer, households, and music. One codebase serves desktop, web/PWA, and Android TV / Nvidia Shield.

It replaces the JL Netfin streaming stack (Caddy → Stream Gateway → Dispatcharr → OVH). Video goes from the source straight to the player, the way Harbor already works.

## Decisions

| Topic | Decision |
|---|---|
| Codebase | This Harbor fork. JL code lives in clearly named modules so upstream Harbor merges stay manageable. |
| Customer accounts | Bring your own. Each customer adds their own M3U/Xtream provider and signs in to their own Real-Debrid or TorBox account. JL never supplies or shares provider or debrid accounts. |
| Web playback | Same as Harbor web: a static site plus a small `/api-proxy` with an allow-list, for API calls only. Video plays in the browser (hls.js / mpegts.js) directly from the source. |
| Android TV / Shield | Grow the existing JL Netfin Kotlin app: a TV shell that loads the JL web UI and plays video in native ExoPlayer. |
| Server stack | Retire OVH, Dispatcharr, the Stream Gateway, and Caddy. Keep Vercel + Supabase for the web app, accounts, and the API that holds paid keys. |

## Platform targets

| Target | How | Video path |
|---|---|---|
| Windows / macOS / Linux | Tauri (`pnpm tauri:build:jl`) | libmpv. Plays any source: M3U `http`, MPEG-TS, MKV, debrid HTTPS. |
| Web / PWA (`watch.jl-stream.com`) | `vp build`, static hosting | Browser `<video>`. HTTPS and CORS-friendly sources only (debrid links, HTTPS HLS). |
| Nvidia Shield / Android TV | Kotlin shell + ExoPlayer | ExoPlayer. Plays M3U `http`, TS, MKV, HLS. |

**Web limit:** browsers block `http` streams on an `https` page, and many IPTV providers send no CORS headers. With no streaming server, those channels play on desktop and Shield but not on the web. The web app should spot them and offer "Play on my TV / desktop" rather than failing.

## Where JL Netfin features go

| JL Netfin (`lib/…`) | Harbor fork destination | Notes |
|---|---|---|
| `dispatcharr.ts` (`parseM3U`, Xtream mapping) | `src/lib/iptv/` (already has `m3u.ts`, `xtream*.ts`, `xmltv.ts`) | Use Harbor's IPTV store. Port only the JL extras it lacks. |
| `sports.ts`, `thesportsdb.ts`, `allsports.ts`, `as-*.ts`, `cfbd.ts`, `odds.ts`, `espn.ts` | Data comes from the JL API. UI goes in `src/views/live/live-home/sports/` | Harbor's ESPN sports marquee stays. JL adds its providers on top. |
| `game-day.ts`, `game-rank.ts`, `game-story.ts`, `match-center.ts`, `event-guide.ts` | `src/lib/jl/sports/` | Framework-free logic. Move it as-is, with its tests. |
| `ticker-*.ts`, `student-athletes.ts`, `colleges.ts` | `src/lib/jl/ticker/` + a ticker component | Favorite teams and players ticker. |
| `sport-channels.ts`, `channel-match.ts` | `src/lib/jl/sports/` | Links fixtures to the user's own M3U channels ("Watch" opens the channel that carries the game). |
| `trakt*.ts` | Harbor `src/lib/trakt/` | Harbor already has Trakt. Drop the JL copy. |
| `metadata.ts` (TMDB) | Harbor TMDB support | Harbor already uses a TMDB key. |
| `music.ts`, `spotify.ts`, lyrics route | `src/lib/jl/music/` + JL API | Spotify and lyrics keys stay server-side. |
| `household.ts`, `session.ts`, Supabase | `src/lib/jl/account/` | Harbor profiles stay local. Households sync through Supabase. |

## Paid API keys

Any key built into the desktop EXE, the web bundle, or the Android app can be pulled out by a customer. That covers TheSportsDB, AllSports, CollegeFootballData, The Odds API, and Spotify.

Keep these keys on the server: the existing JL Netfin `/api/v1/sports`, `/ticker`, `/game-*`, `/lyrics`, and `/spotify` routes on Vercel. The apps call those routes using the customer's JL session.

Customer-owned keys (Real-Debrid, TorBox, TMDB, the M3U login) stay on the customer's device. That means local app storage, sent only to the provider they belong to.

## Phases

### Phase 1: JL build baseline (this branch)
- [x] `src-tauri/tauri.jl-dev.conf.json`: name "JL Network", ID `app.jlnetwork.dev`, own file association, and an updater URL on `watch.jl-stream.com`.
- [x] `pnpm tauri:build:jl` script.
- [ ] Push the local Windows commit `0f0de0b` ("fix: keep debrid keys local to resolvers") to this branch. It exists only on the build machine. If both sides changed `tauri.jl-dev.conf.json`, keep the local values in the merge.
- [ ] Updater signing: run `pnpm tauri signer generate`, set the JL public key in `plugins.updater.pubkey`, and host `latest.json` at the updater URL. Until then the config still holds Harbor's public key. Update checks fail safely, and the JL build never installs an upstream Harbor build.
- [ ] JL icons in `src-tauri/icons/` and installer art in `src-tauri/installer/`.

### Phase 2: JL onboarding
New screens in Harbor's first-run modal (`src/components/onboarding.tsx`), right after Welcome. Every screen can be skipped.
- [x] **IPTV provider:** M3U or Xtream, using Harbor's own `PlaylistForm` and `materializePlaylistEntry`, so sources are saved exactly as in the Live view.
- [x] **Real-Debrid / TorBox:** API key plus "Verify", which makes a real account call. Status reads "Key saved — not verified" until that call succeeds, then shows premium days left. Logic in `src/lib/jl/onboarding.ts`, tests in `tests/jl-onboarding.test.ts`.
- [x] **Torrentio:** a consent screen that installs the plain manifest (no debrid key in the URL).
- [x] **Done screen:** summarizes IPTV providers, debrid services and Torrentio.
- [ ] Merge local commit `0f0de0b`. Until then, upstream `withDebridKeys` (`src/views/play-picker/use-addons.ts`) still adds saved keys to a plain Torrentio address when the picker loads sources.
- [ ] Real-Debrid device-code sign-in, so customers don't have to copy keys.
- [ ] Load the playlist after it's added and show the channel and group count.
- [ ] Household sign-in (Supabase) moves to Phase 4. Favorite teams and players for the ticker move to Phase 3.
- [ ] JL branding for the Welcome and Splash screens (still Harbor's).

### Phase 3: Hubs
- **IPTV Live Hub:** Harbor's Live view with JL group ordering, favorites, now/next, and catch-up.
- **Sports Hub:** Harbor's sports marquee plus JL Game Day, the marquee ranking, match center, and odds. Each game links to the M3U channels that carry it.
- **Ticker:** favorite teams and players across the app shell.

### Phase 4: JL API and households
- Vercel: keep the JL Netfin `/api/v1/*` routes that wrap paid APIs. Add CORS for the web origin. Desktop and Android call them with a Supabase session.
- Turn off and remove the OVH-only routes (`/api/v1/play`, playback tickets, the relay).
- Households and profile sync through Supabase.

### Phase 5: Web / PWA on `watch.jl-stream.com`
- Deploy the `vp build` output to Vercel.
- Turn Harbor's nginx `/api-proxy` allow-list (`src-tauri/relay/harbor-web.nginx`) into a Vercel route or Edge Function with the same host list. API calls only, never video.
- Add a PWA manifest and service worker for the app shell.
- Show "Play on device" for `http`-only and CORS-blocked IPTV channels.

### Phase 6: Nvidia Shield / Android TV
- Grow `jl-netfin-iptv-streaming-frontend/android` (or move it here as `android/`): a WebView that loads the JL UI and a JS bridge for `play(url, headers)` into ExoPlayer/Media3, plus D-pad focus handling.
- Release signing stays in environment variables. Move `jl-sideload.jks` out of git.

### Phase 7: Retire OVH
- When desktop, web, and Shield all play through direct sources, shut down Dispatcharr, the Stream Gateway, and the Caddy routes on `tv.jl-stream.com`.
- Remove the matching code and the `ops/` workers from JL Netfin.

## Each change must pass

- `pnpm run check`, `pnpm run typecheck`, and `pnpm test`.
- `cargo check --manifest-path src-tauri/Cargo.toml` after Rust changes.
- A real-device pass for anything that touches playback or TV input: Windows EXE, Shield, and iPad Safari for the web.
