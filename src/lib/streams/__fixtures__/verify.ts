import { parseStream } from "@/lib/streams/parser";
import { ADDON_SAMPLES, type Sample, type ExpectedFlags } from "./addon-samples";

type Failure = {
  addon: string;
  field: string;
  expected: unknown;
  actual: unknown;
  note?: string;
};

export function verifyAddonSamples(): { passed: number; failed: Failure[] } {
  const failed: Failure[] = [];
  let passed = 0;

  for (const sample of ADDON_SAMPLES) {
    const parsed = parseStream({
      ...sample.raw,
      addonId: sample.addonId,
      addonName: sample.addonName,
    });
    const errors = compareExpected(parsed, sample.expected, sample);
    if (errors.length === 0) passed++;
    else failed.push(...errors);
  }

  return { passed, failed };
}

function compareExpected(
  parsed: ReturnType<typeof parseStream>,
  expected: ExpectedFlags,
  sample: Sample,
): Failure[] {
  const out: Failure[] = [];
  const where = `${sample.addonName}${sample.note ? ` (${sample.note})` : ""}`;

  if (expected.cached) {
    for (const [slug, want] of Object.entries(expected.cached)) {
      if (!want) continue;
      const got = parsed.cached[slug as keyof typeof parsed.cached];
      if (!got)
        out.push({ addon: where, field: `cached.${slug}`, expected: true, actual: got ?? false });
    }
  }
  if (expected.uncached) {
    for (const [slug, want] of Object.entries(expected.uncached)) {
      if (!want) continue;
      const isUncached = parsed.cached[slug as keyof typeof parsed.cached] === false;
      if (!isUncached) {
        out.push({
          addon: where,
          field: `uncached.${slug}`,
          expected: true,
          actual: parsed.cached[slug as keyof typeof parsed.cached],
        });
      }
    }
  }
  if (expected.seeders !== undefined && parsed.seeders !== expected.seeders) {
    out.push({
      addon: where,
      field: "seeders",
      expected: expected.seeders,
      actual: parsed.seeders,
    });
  }
  if (expected.source && parsed.source !== expected.source) {
    out.push({ addon: where, field: "source", expected: expected.source, actual: parsed.source });
  }
  if (expected.resolution && parsed.resolution !== expected.resolution) {
    out.push({
      addon: where,
      field: "resolution",
      expected: expected.resolution,
      actual: parsed.resolution,
    });
  }
  if (expected.hdrFormat !== undefined && parsed.hdrFormat !== expected.hdrFormat) {
    out.push({
      addon: where,
      field: "hdrFormat",
      expected: expected.hdrFormat,
      actual: parsed.hdrFormat,
    });
  }
  if (expected.releaseGroup !== undefined && parsed.releaseGroup !== expected.releaseGroup) {
    out.push({
      addon: where,
      field: "releaseGroup",
      expected: expected.releaseGroup,
      actual: parsed.releaseGroup,
    });
  }
  if (expected.size !== undefined && parsed.size !== expected.size) {
    out.push({ addon: where, field: "size", expected: expected.size, actual: parsed.size });
  }

  return out;
}

export function logVerificationReport(): void {
  const { passed, failed } = verifyAddonSamples();
  const total = passed + failed.length;
  if (failed.length === 0) {
    console.log(`[parser-verify] ${total}/${total} samples passed`);
    return;
  }
  console.warn(`[parser-verify] ${passed}/${total} samples passed, ${failed.length} mismatches:`);
  for (const f of failed) {
    console.warn(
      `  ${f.addon} :: ${f.field} — expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`,
    );
  }
}
