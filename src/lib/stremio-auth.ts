/** Old imports remain compatible; JL never opens external account sign-in. */
export function canStremioWebAuth(): boolean {
  return false;
}
export async function startStremioWebAuth(): Promise<string> {
  throw new Error("Use your JL Media Vision account. External account sign-in is no longer used.");
}
