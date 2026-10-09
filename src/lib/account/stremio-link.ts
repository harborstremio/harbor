import { startStremioWebAuth } from "@/lib/stremio-auth";
import { applyAuthResult, applyServerUser, type RawUser } from "@/lib/theme-auth";
import { postJson } from "./client";

type LoopbackStart = { state: string; callbackUrl: string };
type LinkResult = { token: string; refresh: string; user: RawUser };

async function linkWithKey(authKey: string): Promise<void> {
  const key = authKey.trim();
  if (!key) throw new Error("No Stremio sign-in received. Try again.");
  const { state } = await postJson<LoopbackStart>("/identity/api/stremio/loopback/start", {}, { bearer: true });
  const d = await postJson<LinkResult>(
    "/identity/api/stremio/link",
    { state, mode: "link", authKey: key },
    { bearer: true },
  );
  applyAuthResult(d);
}

export async function verifyWithCurrentStremio(authKey: string): Promise<void> {
  await linkWithKey(authKey);
}

export async function verifyWithStremioBrowser(): Promise<void> {
  const key = await startStremioWebAuth();
  await linkWithKey(key);
}

export async function unlinkStremio(): Promise<void> {
  const d = await postJson<{ user: RawUser }>("/identity/api/stremio/unlink", {}, { bearer: true });
  applyServerUser(d.user);
}
