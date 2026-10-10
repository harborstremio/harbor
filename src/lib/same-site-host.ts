import { parse } from "tldts";

/** Site grouping is for provider Referer/Origin checks, never credential redirects. */
export function sameSiteHost(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const left = a.toLowerCase().replace(/\.$/, "");
  const right = b.toLowerCase().replace(/\.$/, "");
  if (left === right) return true;
  const first = parse(left, { allowPrivateDomains: true });
  const second = parse(right, { allowPrivateDomains: true });
  return !!(
    first.domain &&
    second.domain &&
    (first.isIcann || first.isPrivate) &&
    (second.isIcann || second.isPrivate) &&
    first.domain === second.domain
  );
}
