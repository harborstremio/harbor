import { startDiscordAuth } from "@/lib/discord-auth";
import { applyAuthResult, applyServerUser, type RawUser } from "@/lib/theme-auth";
import { postJson } from "./client";

type LoopbackStart = { state: string; authorizeUrl: string };
type LinkResult = { token: string; refresh: string; user: RawUser; recoveryCode?: string };

// Unlike Stremio's linkWithKey, the state challenge has to exist BEFORE the
// browser opens: it is embedded in authorizeUrl by the backend and is the
// same value Discord echoes back to discord_auth.rs's loopback listener.
// `bearer` only matters for mode 'link' -- the backend reads the session to
// stamp harborSessionId on the challenge and to resolve which account to
// bind to; signup/signin have no session yet, so sending one would be inert.
async function startLoopback(mode: "signup" | "link" | "signin"): Promise<LoopbackStart> {
  return postJson<LoopbackStart>(
    "/identity/api/discord/loopback/start",
    {},
    { bearer: mode === "link" },
  );
}

async function completeDiscordFlow(
  mode: "signup" | "link" | "signin",
  state: string,
  code: string,
  extra?: { username?: string; password?: string },
): Promise<LinkResult> {
  const d = await postJson<LinkResult>(
    "/identity/api/discord/link",
    { state, mode, code, ...extra },
    { bearer: mode === "link" },
  );
  applyAuthResult(d);
  return d;
}

// Linking always sends mode 'link': the caller must already be signed in.
export async function linkDiscord(): Promise<void> {
  const { state, authorizeUrl } = await startLoopback("link");
  const code = await startDiscordAuth(authorizeUrl, state);
  await completeDiscordFlow("link", state, code);
}

// The Sign-in tab's Discord button: asserts "I already have an account" and
// 404s as discord_not_linked rather than silently creating one, unlike
// signup below.
export async function signInWithDiscord(): Promise<void> {
  const { state, authorizeUrl } = await startLoopback("signin");
  const code = await startDiscordAuth(authorizeUrl, state);
  await completeDiscordFlow("signin", state, code);
}

// Signup is split in two: the account doesn't exist yet, so the caller (the
// register tab) needs a chance to collect a chosen username/password AFTER
// Discord confirms identity but BEFORE the account is created -- unlike
// signin/link, which have nothing left to ask the user. The Discord `code`
// lives only in the caller's memory between the two calls; there is no
// server-side state for "signed into Discord but still picking a username".
//
// If this Discord identity turns out to already be bound to an existing
// Harbor account, finishDiscordSignup logs that account in instead (same
// auto-detect the old single-step flow had) and the chosen username/password
// are simply not used -- reflected by recoveryCode being absent in that case.
export async function startDiscordSignup(): Promise<{ state: string; code: string }> {
  const { state, authorizeUrl } = await startLoopback("signup");
  const code = await startDiscordAuth(authorizeUrl, state);
  return { state, code };
}

export async function finishDiscordSignup(
  state: string,
  code: string,
  username: string,
  password: string,
): Promise<{ recoveryCode?: string }> {
  const d = await completeDiscordFlow("signup", state, code, { username, password });
  return { recoveryCode: d.recoveryCode };
}

export async function unlinkDiscord(): Promise<{ recoveryCode?: string }> {
  const d = await postJson<{ user: RawUser; recoveryCode?: string }>(
    "/identity/api/discord/unlink",
    {},
    { bearer: true },
  );
  applyServerUser(d.user);
  return { recoveryCode: d.recoveryCode };
}

// Alternative to the recovery-key flow (account-recover-form.tsx) for anyone
// who has Discord linked but lost/never saved their recovery key: a
// short-lived PIN is DMed to them via startDiscordRecovery, and typing it
// back in via finishDiscordRecovery (plus a new password) signs them back in
// the same way the recovery key does.
export async function startDiscordRecovery(username: string): Promise<void> {
  await postJson<{ ok: true }>("/identity/api/discord/recover/start", { username });
}

export async function finishDiscordRecovery(
  username: string,
  pin: string,
  password: string,
): Promise<{ recoveryCode: string }> {
  const d = await postJson<LinkResult & { recoveryCode: string }>(
    "/identity/api/discord/recover/confirm",
    { username, pin, password },
  );
  applyAuthResult(d);
  return { recoveryCode: d.recoveryCode };
}
