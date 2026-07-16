export type SettingsSearchTranslator = (value: string) => string;

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

export function matchesSettingsSearch(
  query: string,
  values: readonly string[],
  translate: SettingsSearchTranslator,
): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) return false;

  return values.some((value) => {
    const source = normalizeSearchText(value);
    const translated = normalizeSearchText(translate(value));
    return source.includes(needle) || translated.includes(needle);
  });
}
