type AccountError = Error & {
  status?: number;
  code?: unknown;
  reason?: unknown;
  detail?: unknown;
};

const BY_CODE = {
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
  handle_cooldown_other:
    "Someone released that handle recently. It frees up 14 days after they dropped it.",
  handle_cooldown: "You changed your handle recently. You can change it again after the cooldown.",
  stremio_already_bound:
    "That Stremio account is already linked to a different Harbor account. Unlink it there first.",
  stremio_key_invalid: "That Stremio sign-in did not go through. Try again.",
  stremio_anonymous: "Sign in to a real Stremio account, not a guest, to verify.",
  stremio_unreachable: "Could not reach Stremio right now. Try again in a moment.",
  challenge_invalid: "That verification attempt expired. Start it again.",
  password_required: "Set a password before unlinking, so you don't get locked out.",
  no_image: "Choose an image file first.",
  bad_image: "That file could not be read as an image. Try a PNG, JPG, or WEBP.",
  slow_down: "You're doing that too fast. Wait a moment and try again.",
  blocked_text: "That text isn't allowed. Try different wording.",
  password_too_short: "Your password needs to be at least 8 characters.",
} as const;

const BY_REASON = {
  password_too_short: "Your password needs to be at least 8 characters.",
  "too-short": "That name is too short. Use at least 3 characters.",
  invalid:
    "That name has characters that aren't allowed. Stick to letters, numbers, and underscores.",
  reserved: "That name is reserved. Pick a different one.",
  taken: "That name is already taken. Try another.",
  profanity: "Please choose a different name.",
  "max-length": "That name is too long.",
} as const;

const VALIDATION_ERROR_KEY = "Please check the details you entered and try again.";
const NETWORK_ERROR_KEY = "Couldn't reach Harbor. Check your connection and try again.";
const GENERIC_ERROR_KEY = "Something went wrong. Try again.";
const SNAKE_CODE_RE = /^[a-z0-9]+(_[a-z0-9]+)+$/;

export type AccountErrorKey =
  | (typeof BY_CODE)[keyof typeof BY_CODE]
  | (typeof BY_REASON)[keyof typeof BY_REASON]
  | typeof VALIDATION_ERROR_KEY
  | typeof NETWORK_ERROR_KEY
  | typeof GENERIC_ERROR_KEY;

export type AccountErrorMessage =
  | { kind: "built-in"; key: AccountErrorKey }
  | { kind: "detail"; detail: string };

function mappedValue<const T extends Record<string, string>>(
  mapping: T,
  value: string,
): T[keyof T] | undefined {
  return Object.prototype.hasOwnProperty.call(mapping, value)
    ? mapping[value as keyof T]
    : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function builtIn(key: AccountErrorKey): AccountErrorMessage {
  return { kind: "built-in", key };
}

function isNetworkError(e: AccountError): boolean {
  const message = stringValue(e?.message).toLowerCase();
  return (
    e?.name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed")
  );
}

export function accountErrorMessage(err: unknown): AccountErrorMessage {
  const e = (err ?? {}) as AccountError;
  const rawMessage = stringValue(e.message);
  const rawCode = stringValue(e.code);
  const code = rawCode.trim() || rawMessage.trim();
  const reason = stringValue(e.reason).trim();

  if (code === "validation") {
    const reasonKey = mappedValue(BY_REASON, reason);
    return builtIn(reasonKey ?? VALIDATION_ERROR_KEY);
  }

  const reasonKey = mappedValue(BY_REASON, reason);
  if (reasonKey) return builtIn(reasonKey);

  const codeKey = mappedValue(BY_CODE, code);
  if (codeKey) return builtIn(codeKey);

  if (isNetworkError(e)) return builtIn(NETWORK_ERROR_KEY);

  const rawDetail = stringValue(e.detail);
  if (rawDetail.trim()) return { kind: "detail", detail: rawDetail };
  if (rawMessage.trim()) return { kind: "detail", detail: rawMessage };
  if (SNAKE_CODE_RE.test(rawCode.trim())) return builtIn(GENERIC_ERROR_KEY);
  if (code) return { kind: "detail", detail: code };
  return builtIn(GENERIC_ERROR_KEY);
}
