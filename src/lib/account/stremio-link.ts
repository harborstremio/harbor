/** Never forward local scope IDs or stored external tokens to an identity service. */
export async function verifyWithCurrentStremio(_authKey: string): Promise<void> {
  throw new Error("JL Media Vision does not link external media accounts.");
}
export async function verifyWithStremioBrowser(): Promise<void> {
  throw new Error("Use your JL Media Vision account on this device.");
}
export async function unlinkStremio(): Promise<void> {
  throw new Error("External account linking is no longer used by JL Media Vision.");
}
