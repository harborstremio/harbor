export type ThemeScanVerdict = "block" | "review" | "pass";

export type ThemeScanFinding = {
  severity: "block" | "review";
  category: string;
  rule: string;
  evidence: string;
  rationale: string;
};

export type ThemeScanResult = {
  verdict: ThemeScanVerdict;
  findings: ThemeScanFinding[];
};

export function scanTheme(input: { css?: string; js?: string; html?: string }): ThemeScanResult;
