const seen = new Set<string>();

export function warnProviderFailure(provider: string, status: number, key: string): void {
  const tag = `${provider}:${status}`;
  if (seen.has(tag)) return;
  seen.add(tag);
  const hint =
    status === 401 || status === 403
      ? " (auth rejected, this provider may now require an API key)"
      : status === 429
        ? " (rate limited)"
        : status >= 500
          ? " (provider server error)"
          : "";
  console.warn(`[skip-intro] ${provider} returned ${status}${hint}. Query: ${key}`);
}
