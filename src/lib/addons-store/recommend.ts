import { categorizeAddon, isAdultAddon, type ResolvedAddon } from "./store";

function resources(r: ResolvedAddon): string[] {
  return (r.manifest?.resources ?? []).map((x) => (typeof x === "string" ? x : x.name));
}

function normName(name: string | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\|.*$/g, "")
    .replace(
      /\b(rd|tb|ad|premiumize|debrid|elfhosted|community|official|free|paid|sponsored|by\s+\S+)\b/g,
      "",
    )
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function dedupeByName(rs: ResolvedAddon[]): ResolvedAddon[] {
  const seen = new Set<string>();
  const out: ResolvedAddon[] = [];
  for (const r of rs) {
    const norm = normName(r.manifest?.name);
    const key = norm || r.manifest?.id || r.transportUrl;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function overlap<T>(a: Iterable<T>, b: Set<T>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function similarity(target: ResolvedAddon, cand: ResolvedAddon): number {
  let s = 0;
  if (categorizeAddon(cand) === categorizeAddon(target)) s += 50;
  s += overlap(cand.curated?.tags ?? [], new Set(target.curated?.tags ?? [])) * 8;
  s += overlap(cand.curated?.rails ?? [], new Set(target.curated?.rails ?? [])) * 6;
  s += overlap(cand.manifest?.types ?? [], new Set(target.manifest?.types ?? [])) * 4;
  s += overlap(resources(cand), new Set(resources(target))) * 3;
  s += (cand.curated?.recommended ?? 0) / 20;
  return s;
}

function eligible(target: ResolvedAddon, cand: ResolvedAddon, selfId: string): boolean {
  if ((cand.manifest?.id ?? cand.curated?.id ?? cand.transportUrl) === selfId) return false;
  if (!cand.manifest && !cand.curated) return false;
  if (isAdultAddon(cand) !== isAdultAddon(target)) return false;
  return true;
}

export function relatedAddons(
  target: ResolvedAddon,
  all: ResolvedAddon[],
  limit = 8,
): ResolvedAddon[] {
  const selfId = target.manifest?.id ?? target.curated?.id ?? target.transportUrl;
  const targetNorm = normName(target.manifest?.name);
  const cat = categorizeAddon(target);
  const eligibleCandidates = all.filter(
    (r) =>
      eligible(target, r, selfId) && (!targetNorm || normName(r.manifest?.name) !== targetNorm),
  );
  const sameCat = eligibleCandidates
    .filter((r) => categorizeAddon(r) === cat)
    .map((r) => ({ r, score: similarity(target, r) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
  const sameCatDedup = dedupeByName(sameCat);
  if (sameCatDedup.length >= limit) return sameCatDedup.slice(0, limit);
  const otherCat = eligibleCandidates
    .filter((r) => categorizeAddon(r) !== cat)
    .map((r) => ({ r, score: similarity(target, r) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
  return dedupeByName([...sameCatDedup, ...otherCat]).slice(0, limit);
}

export function recommendedAddons(
  target: ResolvedAddon,
  all: ResolvedAddon[],
  installedIds: Set<string>,
  exclude: Set<string>,
  limit = 8,
): ResolvedAddon[] {
  const selfId = target.manifest?.id ?? target.curated?.id ?? target.transportUrl;
  const taste = new Set<string>();
  for (const r of all) {
    const id = r.manifest?.id ?? r.curated?.id ?? r.transportUrl;
    if (installedIds.has(id)) taste.add(categorizeAddon(r));
  }
  const targetNorm = normName(target.manifest?.name);
  const ranked = all
    .filter((r) => {
      const id = r.manifest?.id ?? r.curated?.id ?? r.transportUrl;
      if (!eligible(target, r, selfId) || installedIds.has(id) || exclude.has(id)) return false;
      if (targetNorm && normName(r.manifest?.name) === targetNorm) return false;
      return true;
    })
    .map((r) => {
      let s = r.curated?.recommended ?? 0;
      if (r.curated) s += 12;
      if (taste.has(categorizeAddon(r))) s += 30;
      if (categorizeAddon(r) === categorizeAddon(target)) s += 20;
      return { r, score: s };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
  return dedupeByName(ranked).slice(0, limit);
}
