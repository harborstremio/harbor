import 'parsed_stream.dart';

/// Whether [stream] carries audio in one of the viewer's [preferred] languages —
/// the predicate behind the picker's "Preferred language" filter and the
/// `requirePreferredLanguage` setting. Ported verbatim from the web
/// `streamMatchesLangs`: an unknown-language source (none parsed) always passes,
/// a `Multi` source always passes, otherwise a parsed language must equal or
/// prefix a preferred one (case-insensitively).
bool streamMatchesLangs(ParsedStream stream, List<String> preferred) {
  final langs = stream.audioLanguages;
  if (langs.isEmpty) return true;
  if (langs.any((l) => l.toLowerCase() == 'multi')) return true;
  return langs.any((l) {
    final ll = l.toLowerCase();
    return preferred.any((p) {
      final pl = p.toLowerCase();
      return ll == pl || ll.startsWith(pl);
    });
  });
}
