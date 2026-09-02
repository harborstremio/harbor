export function airedOnly<T>(eps: T[], dateOf: (e: T) => string | null | undefined): T[] {
  const now = Date.now();
  let anyDated = false;
  let boundary = -1;
  const aired = eps.map((e, i) => {
    const raw = dateOf(e);
    const t = raw ? Date.parse(raw) : NaN;
    if (!Number.isFinite(t)) return null;
    anyDated = true;
    if (t <= now) boundary = i;
    return t <= now;
  });
  if (!anyDated) return eps;
  return eps.filter((_, i) => aired[i] === true || (aired[i] === null && i <= boundary));
}
