import '../../core/http/json_transport.dart';
import '../addons/models.dart';
import 'addon_family.dart';
import 'parser/stream_enums.dart';

/// AIOStatus debrid-health, ported 1:1 from web `src/lib/streams/aiostatus.ts`.
/// When an AIOStatus add-on is installed, Harbor reads its catalog + per-service
/// status streams to show each debrid service's health (active / expiring /
/// expired, days-left, quota).

const Map<String, DebridSlug> _serviceNameToSlug = {
  'premiumize': DebridSlug.pm,
  'pm': DebridSlug.pm,
  'realdebrid': DebridSlug.rd,
  'real-debrid': DebridSlug.rd,
  'rd': DebridSlug.rd,
  'torbox': DebridSlug.tb,
  'tb': DebridSlug.tb,
  'alldebrid': DebridSlug.ad,
  'all-debrid': DebridSlug.ad,
  'ad': DebridSlug.ad,
  'debridlink': DebridSlug.dl,
  'debrid-link': DebridSlug.dl,
  'dl': DebridSlug.dl,
};

enum ServiceHealthStatus { active, expiring, expired, unknown }

class ServiceHealth {
  const ServiceHealth({
    required this.slug,
    required this.status,
    required this.daysLeft,
    required this.quotaUsedPercent,
    required this.rawLine,
  });

  final DebridSlug slug;
  final ServiceHealthStatus status;
  final int? daysLeft;
  final int? quotaUsedPercent;
  final String rawLine;
}

class AioService {
  const AioService({
    required this.id,
    required this.name,
    required this.poster,
    required this.status,
    required this.daysLeft,
    required this.quotaUsedPercent,
    required this.rawLine,
  });

  final String id;
  final String name;
  final String? poster;
  final ServiceHealthStatus status;
  final int? daysLeft;
  final int? quotaUsedPercent;
  final String rawLine;
}

class AioStatusSnapshot {
  const AioStatusSnapshot({
    required this.addonName,
    required this.addonLogo,
    required this.health,
    required this.services,
  });

  final String addonName;
  final String? addonLogo;
  final Map<DebridSlug, ServiceHealth> health;
  final List<AioService> services;
}

typedef _Parsed = ({
  ServiceHealthStatus status,
  int? daysLeft,
  int? quota,
  String rawLine,
});

/// Reads the installed AIOStatus add-on (if any) and resolves each debrid
/// service's health. Returns null when no AIOStatus add-on is installed.
Future<AioStatusSnapshot?> fetchAioStatusHealth(
  List<InstalledAddon> addons,
  JsonTransport transport,
) async {
  InstalledAddon? status;
  for (final a in addons) {
    if (isStatusOnlyAddon(manifest: a.manifest, transportUrl: a.transportUrl)) {
      status = a;
      break;
    }
  }
  if (status == null) return null;
  final m = status.manifest;
  final base = status.transportUrl.replaceFirst(
    RegExp(r'/manifest\.json$'),
    '',
  );

  // Catalogs without a required extra input are directly listable; if the
  // add-on declares none, fall back to the default status catalog.
  final usable = (m?.catalogs ?? const [])
      .where((c) => !c.extra.any((e) => e.isRequired))
      .map((c) => (id: c.id, type: c.type))
      .toList();
  final catalogDefs = usable.isNotEmpty
      ? usable
      : const [(id: 'debridstatus_catalog', type: 'other')];

  final seen = <String>{};
  final metas = <({String id, String? name, String? poster, String resType})>[];
  await Future.wait(
    catalogDefs.map((def) async {
      final url =
          '$base/catalog/${Uri.encodeComponent(def.type)}/'
          '${Uri.encodeComponent(def.id)}.json';
      try {
        final res = await transport.getJson(url);
        if (!res.ok) return;
        final list = res.data is Map ? (res.data as Map)['metas'] : null;
        if (list is! List) return;
        for (final meta in list) {
          if (meta is! Map) continue;
          final id = meta['id']?.toString();
          if (id == null || id.isEmpty || seen.contains(id)) continue;
          seen.add(id);
          metas.add((
            id: id,
            name: meta['name']?.toString(),
            poster: meta['poster']?.toString(),
            resType: def.type,
          ));
        }
      } catch (_) {
        /* ignore a failed catalog */
      }
    }),
  );

  final health = <DebridSlug, ServiceHealth>{};
  final services = <AioService>[];
  await Future.wait(
    metas.map((meta) async {
      final url =
          '$base/stream/${Uri.encodeComponent(meta.resType)}/'
          '${Uri.encodeComponent(meta.id)}.json';
      try {
        final res = await transport.getJson(url);
        if (!res.ok) return;
        final streams = res.data is Map ? (res.data as Map)['streams'] : null;
        if (streams is! List || streams.isEmpty) return;
        final stream = streams.first;
        if (stream is! Map) return;
        final p = _parseStatus(stream.cast<String, dynamic>());
        final name = (meta.name?.trim().isNotEmpty ?? false)
            ? meta.name!.trim()
            : _cleanServiceId(meta.id);
        services.add(
          AioService(
            id: meta.id,
            name: name,
            poster: meta.poster,
            status: p.status,
            daysLeft: p.daysLeft,
            quotaUsedPercent: p.quota,
            rawLine: p.rawLine,
          ),
        );
        final slug = _mapDsServiceId(meta.id);
        if (slug != null) {
          health[slug] = ServiceHealth(
            slug: slug,
            status: p.status,
            daysLeft: p.daysLeft,
            quotaUsedPercent: p.quota,
            rawLine: p.rawLine,
          );
        }
      } catch (_) {
        /* ignore a failed service */
      }
    }),
  );
  services.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));

  if (health.isEmpty) {
    final fallback = await _tryStreamFallback(base, transport);
    fallback.forEach((slug, h) {
      health[slug] = h;
      if (!services.any((s) => _mapDsServiceId(s.id) == slug)) {
        services.add(
          AioService(
            id: 'ds:${slug.name}',
            name: slug.name.toUpperCase(),
            poster: null,
            status: h.status,
            daysLeft: h.daysLeft,
            quotaUsedPercent: h.quotaUsedPercent,
            rawLine: h.rawLine,
          ),
        );
      }
    });
  }

  return AioStatusSnapshot(
    addonName: m?.name ?? 'AIOStatus',
    addonLogo: m?.logo,
    health: health,
    services: services,
  );
}

