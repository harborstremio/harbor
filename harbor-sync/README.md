# Harbor Sync

Harbor Sync is an **optional, end-to-end encrypted** account system that keeps a user's Harbor experience identical across devices: settings, themes, API keys, Stremio sessions, addons, curated packs, profiles, watch state, watchlists, and download history all follow the account. The server (this Cloudflare Worker) only ever stores an authentication verifier and opaque ciphertext — it cannot read settings, passwords, or keys.

## How it works

The client (`src/lib/sync/`) treats every syncable `harbor.*` localStorage key as one **document**. Documents are encrypted client-side and pushed to the Worker, which stores them per user with a monotonically increasing revision. Other devices pull documents newer than their last-seen revision and apply them locally.

- **Change detection** — the engine patches `Storage.setItem`/`removeItem` and reconciles periodically; changed keys are pushed in batches (max 100 per request, 200 per batch server-side).
- **Conflicts** — resolved per document. Most keys are last-write-wins by update time; continue-watching and the downloads catalog are merged **entry-wise by newest timestamp**, so two devices watching different titles never clobber each other.
- **First sign-in adoption** — when a device that already has data signs into an account that also has data, the client parks the sign-in and asks how to combine them: merge everything, keep the device's profile as a separate profile, merge it into a chosen account profile, use the account only, or replace the account.
- **Deletions** — documents are tombstoned (`deleted` flag), never resurrected by stale devices.

### What syncs

Everything under `harbor.*` except device-specific state: the sync engine's own keys, the Watch Together client id, local caches, and the download **registry** (file paths and expiring stream URLs stay on-device; a metadata catalog syncs instead so other devices can list and re-fetch downloads through their own sources).

## Encryption

All cryptography runs client-side via WebCrypto; the password never leaves the device.

```
password ──PBKDF2-SHA256 (600k, per-user salt)──▶ master key
master key ──HKDF("harbor-sync/auth")──▶ authHash   (sent to server as login verifier)
master key ──HKDF("harbor-sync/wrap")──▶ wrapKey    (never leaves the device)

random 256-bit data key ──AES-256-GCM(wrapKey)──▶ wrappedDataKey (stored server-side)
document plaintext ──AES-256-GCM(data key, AAD = document key)──▶ "v1.<iv>.<ciphertext>"
```

- The **data key** encrypts documents; it is generated once at registration and stored only wrapped. Recovering it requires the password, so a database leak exposes nothing readable.
- Each document's storage key is bound as **AAD**, so ciphertexts cannot be swapped between documents.
- The server never sees the password or the raw `authHash` verifier at rest: it stores `PBKDF2(authHash, per-user salt, 100k)` and compares in constant time.
- Unknown-email prelogins return a deterministic **fake salt** derived from a server secret (`AUTH_PEPPER`), so account existence is not leakable.
- Session tokens are random 256-bit values stored only as SHA-256 hashes.

## API

All endpoints are JSON over HTTPS; authenticated routes take `Authorization: Bearer <token>`.

| Method | Path                    | Purpose                                                  |
| ------ | ----------------------- | -------------------------------------------------------- |
| POST   | `/v1/auth/prelogin`     | KDF parameters (salt, iterations) for an email           |
| POST   | `/v1/auth/register`     | Create account with verifier + wrapped key               |
| POST   | `/v1/auth/login`        | Verify `authHash`, mint a session token                  |
| POST   | `/v1/auth/logout`       | Revoke the current session                               |
| PUT    | `/v1/auth/password`     | Rotate verifier + wrapped key, revoke others             |
| GET    | `/v1/sync/docs?since=N` | Documents newer than revision `N`                        |
| PUT    | `/v1/sync/docs`         | Push documents (optimistic `baseRev`, returns conflicts) |
| DELETE | `/v1/account`           | Delete the account and all documents                     |

Wrong-password re-confirmation (password change, account deletion) answers `401 invalid_credentials`; token revocation answers `401 unauthorized`. Clients must only drop their session on the latter.

## Self-hosting

The Worker runs on Cloudflare with a D1 database.

1. Create the D1 database:

   ```sh
   wrangler d1 create harbor-sync
   ```

2. Copy the returned database ID into `wrangler.toml` (`database_id` under `[[d1_databases]]`), then apply the schema:

   ```sh
   wrangler d1 execute harbor-sync --remote --file=schema.sql
   ```

3. Set a long random server secret used for unknown-email prelogin salts:

   ```sh
   wrangler secret put AUTH_PEPPER
   ```

4. Deploy:

   ```sh
   wrangler deploy
   ```

For local development, apply the schema to local D1 if needed, then run `wrangler dev --local`.

Any host that can serve the same HTTP contract works — the test suite runs the Worker in-process against an in-memory store (`src/store.ts` `MemStore`), which doubles as a reference implementation.

## Client setup

In Harbor: **Settings → Account → Harbor Sync**.

1. Pick the sync server. While the hosted official server is not yet live, enter your self-hosted Worker URL under **Custom URL** (e.g. `https://sync.example.com`). The choice applies at the next sign-in.
2. Create an account (email + password) or sign in. Passwords cannot be recovered — encryption keys derive from them, so a lost password means a fresh account.
3. On a device that already has data, choose how to combine it with the account when prompted.

## Tests

```sh
node --test test/worker.test.ts                 # Worker: auth, docs, limits, deletion
node --test ../tests/sync-*.test.ts             # Client: crypto, key policy, merges, adoption, e2e vs the Worker
```
