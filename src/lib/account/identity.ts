import { applyAuthResult, applyServerUser, applyTokens, refreshTokenValue, type RawUser } from "@/lib/theme-auth";
import { getJson, postJson } from "./client";

type AuthResult = { token: string; refresh: string; user: RawUser };
type AuthResultWithCode = AuthResult & { recoveryCode: string };

export async function registerIdentity(
  username: string,
  password: string,
  /**
   * OPTIONAL. Omitted entirely when the instance reports no mail support, and
   * omitted when the user leaves the field blank -- in which case registration
   * behaves exactly as before, recovery code and all. An account without an
   * email is a fully working account.
   */
  email?: string,
  newsletterOptIn?: boolean,
): Promise<{ recoveryCode: string }> {
  const body: Record<string, unknown> = { username, password };
  if (email) {
    body.email = email;
    // Only sent alongside an address; a bare opt-in has nothing to subscribe.
    body.newsletterOptIn = newsletterOptIn === true;
  }
  const d = await postJson<AuthResultWithCode>("/identity/api/register", body);
  applyAuthResult(d);
  return { recoveryCode: d.recoveryCode };
}

/**
 * Attach or replace the address on an existing account. The server holds it as
 * PENDING and does not touch the verified address until the link is clicked, so
 * a typo -- or someone on a hijacked session -- cannot detach an account from
 * the person who owns it.
 */
export async function attachEmail(email: string, newsletterOptIn = false): Promise<void> {
  await postJson<{ pending: true }>(
    "/identity/api/email/attach",
    { email, newsletterOptIn },
    { bearer: true },
  );
}

export async function resendVerification(): Promise<void> {
  await postJson<{ sent: true }>("/identity/api/email/resend", {}, { bearer: true });
}

/**
 * Always resolves when the instance supports email, whether or not the address
 * is known -- the server answers 202 either way. Reporting "no such account"
 * here would turn this into an account-enumeration oracle, so the UI must say
 * "if that address is on file, we've sent a link" and mean it.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await postJson<{ sent: true }>("/identity/api/password/reset/request", { email });
}

/**
 * Completing a reset rotates the recovery code, exactly as recoverIdentity does,
 * so the caller must surface the new one. The old code stops working.
 */
export async function resetPassword(token: string, password: string): Promise<{ recoveryCode: string }> {
  const d = await postJson<AuthResultWithCode>("/identity/api/password/reset", { token, password });
  applyAuthResult(d);
  return { recoveryCode: d.recoveryCode };
}

export async function loginIdentity(username: string, password: string): Promise<void> {
  const d = await postJson<AuthResult>("/identity/api/login", { username, password });
  applyAuthResult(d);
}

export async function recoverIdentity(
  username: string,
  recoveryCode: string,
  password: string,
): Promise<{ recoveryCode: string }> {
  const d = await postJson<AuthResultWithCode>("/identity/api/recover", { username, recoveryCode, password });
  applyAuthResult(d);
  return { recoveryCode: d.recoveryCode };
}

export async function refreshSession(): Promise<void> {
  const refresh = refreshTokenValue();
  if (!refresh) throw new Error("No refresh token.");
  const d = await postJson<{ token: string; refresh: string }>("/identity/api/token/refresh", { refresh });
  applyTokens(d.token, d.refresh);
}

export async function setAccountPassword(password: string): Promise<void> {
  const d = await postJson<{ user: RawUser }>("/identity/api/password/set", { password }, { bearer: true });
  applyServerUser(d.user);
}

export async function fetchMe(): Promise<void> {
  const d = await getJson<{ user: RawUser }>("/identity/api/me", { bearer: true }).catch(() => null);
  if (d?.user) applyServerUser(d.user);
}