DebridSlug? _mapDsServiceId(String id) {
  final tail = (id.startsWith('ds:') ? id.substring(3) : id).toLowerCase();
  return _serviceNameToSlug[tail];
}

String _cleanServiceId(String id) =>
    id.replaceFirst(RegExp(r'^[a-z]+:', caseSensitive: false), '');

final _daysRx1 = RegExp(r'Days?\s+left[:\s]+(-?\d+)', caseSensitive: false);
final _daysRx2 = RegExp(
  r'(-?\d{1,4})\s*days?\s+(?:left|remaining)',
  caseSensitive: false,
);
final _quotaRx = RegExp(r'(\d{1,3})\s*%');
final _expiredRx = RegExp(
  r'🔴|⛔|✗|❌|\bEXPIRED\b|\bINACTIVE\b|\bSUSPENDED\b|NOT[\s_-]*PREMIUM',
  caseSensitive: false,
  unicode: true,
);
final _expiringRx = RegExp(
  r'🟡|\bEXPIRING\b',
  caseSensitive: false,
  unicode: true,
);
final _activeRx = RegExp(
  r'🟢|✅|\bACTIVE\b|\bPREMIUM\b',
  caseSensitive: false,
  unicode: true,
);

_Parsed _parseStatus(Map<String, dynamic> stream) {
  final name = stream['name']?.toString() ?? '';
  final title = stream['title']?.toString() ?? '';
  final description = stream['description']?.toString() ?? '';
  final text = '$name\n$title\n$description';

  final daysMatch = _daysRx1.firstMatch(text) ?? _daysRx2.firstMatch(text);
  int? days = daysMatch != null ? int.tryParse(daysMatch.group(1)!) : null;
  // A 4-digit reading (e.g. loyalty points) is a misparse, not days-left.
  if (days != null && (days < 0 || days > 2000)) days = null;
  final quotaMatch = _quotaRx.firstMatch(text);
  final quota = quotaMatch != null ? int.tryParse(quotaMatch.group(1)!) : null;

  var status = ServiceHealthStatus.unknown;
  if (_expiredRx.hasMatch(text)) {
    status = ServiceHealthStatus.expired;
  } else if (_expiringRx.hasMatch(text) || (days != null && days <= 7)) {
    status = ServiceHealthStatus.expiring;
  } else if (_activeRx.hasMatch(text) || (days != null && days > 7)) {
    status = ServiceHealthStatus.active;
  }

  String pickLine(String s) => s
      .split(RegExp(r'\r?\n'))
      .firstWhere((l) => l.trim().length > 2, orElse: () => '');
  var rawLine = pickLine(name);
  if (rawLine.isEmpty) rawLine = pickLine(title);
  if (rawLine.isEmpty) {
    final t = text.trim();
    rawLine = t.length > 100 ? t.substring(0, 100) : t;
  }
  return (status: status, daysLeft: days, quota: quota, rawLine: rawLine);
}

final _matchRx = <DebridSlug, RegExp>{
  DebridSlug.pm: RegExp(r'\bpremiumize\b'),
  DebridSlug.rd: RegExp(r'\breal[\s\-]?debrid\b'),
  DebridSlug.tb: RegExp(r'\btorbox\b'),
  DebridSlug.ad: RegExp(r'\ball[\s\-]?debrid\b'),
  DebridSlug.dl: RegExp(r'\bdebrid[\s\-]?link\b'),
};

Future<Map<DebridSlug, ServiceHealth>> _tryStreamFallback(
  String base,
  JsonTransport transport,
) async {
  final out = <DebridSlug, ServiceHealth>{};
  const probes = [
    (type: 'movie', id: 'tt0111161'),
    (type: 'series', id: 'tt0944947'),
  ];
  for (final probe in probes) {
    try {
      final res = await transport.getJson(
        '$base/stream/${probe.type}/${probe.id}.json',
      );
      if (!res.ok) continue;
      final streams = res.data is Map ? (res.data as Map)['streams'] : null;
      if (streams is! List || streams.isEmpty) continue;
      for (final s in streams) {
        if (s is! Map) continue;
        final map = s.cast<String, dynamic>();
        final text =
            '${map['name'] ?? ''}\n${map['title'] ?? ''}\n'
                    '${map['description'] ?? ''}'
                .toLowerCase();
        DebridSlug? slug;
        for (final e in _matchRx.entries) {
          if (e.value.hasMatch(text)) {
            slug = e.key;
            break;
          }
        }
        if (slug == null || out.containsKey(slug)) continue;
        final p = _parseStatus(map);
        out[slug] = ServiceHealth(
          slug: slug,
          status: p.status,
          daysLeft: p.daysLeft,
          quotaUsedPercent: p.quota,
          rawLine: p.rawLine,
        );
      }
      if (out.isNotEmpty) return out;
    } catch (_) {
      /* ignore */
    }
  }
  return out;
}
