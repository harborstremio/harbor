// HTTP(S) domains are percent-decoded before the URL standard's forbidden-domain
// check. Some WebViews accept and retain escaped spaces in URL.hostname instead.
const forbiddenDomain = /[\u0000-\u0020\u007f#%/:<>?@[\\\]^|]/;

/** The hostname must come from an already parsed HTTP(S) URL. IP parsing and IDNA
 * remain the URL parser's job; do not impose a public-suffix or TLD allowlist. */
export function validSourceHttpHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true;
  try { return !forbiddenDomain.test(decodeURIComponent(hostname)); }
  catch { return false; }
}
