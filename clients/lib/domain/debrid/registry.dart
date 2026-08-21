import '../streams/parser/stream_enums.dart';
import 'alldebrid.dart';
import 'debrid_http.dart';
import 'debrid_link.dart';
import 'debrid_types.dart';
import 'premiumize.dart';
import 'real_debrid.dart';
import 'torbox.dart';

/// The five debrid API keys from settings (each defaults empty). Ported from
/// `src/lib/debrid/registry.ts`.
class DebridKeys {
  const DebridKeys({
    this.rdKey = '',
    this.tbKey = '',
    this.adKey = '',
    this.pmKey = '',
    this.dlKey = '',
  });

  final String rdKey;
  final String tbKey;
  final String adKey;
  final String pmKey;
  final String dlKey;
}

/// Builds a debrid client for each non-empty key, in the fixed order rd, tb, ad,
/// pm, dl — the default resolution order before per-stream cache re-sorting.
List<DebridStore> buildDebridClients(DebridKeys keys, DebridHttp http) {
  final clients = <DebridStore>[];
  if (keys.rdKey.isNotEmpty) clients.add(RealDebrid(keys.rdKey, http));
  if (keys.tbKey.isNotEmpty) clients.add(Torbox(keys.tbKey, http));
  if (keys.adKey.isNotEmpty) clients.add(AllDebrid(keys.adKey, http));
  if (keys.pmKey.isNotEmpty) clients.add(Premiumize(keys.pmKey, http));
  if (keys.dlKey.isNotEmpty) clients.add(DebridLink(keys.dlKey, http));
  return clients;
}

/// The slugs of the configured debrid clients, in build order.
List<DebridSlug> debridSlugs(List<DebridStore> clients) =>
    clients.map((c) => c.slug).toList();
