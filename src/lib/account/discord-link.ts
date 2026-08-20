import { startDiscordAuth } from "@/lib/discord-auth";
import { applyAuthResult, applyServerUser, type RawUser } from "@/lib/theme-auth";
import { postJson } from "./client";

type LoopbackStart = { state: string; authorizeUrl: string };
type LinkResult = { token: string; refresh: string; user: RawUser };

// Unlike Stremio's linkWithKey, the state challenge has to exist BEFORE the
// browser opens: it is embedded in authorizeUrl by the backend and is the
// same value Discord echoes back to discord_auth.rs's loopback listener.
// `bearer` only matters for mode 'link' -- the backend reads the session to
// stamp harborSessionId on the challenge and to resolve which account to
// bind to; signup/signin have no session yet, so sending one would be inert.
async function runDiscordFlow(mode: "signup" | "link" | "signin"): Promise<void> {
  const { state, authorizeUrl } = await postJson<LoopbackStart>(
    "/identity/api/discord/loopback/start",
    {},
    { bearer: mode === "link" },
  );
  const code = await startDiscordAuth(authorizeUrl, state);
  const d = await postJson<LinkResult>(
    "/identity/api/discord/link",
    { state, mode, code },
    { bearer: mode === "link" },
  );
  applyAuthResult(d);
}

// Linking always sends mode 'link': the caller must already be signed in.
export async function linkDiscord(): Promise<void> {
  await runDiscordFlow("link");
}

// A single "Continue with Discord" for the Create-account tab: the backend
// auto-detects an existing binding and logs that owner in instead of
// creating a duplicate account, same shape as stremio/link's equivalent
// branch -- so this covers both first-time and returning users.
export async function signUpWithDiscord(): Promise<void> {
  await runDiscordFlow("signup");
}

// The Sign-in tab's Discord button: asserts "I already have an account" and
// 404s as discord_not_linked rather than silently creating one, unlike
// signup mode above.
export async function signInWithDiscord(): Promise<void> {
  await runDiscordFlow("signin");
}

export async function unlinkDiscord(): Promise<void> {
  const d = await postJson<{ user: RawUser }>("/identity/api/discord/unlink", {}, { bearer: true });
  applyServerUser(d.user);
}
