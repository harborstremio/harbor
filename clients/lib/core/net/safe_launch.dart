import 'package:url_launcher/url_launcher.dart';

/// Opens [url] in the external browser, but only when it is an `http`/`https`
/// URL. Addon catalog entries and API-supplied links are attacker-influenced
/// and can carry `intent:`, `file:`, `tel:`, `market:`, or custom deep-link
/// schemes; restricting to web schemes stops those from being launched from the
/// app's trusted context. Returns whether a launch was attempted.
Future<bool> launchExternalUrl(String url) async {
  final uri = Uri.tryParse(url.trim());
  if (uri == null) return false;
  final scheme = uri.scheme.toLowerCase();
  if (scheme != 'http' && scheme != 'https') return false;
  await launchUrl(uri, mode: LaunchMode.externalApplication);
  return true;
}
