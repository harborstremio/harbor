import {
  applyAuthResult,
  applyServerUser,
  captureSessionScope,
  refreshToken,
  type RawUser,
} from "@/lib/theme-auth";
import { getJson, postJson } from "./client";

type AuthResult = { token: string; refresh: string; user: RawUser };
type AuthResultWithCode = AuthResult & { recoveryCode: string };

export async function registerIdentity(
  username: string,
  password: string,
): Promise<{ recoveryCode: string }> {
  const isCurrent = captureSessionScope();
  const d = await postJson<AuthResultWithCode>("/identity/api/register", { username, password });
  if (!isCurrent()) throw new Error("Account changed");
  applyAuthResult(d);
  return { recoveryCode: d.recoveryCode };
}

export async function loginIdentity(username: string, password: string): Promise<void> {
  const isCurrent = captureSessionScope();
  const d = await postJson<AuthResult>("/identity/api/login", { username, password });
  if (!isCurrent()) throw new Error("Account changed");
  applyAuthResult(d);
}

export async function recoverIdentity(
  username: string,
  recoveryCode: string,
  password: string,
): Promise<{ recoveryCode: string }> {
  const isCurrent = captureSessionScope();
  const d = await postJson<AuthResultWithCode>("/identity/api/recover", {
    username,
    recoveryCode,
    password,
  });
  if (!isCurrent()) throw new Error("Account changed");
  applyAuthResult(d);
  return { recoveryCode: d.recoveryCode };
}

export async function refreshSession(): Promise<void> {
  if (!(await refreshToken())) throw new Error("Session refresh failed.");
}

export async function setAccountPassword(password: string): Promise<void> {
  const d = await postJson<{ user: RawUser }>(
    "/identity/api/password/set",
    { password },
    { bearer: true },
  );
  applyServerUser(d.user);
}

export async function fetchMe(): Promise<void> {
  const d = await getJson<{ user: RawUser }>("/identity/api/me", { bearer: true }).catch(
    () => null,
  );
  if (d?.user) applyServerUser(d.user);
}
