export const DEFAULT_GEMINI_CHAT_MODEL = "gemini-3-flash-preview";

export function detectChatReplyLanguage(text: string): "Arabic" | "English" | null {
  const languageSample = text
    .replace(/\[Current title open in Harbor:[\s\S]*?\]/gi, " ")
    .replace(/\[LIVE WEB SEARCH RESULTS[\s\S]*$/i, " ");
  const arabicLetters = languageSample.match(/\p{Script=Arabic}/gu)?.length ?? 0;
  // A long English catalog title inside an Arabic sentence does not change its language.
  const latinLetters = languageSample.match(/[A-Za-z]/g)?.length ?? 0;
  if (arabicLetters === 0 && latinLetters === 0) return null;
  return arabicLetters >= 2 ? "Arabic" : latinLetters ? "English" : null;
}

export function isSupportedGeminiChatModel(id: string): boolean {
  const normalized = id.replace(/^models\//, "");
  const match = /^gemini-(\d+)(?:\.\d+)?-(?:flash|pro)(?:-|$)/i.exec(normalized);
  return Boolean(
    match &&
    Number(match[1]) >= 3 &&
    !/image|audio|tts|live|robotic|computer-use/i.test(normalized),
  );
}

export function rankGeminiChatModelId(id: string): number {
  const lower = id.toLowerCase();
  const version = /gemini-(\d+)(?:\.(\d+))?/.exec(lower);
  const major = Number(version?.[1] ?? 0);
  const minor = Number(version?.[2] ?? 0);
  let score = major * 1000 + minor * 10;

  // Flash is the default recommendation model: quick, economical, and capable.
  if (lower.includes("flash")) score += 300;
  else if (lower.includes("pro")) score += 100;
  if (lower.includes("lite")) score -= 20;

  // Prefer stable variants, while keeping available preview models selectable.
  if (/preview|exp|rc\b/.test(lower)) score -= 5;
  return score;
}

export function sortGeminiChatModelIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => rankGeminiChatModelId(b) - rankGeminiChatModelId(a));
}

export function buildChatMediaContext(meta: {
  id: string;
  name: string;
  type: string;
  releaseInfo?: string;
}): string {
  const type = meta.type === "series" ? "series" : "movie";
  const yearMatch = meta.releaseInfo?.match(/(?:19|20|21)\d{2}/)?.[0];
  return `[Current title open in Harbor: ${JSON.stringify({ title: meta.name, year: yearMatch ? Number(yearMatch) : null, type })}]`;
}

export type ModelOption = {
  id: string;
  label: string;
  badge: string;
  desc: string;
};

export const GEMINI_MODELS: ModelOption[] = [
  {
    id: DEFAULT_GEMINI_CHAT_MODEL,
    label: "Gemini 3 Flash Preview",
    badge: "Default · Fast",
    desc: "Fast everyday recommendations",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro Preview",
    badge: "Deeper analysis",
    desc: "For more complex requests",
  },
];
