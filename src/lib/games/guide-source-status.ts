export class GuideSourceNotFound extends Error {
  constructor() { super("Guide page does not exist"); this.name = "GuideSourceNotFound"; }
}
export class GuideSourceRateLimit extends Error {
  readonly retryAt:number;
  constructor(retryAt: number) { super("Guide source is temporarily rate limited"); this.name = "GuideSourceRateLimit"; this.retryAt=retryAt; }
}
export function guideRetryAt(value: string | null, now = Date.now()): number {
  const seconds = value !== null && /^\d+$/.test(value.trim()) ? Number(value) * 1000 : NaN;
  const date = value ? Date.parse(value) : NaN;
  return now + Math.max(1000, Number.isFinite(seconds) ? seconds : Number.isFinite(date) ? date - now : 60_000);
}
