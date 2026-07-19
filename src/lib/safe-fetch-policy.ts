export function canFallbackAfterNativeFetchError(error: unknown): boolean {
  if (typeof error === "string" && error.includes("response body exceeds")) return false;
  if (error instanceof Error && error.message.includes("response body exceeds")) return false;
  return true;
}
