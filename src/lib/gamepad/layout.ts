export type Layout = "xbox" | "ps";

const SONY = /dualsense|dualshock|playstation|\bps[2-5]\b|vendor:\s*0*54c|\bsony\b/i;

export function detectLayout(names: readonly string[]): Layout | null {
  for (const name of names) if (SONY.test(name)) return "ps";
  return names.length > 0 ? "xbox" : null;
}
