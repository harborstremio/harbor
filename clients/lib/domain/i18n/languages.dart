/// The supported UI languages. Ported from `UiLanguage`/`LANGUAGES` in
/// `src/lib/i18n/languages.ts`. English is the source language (and the fallback
/// for any untranslated key).
class LanguageOption {
  const LanguageOption({
    required this.code,
    required this.label,
    required this.nativeLabel,
    required this.rtl,
  });

  final String code;
  final String label;
  final String nativeLabel;
  final bool rtl;
}

const languages = <LanguageOption>[
  LanguageOption(
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    rtl: false,
  ),
  LanguageOption(
    code: 'ar',
    label: 'Arabic',
    nativeLabel: 'العربية',
    rtl: true,
  ),
  LanguageOption(
    code: 'pt',
    label: 'Portuguese',
    nativeLabel: 'Português',
    rtl: false,
  ),
];

/// Whether [lang] lays out right-to-left. Ported from `isRtl`.
bool isRtl(String lang) => lang == 'ar';

/// Normalises an arbitrary setting value to a supported language code, else
/// English.
String normalizeUiLanguage(String? value) =>
    (value == 'ar' || value == 'pt') ? value! : 'en';
