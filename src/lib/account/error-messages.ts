type AccountError = Error & { status?: number; code?: string; reason?: string };

const BY_CODE: Record<string, string> = {
  username_taken: "That username is already taken. Try a different one.",
  bad_credentials: "That username and password don't match. Check both and try again.",
  banned: "This account has been suspended. Reach out to support if you think that's wrong.",
  rate_limited: "Too many attempts in a row. Wait a minute, then try again.",
  auth_required: "Please sign in again to continue.",
  recovery_invalid: "That username and recovery key don't match.",
  refresh_invalid: "Your session expired. Sign in again.",
  handle_locked: "Your handle is locked. Contact support to change it.",
  handle_reserved: "That handle is reserved. Pick a different one.",
  handle_too_short: "Handles need at least 3 characters.",
  handle_too_long: "That handle is too long. Use at most 24 characters.",
  handle_invalid: "Handles can use letters, numbers, and single hyphens only.",
  handle_taken: "That handle is already taken. Try one of the suggestions.",
  handle_cooldown_other: "Someone released that handle recently. It frees up 30 days after they dropped it.",
  handle_cooldown: "You changed your handle recently. You can change it again after the cooldown.",
  stremio_already_bound: "That Stremio account is already linked to a different Harbor account. Unlink it there first.",
  stremio_key_invalid: "That Stremio sign-in did not go through. Try again.",
  stremio_anonymous: "Sign in to a real Stremio account, not a guest, to verify.",
  stremio_unreachable: "Could not reach Stremio right now. Try again in a moment.",
  discord_already_bound: "That Discord account is already linked to a different Harbor account. Unlink it there first.",
  discord_not_linked: "No Harbor account is linked to that Discord account yet. Create one first.",
  discord_code_invalid: "That Discord sign-in did not go through. Try again.",
  discord_unreachable: "Could not reach Discord right now. Try again in a moment.",
  challenge_invalid: "That verification attempt expired. Start it again.",
  no_alternate_credential: "Link another way to sign in first — a password, Stremio, or Discord — so you don't get locked out.",
  no_image: "Choose an image file first.",
  bad_image: "That file could not be read as an image. Try a PNG, JPG, or WEBP.",
  slow_down: "You're doing that too fast. Wait a moment and try again.",
  blocked_text: "That text isn't allowed. Try different wording.",
  password_too_short: "Your password needs to be at least 8 characters.",
};

const SNAKE_CODE_RE = /^[a-z0-9]+(_[a-z0-9]+)+$/;

const BY_REASON: Record<string, string> = {
  password_too_short: "Your password needs to be at least 8 characters.",
  "too-short": "That name is too short. Use at least 3 characters.",
  invalid: "That name has characters that aren't allowed. Stick to letters, numbers, and underscores.",
  reserved: "That name is reserved. Pick a different one.",
  taken: "That name is already taken. Try another.",
  profanity: "Please choose a different name.",
  "max-length": "That name is too long.",
};

function isNetworkError(e: AccountError): boolean {
  const m = (e?.message || "").toLowerCase();
  return e?.name === "TypeError" || m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed");
}

export function accountErrorMessage(err: unknown): string {
  const e = (err ?? {}) as AccountError;
  const code = (e.code || e.message || "").trim();
  const reason = (e.reason || "").trim();
  if (code === "validation") {
    if (reason && BY_REASON[reason]) return BY_REASON[reason];
    return "Please check the details you entered and try again.";
  }
  if (reason && BY_REASON[reason]) return BY_REASON[reason];
  if (code && BY_CODE[code]) return BY_CODE[code];
  if (isNetworkError(e)) return "Couldn't reach Harbor. Check your connection and try again.";
  if (SNAKE_CODE_RE.test(code)) return "Something went wrong. Try again.";
  return code || "Something went wrong. Try again.";
}
