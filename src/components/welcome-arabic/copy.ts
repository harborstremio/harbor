import type { UiLanguage } from "@/lib/i18n";

export type WelcomeLang = UiLanguage;

export const HEADLINE_AR = "السلام عليكم";
export const TRANSLITERATION = "Assalamu alaikum";
export const ENGLISH_LINE = "Peace be upon you.";

export const BODY_EN =
  "Welcome home. We spent real, purposeful time making Harbor feel like it was built for you: right to left, in your language, with subtitles you can finally shape to your taste. To everyone across the Arabic-speaking world, thank you for your patience. This release is for you.";

export const BODY_AR =
  "أهلاً بك. لقد كرّسنا وقتاً حقيقياً لنجعل Harbor وكأنه صُنع من أجلك: من اليمين إلى اليسار، بلغتك، مع ترجمات يمكنك أخيراً تنسيقها كما تحب. إلى كل الناطقين بالعربية، شكراً لصبركم. هذا الإصدار لكم.";

export const FEEDBACK_EN = "Tell us what would make Harbor truly yours.";
export const FEEDBACK_AR = "أخبرنا بما يجعل Harbor لك حقاً.";

export const CTA_AR = "وعليكم السلام";
export const CTA_HELPER_EN = "And peace be upon you.";

export function feedbackLabel(lang: WelcomeLang): string {
  return lang === "ar" ? FEEDBACK_AR : FEEDBACK_EN;
}
