import { normalizeLang } from "@/lib/subtitles/language";

export function consensusLanguages(
  context: { subtitleLanguage?: string | null; languages: string[] },
  preferredSubtitleLanguages: string[] | undefined,
): string[] {
  return [context.subtitleLanguage, ...context.languages, ...(preferredSubtitleLanguages ?? [])]
    .map((language) => normalizeLang(language ?? ""))
    .filter((language): language is string => language.length > 0)
    .filter((language, index, all) => all.indexOf(language) === index);
}
