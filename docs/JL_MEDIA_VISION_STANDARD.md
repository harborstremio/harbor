# The JL Media Vision Standard

JL Media Vision is a set of players: Windows (EXE), Android phone and TV (APK), and the web app.
It provides no content. Every person who signs in brings their own accounts and keys: IPTV
providers, Real-Debrid or TorBox, Trakt, Spotify and the rest. How the owner signs in and sets
up the player is exactly how anyone else does.

## Rules

- No accounts, logins, keys, provider addresses or emails in code, SQL, tests or build files.
  Ever. Build settings come from GitHub variables and secrets or the hosting dashboard; a
  person's own logins are typed into the app and stored encrypted under their account.
- One JL account per person, the same on every device. Sources and settings follow the account.
- The app never limits connections. A provider's own limits are the provider's business.
- Tests and examples use `example` hosts and made-up logins.

## Sources

Movies, shows and live TV come from whatever the person adds, in priority order:

1. IPTV providers: any number, each with any number of logins (Xtream or M3U).
2. Real-Debrid and TorBox, through Torrentio, as backup for movies and shows.

The source manager tries them in order and moves to the next one when a login is busy, down or
missing the title, so two providers back each other up.

## Playback on the web and iPhone

Browsers can only play some sources (debrid and HTTPS streams). By default the web app and
iPhone play just those. To play everything, a person can switch on a personal relay on their own
computer:

- Settings → **Watch on my phone & web** in the Windows app. One switch.
- The app gets its own private address (a Cloudflare tunnel provisioned by the JL backend) and
  only that person's signed links work through it.
- Each step shows ✅ or ✗ with a plain fix. **Ask JL**, the AI helper, runs the same checks and
  walks a beginner through anything that fails.

## Phases

0. **Cleanup.** Remove everything hard-coded; keep watch.jl-stream.com working; fix the home
   relay's catalog sync.
1. **The Standard.** One account, bring-your-own sources, the source manager with failover.
2. **Personal relay.** The switch in the Windows app with automatic tunnel setup. The home relay
   (TheLab) moves from scripts to this switch.
3. **Ask JL and the merge.** The AI setup helper; port watch's best features (Hero PiP, Sports
   Hub, Music, custom art, My List / Trakt / Continue Watching, household profiles); then move
   watch.jl-stream.com onto this app.

## Release settings

GitHub → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `JL_SUPABASE_URL` | The accounts project URL |
| Variable | `JL_SUPABASE_ANON_KEY` | Its public (anon/publishable) key |
| Secret | `JL_KEYSTORE_B64` | The APK signing keystore, base64 |
| Secret | `JL_KEYSTORE_PASSWORD` | Keystore password |
| Secret | `JL_KEY_ALIAS` | Key alias |
| Secret | `JL_KEY_PASSWORD` | Key password |

Keep the same signing key for every release so updates install over the last version.
