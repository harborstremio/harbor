const SALT = "harbor-profile-v1";

export async function hashProfilePassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT}|${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function verifyProfilePassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  const candidate = await hashProfilePassword(password);
  return candidate === hash;
}
