// Hot-link only, and that is the whole reason this exists instead of reusing
// @/components/addon-logo: that module carries fourteen bundled logo files, and
// Harbor has already had to delete around 627 pieces of third-party artwork
// once. Big Picture resolves a manifest's own logo against the addon's own host
// and never reaches for a file in this repo. Do not add a bundled fallback here.
export function bpAddonLogo(
  logo: string | null | undefined,
  transportUrl: string,
): string | undefined {
  const trimmed = logo?.trim();
  if (!trimmed) return undefined;
  // data: marks survive one session only. slimManifest strips them before the
  // install list is persisted, so a card that shows one today is a wordmark
  // after the next restart, and that is expected rather than a bug to chase.
  if (/^(https?:|data:)/i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, transportUrl).toString();
  } catch {
    return undefined;
  }
}
