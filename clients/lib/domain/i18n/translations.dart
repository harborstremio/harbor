import 'catalog_ar.dart';
import 'catalog_pt.dart';

/// The merged translation catalogs by language code. English is the source
/// language (an empty catalog — phrase keys are themselves the English strings),
/// so a key missing from a translated catalog falls back to English. Ported from
/// the `catalogs` map in `src/lib/i18n/translate.ts`.
const _catalogs = <String, Map<String, String>>{
  'en': <String, String>{},
  'ar': arCatalog,
  'pt': ptCatalog,
};

/// Translates keys into the active [lang], falling back to English. Ported from
/// the `t`/`useT` behaviour in `translate.ts`. Interpolates `{name}` variables.
class Translations {
  const Translations(this.lang);

  final String lang;

  /// Translates [key] and interpolates [vars] (`{name}` → value).
  String t(String key, [Map<String, Object?>? vars]) =>
      _interpolate(_resolve(lang, key), vars);

  /// Translates a namespaced [key] (e.g. `nav.home`) whose English is not the
  /// key itself, falling back to the supplied English [fallback] rather than the
  /// raw key. Used where a value carries both its i18n key and its English text.
  String tOr(String key, String fallback) {
    final active = _catalogs[lang]?[key];
    if (active != null) return active;
    return _catalogs['en']?[key] ?? fallback;
  }

  static String _resolve(String lang, String key) {
    final active = _catalogs[lang]?[key];
    if (active != null) return active;
    final english = _catalogs['en']?[key];
    if (english != null) return english;
    return key;
  }

  static String _interpolate(String template, Map<String, Object?>? vars) {
    if (vars == null || vars.isEmpty) return template;
    var out = template;
    vars.forEach((name, value) {
      out = out.replaceAll('{$name}', '$value');
    });
    return out;
  }
}
