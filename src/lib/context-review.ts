/** Set by the dedicated native review build before frontend code runs. */
export function isContextReview(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as Window & { __HARBOR_CONTEXT_REVIEW__?: boolean }).__HARBOR_CONTEXT_REVIEW__ === true
  );
}
