const API_SUFFIXES = ["/api/v1", "/api/graphql", "/graphql", "/api"];

function stripApiSuffixes(path: string): string {
  let out = path.replace(/\/+$/, "");
  let changed = true;
  while (changed) {
    changed = false;
    const lower = out.toLowerCase();
    for (const suffix of API_SUFFIXES) {
      if (lower.endsWith(suffix)) {
        out = out.slice(0, out.length - suffix.length).replace(/\/+$/, "");
        changed = true;
        break;
      }
    }
  }
  return out;
}

export function normalizeSuwayomiBase(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/.+/i.test(trimmed)) return null;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const path = stripApiSuffixes(u.pathname);
  const creds = u.username || u.password ? `${u.username}:${u.password}@` : "";
  return `${u.protocol}//${creds}${u.host}${path}`;
}

export function normalizeExtensionRepoUrl(raw: string): string | null {
  const t = raw.trim();
  if (!/^https?:\/\/.+/i.test(t)) return null;
  if (/\/index(\.min)?\.json(\?.*)?$/i.test(t)) return t;
  const gh = t.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?(?:\/tree\/([^/?#]+))?\/?$/i);
  if (gh) {
    const branch = gh[3] || "repo";
    return `https://raw.githubusercontent.com/${gh[1]}/${gh[2]}/${branch}/index.min.json`;
  }
  return t.replace(/\/+$/, "") + "/index.min.json";
}

export function credentialFreeBase(base: string): string {
  try {
    const u = new URL(base);
    if (!u.username && !u.password) return base;
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return base;
  }
}
