/// A normalized addon name for de-duplication and matching — strips bracketed
/// tags, everything after a pipe, common provider/label tokens, and all
/// non-alphanumerics. Ported 1:1 from the web `normalizeAddonName` / `normName`
/// (shared by the recommend scorer and the catalog merge).
String normalizeAddonName(String? name) {
  if (name == null || name.isEmpty) return '';
  var s = name.toLowerCase();
  s = s.replaceAll(RegExp(r'\[[^\]]*\]'), '');
  s = s.replaceAll(RegExp(r'\|.*$'), '');
  s = s.replaceAll(
    RegExp(
      r'\b(rd|tb|ad|premiumize|debrid|elfhosted|community|official|free|paid|sponsored|by\s+\S+)\b',
    ),
    '',
  );
  s = s.replaceAll(RegExp(r'[^a-z0-9]+'), '');
  return s.trim();
}
